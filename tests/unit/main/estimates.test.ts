import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRepos, type Repos } from '../../../src/main/db'
import { estimateFileName, estimateHtml } from '../../../src/main/invoice'
import { DEFAULT_SETTINGS } from '../../../src/main/settings'
import { bill } from '../../../src/shared/billing'
import { addDays, estimateNumber, isExpired } from '../../../src/shared/estimates'
import type { Estimate } from '../../../src/shared/types'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let r: Repos
beforeEach(() => {
  r = createRepos(createJavaDb(tempDir()))
})
afterEach(() => r.db.close())

const draft = (overrides: Partial<Estimate> = {}): Estimate => {
  const wo = r.workOrders.getById(1)!
  return {
    id: 0,
    dateCreated: '2026-10-01',
    validUntil: '2026-10-31',
    customer: wo.customer,
    vehicle: { ...wo.vehicle, mileageOut: '' },
    taxRate: 0.08625,
    parts: wo.parts.map((p) => ({ ...p, id: 0 })),
    labor: wo.labor.map((l) => ({ ...l, id: 0 })),
    status: 'open',
    workOrderId: null,
    ...overrides
  }
}

describe('estimates', () => {
  it('are numbered on their own, separately from work orders', () => {
    const a = r.estimates.save(draft())
    const b = r.estimates.save(draft())
    expect([a.id, b.id]).toEqual([1, 2])
    expect(estimateNumber(a.id)).toBe('E-00001')
    expect(estimateNumber(0)).toBe('New estimate')
    // Work order numbering is untouched.
    expect(r.workOrders.list().map((w) => w.id)).toEqual([3, 2, 1])
  })

  it('save the customer, vehicle, parts, and labor, and sync lines on update', () => {
    const saved = r.estimates.save(draft())
    expect(saved).toMatchObject({ dateCreated: '2026-10-01', validUntil: '2026-10-31', status: 'open', workOrderId: null })
    expect(saved.customer.lastName).toBe('Doe')
    expect(saved.parts.map((p) => p.id).every((id) => id > 0)).toBe(true)
    const updated = r.estimates.save({ ...saved, parts: [{ ...saved.parts[0], quantity: 3 }], labor: [...saved.labor, { ...saved.labor[0], id: 0, desc: 'More' }] })
    expect(updated.parts.map((p) => [p.id, p.quantity])).toEqual([[saved.parts[0].id, 3]])
    expect(updated.labor.map((l) => l.desc)).toEqual([saved.labor[0].desc, 'More'])
  })

  it('search by number, customer, or vehicle, and filter by status', () => {
    const a = r.estimates.save(draft())
    const b = r.estimates.save(draft({ customer: { ...draft().customer, lastName: 'Zimmer' }, validUntil: '2026-10-05' }))
    r.estimates.setStatus(a.id, 'declined')
    const ids = (f: Parameters<Repos['estimates']['filter']>[0]): number[] => r.estimates.filter(f, '2026-10-10').map((e) => e.id)
    expect(ids({ text: 'zimm' })).toEqual([b.id])
    for (const text of ['E-00001', 'e1', '#1', '1']) expect(ids({ text })).toContain(a.id)
    expect(ids({ status: 'declined' })).toEqual([a.id])
    expect(ids({ status: 'open' })).toEqual([b.id])
    expect(ids({ status: 'expired' })).toEqual([b.id])
    expect(ids({ text: "100%_'" })).toEqual([])
    expect(r.estimates.listByCustomer(draft().customer.id).length).toBe(2)
  })

  it('turn into a work order when accepted, and are locked after', () => {
    const e = r.estimates.save(draft())
    const wo = r.estimates.convert(e.id, '2026-10-12')
    expect(wo).toMatchObject({ dateCreated: '2026-10-12', dateCompleted: null, dateVoided: null, taxRate: e.taxRate, payments: [] })
    expect(wo.id).toBe(4)
    expect(wo.parts.map((p) => [p.name, p.quantity])).toEqual(e.parts.map((p) => [p.name, p.quantity]))
    expect(wo.labor.map((l) => l.desc)).toEqual(e.labor.map((l) => l.desc))
    expect(bill(wo)).toBeCloseTo(bill(e), 10)
    // The estimate keeps its own lines, now accepted and linked.
    const accepted = r.estimates.getById(e.id)!
    expect(accepted).toMatchObject({ status: 'accepted', workOrderId: wo.id })
    expect(accepted.parts.map((p) => p.id)).toEqual(e.parts.map((p) => p.id))
    // Locked: can't be changed, accepted again, declined, or deleted.
    expect(() => r.estimates.save({ ...accepted, taxRate: 0 })).toThrow(/accepted/)
    expect(() => r.estimates.convert(e.id)).toThrow(/only open estimates/)
    expect(r.estimates.setStatus(e.id, 'declined')!.status).toBe('accepted')
    expect(() => r.estimates.delete(e.id)).toThrow(/kept/)
  })

  it('leave nothing behind if accepting fails part way', () => {
    const e = r.estimates.save(draft())
    r.db.exec(`create trigger fail_link before update of work_order_id on estimate begin select raise(abort, 'link failed'); end`)
    expect(() => r.estimates.convert(e.id)).toThrow(/link failed/)
    expect(r.workOrders.list()).toHaveLength(3)
    expect(r.estimates.getById(e.id)!.status).toBe('open')
  })

  it('can be declined, reopened, and deleted with their lines', () => {
    const e = r.estimates.save(draft())
    expect(r.estimates.setStatus(e.id, 'declined')!.status).toBe('declined')
    expect(() => r.estimates.convert(e.id)).toThrow()
    expect(r.estimates.setStatus(e.id, 'open')!.status).toBe('open')
    r.estimates.delete(e.id)
    expect(r.estimates.getById(e.id)).toBeNull()
    for (const table of ['estimate_item', 'estimate_labor']) expect(r.db.prepare(`select count(*) as n from ${table}`).get()).toEqual({ n: 0 })
  })

  it('are expired when open past their valid-until date', () => {
    expect(addDays('2026-10-27', 30)).toBe('2026-11-26')
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08') // across a DST change
    expect(isExpired({ status: 'open', validUntil: '2026-10-26' }, '2026-10-27')).toBe(true)
    expect(isExpired({ status: 'open', validUntil: '2026-10-27' }, '2026-10-27')).toBe(false)
    expect(isExpired({ status: 'declined', validUntil: '2026-01-01' }, '2026-10-27')).toBe(false)
  })
})

describe('printed estimate', () => {
  const settings = { ...DEFAULT_SETTINGS, shop: { ...DEFAULT_SETTINGS.shop, company: "Joe's <Auto>" } }

  it('shows the number, dates, an authorization line, and the estimated total, with no payments', () => {
    const e = r.estimates.save(draft())
    const html = estimateHtml(e, settings)
    expect(html).toContain('<title>Estimate E-00001</title>')
    expect(html).toContain('<p class="number">Estimate E-00001</p>')
    expect(html).toContain('<p>Valid until 10/31/2026</p>')
    expect(html).toMatch(/<dt class="wide">Mileage<\/dt><dd class="wide">[\d,]+<\/dd>/)
    expect(html).toContain('I authorize the repairs listed above at the estimated cost. Prices are valid until 10/31/2026.')
    expect(html).toContain('<span>Customer signature</span><span>Date</span>')
    expect(html).toContain(`Estimated total</td><td class="num">$${bill(e).toFixed(2)}`)
    expect(html).not.toContain('Payment')
    expect(html).not.toContain('Amount due')
    expect(html).toContain('Joe&#39;s &lt;Auto&gt;')
    expect(estimateFileName(e)).toBe('Estimate E-00001 - Doe.pdf')
    expect(estimateFileName({ ...e, id: 0 })).toBe('Estimate Draft - Doe.pdf')
  })

  it('notes when it was accepted or declined', () => {
    const e = r.estimates.save(draft())
    const wo = r.estimates.convert(e.id)
    expect(estimateHtml(r.estimates.getById(e.id)!, settings)).toContain(`Accepted · work order #0000${wo.id}`)
    expect(estimateHtml({ ...e, status: 'declined' }, settings)).toContain('DECLINED')
  })
})
