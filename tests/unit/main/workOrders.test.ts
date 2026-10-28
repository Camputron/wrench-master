import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { balance, bill } from '../../../src/shared/billing'
import type { WorkOrder } from '../../../src/shared/types'
import { createRepos, type Repos } from '../../../src/main/db'
import { createJavaDb, javaDate, WO1_TOTAL } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let r: Repos
beforeEach(() => {
  r = createRepos(createJavaDb(tempDir()))
})
afterEach(() => r.db.close())

const ids = (list: WorkOrder[]): number[] => list.map((w) => w.id)

const draft = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 0,
  dateCreated: '2025-06-01',
  dateCompleted: null,
  dateVoided: null,
  customer: r.customers.getById(1)!,
  vehicle: { vin: 'V', year: '2003', make: 'Honda', model: 'Accord', licensePlate: '', color: '', engine: '', transmission: '', mileageIn: '1', mileageOut: '' },
  taxRate: 0.1,
  parts: [{ id: 0, name: 'P1', desc: 'part', retailPrice: 10, listPrice: 5, quantity: 3, taxable: true }],
  labor: [{ id: 0, code: 'L', desc: 'labor', billedHrs: 2, rate: 100, taxable: false }],
  payments: [{ id: 0, date: '2025-06-02', method: 'Check', amount: 20 }],
  ...overrides
})

describe('reading work orders written by the Java app', () => {
  it('reads dates, customer and vehicle snapshot, lines, booleans, and payments', () => {
    const wo = r.workOrders.getById(1)!
    expect(wo.dateCreated).toBe('2024-03-05')
    expect(wo.dateCompleted).toBe('2024-03-20')
    expect(wo.customer).toMatchObject({ id: 1, firstName: 'Jane', state: 'NEW_YORK' })
    expect(wo.vehicle).toMatchObject({ make: 'Honda', mileageIn: '100000', mileageOut: '100050' })
    expect(wo.parts.map((p) => [p.name, p.quantity, p.taxable])).toEqual([
      ['BP-100', 2, true],
      ['SH-1', 1, false]
    ])
    expect(wo.labor[0]).toMatchObject({ code: 'L1', billedHrs: 1.5, rate: 90, taxable: true })
    expect(wo.payments.map((p) => [p.date, p.method, p.amount])).toEqual([
      ['2024-03-20', 'Cash', 100],
      ['2024-03-20', 'Credit', 50]
    ])
    expect(bill(wo)).toBeCloseTo(WO1_TOTAL, 10)
    expect(balance(wo)).toBe(104.41) // $254.40625 - $150, to the cent
  })

  it('returns null for a missing work order', () => {
    expect(r.workOrders.getById(99)).toBeNull()
  })
})

describe('listing', () => {
  it('lists newest first, with an optional limit', () => {
    expect(ids(r.workOrders.list())).toEqual([3, 2, 1])
    expect(ids(r.workOrders.list(2))).toEqual([3, 2])
  })

  it('gets several by id in the order asked, skipping missing ones', () => {
    expect(ids(r.workOrders.getByIds([2, 99, 1]))).toEqual([2, 1])
  })

  it('lists open work orders and a customer’s work orders', () => {
    expect(ids(r.workOrders.listIncomplete())).toEqual([3, 2])
    expect(ids(r.workOrders.listByCustomer(2))).toEqual([3, 2])
  })
})

describe('filter', () => {
  it.each([
    [{ text: 'honda' }, [1]],
    [{ text: 'jane accord' }, [1]],
    [{ text: 'ford' }, [3, 2]],
    [{ text: '#2' }, [2]],
    [{ text: '3' }, [3]],
    [{ text: 'abc1' }, [1]],
    [{ text: '1hgcm' }, [1]],
    [{ text: 'acme_corp' }, [3, 2]],
    [{ firstName: 'ja' }, [1]],
    [{ company: 'Acme_' }, [3, 2]],
    [{ id: 2 }, [2]],
    [{ status: 'open' as const }, [3, 2]],
    [{ status: 'completed' as const }, [1]],
    [{ date: { mode: 'exactly' as const, date: '2024-03-05' } }, [1]],
    [{ date: { mode: 'before' as const, date: '2024-11-02' } }, [2, 1]],
    [{ date: { mode: 'after' as const, date: '2024-11-02' } }, [3, 2]],
    [{ date: { mode: 'between' as const, from: '2024-01-01', to: '2024-12-31' } }, [2, 1]],
    [{ lastName: 'smith', status: 'open' as const, date: { mode: 'after' as const, date: '2025-01-01' } }, [3]],
    [{ limit: 1 }, [3]],
    [{}, [3, 2, 1]]
  ])('%j -> %j', (filter, expected) => {
    expect(ids(r.workOrders.filter(filter))).toEqual(expected)
  })

  it.each(['acme%', '%', '"; drop table work_order; --'])('treats %j literally (no wildcards, no SQL injection)', (text) => {
    expect(r.workOrders.filter({ text })).toEqual([])
    expect(r.workOrders.list()).toHaveLength(3)
  })
})

describe('save', () => {
  it('inserts a new work order with its lines, in the Java app’s storage format', () => {
    const saved = r.workOrders.save(draft())
    expect(saved.id).toBe(4)
    expect(saved.parts[0].id).toBeGreaterThan(0)
    expect(saved.labor[0].id).toBeGreaterThan(0)
    expect(saved.payments[0].id).toBeGreaterThan(0)
    expect(bill(saved)).toBeCloseTo(30 * 1.1 + 200, 10)
    const raw = r.db.prepare('select date_created, date_completed from work_order where work_order_id = 4').get() as Record<string, unknown>
    expect(raw).toEqual({ date_created: javaDate(2025, 6, 1), date_completed: null })
    expect(r.db.prepare('select item_taxable from work_order_item where work_order_id = 4').get()).toEqual({ item_taxable: 1 })
    // Keep the Java app's counter in step, in case it's opened again.
    expect(r.db.prepare(`select value from counter where id = 'work.order.id'`).get()).toEqual({ value: 5 })
  })

  it('syncs lines on update: changes kept lines, adds new ones, removes missing ones', () => {
    const wo = r.workOrders.save(draft())
    const keptId = wo.parts[0].id
    const saved = r.workOrders.save({
      ...wo,
      dateCompleted: '2025-06-04',
      parts: [
        { ...wo.parts[0], quantity: 5 },
        { id: 0, name: 'P2', desc: '', retailPrice: 1, listPrice: 1, quantity: 1, taxable: false }
      ],
      labor: [],
      payments: [...wo.payments, { id: 0, date: '2025-06-03', method: 'Cash', amount: 5 }]
    })
    expect(saved.id).toBe(wo.id)
    expect(saved.parts.map((p) => [p.id === keptId, p.quantity])).toEqual([
      [true, 5],
      [false, 1]
    ])
    expect(saved.labor).toEqual([])
    expect(saved.payments).toHaveLength(2)
    expect(saved.dateCompleted).toBe('2025-06-04')
    expect(r.workOrders.getById(1)!.parts).toHaveLength(2) // other work orders untouched
  })

  it('rolls back everything if any part of the save fails', () => {
    const wo = r.workOrders.save(draft())
    const broken = { ...wo, parts: [], payments: [{ id: 0, date: '2025-06-05', method: 'Cash' as const, amount: { bad: true } as unknown as number }] }
    expect(() => r.workOrders.save(broken)).toThrow()
    expect(r.workOrders.getById(wo.id)!.parts).toHaveLength(1)
  })
})

describe('delete', () => {
  it('removes the work order and all its lines, including payments', () => {
    r.workOrders.delete(1)
    expect(r.workOrders.getById(1)).toBeNull()
    for (const table of ['work_order_item', 'work_order_labor', 'work_order_payment']) {
      expect(r.db.prepare(`select count(*) as n from ${table} where work_order_id = 1`).get()).toEqual({ n: 0 })
    }
  })
})

describe('reporting', () => {
  it('counts completed work orders by month and year, open ones, and unpaid balances', () => {
    const s = r.workOrders.stats(new Date(2024, 2, 15))
    expect(s).toMatchObject({ completedThisMonth: 1, completedLastMonth: 0, completedThisYear: 1, openCount: 2 })
    // #1 owes $104.41 and #2 owes $90 (untaxed labor); #3 owes nothing.
    expect(s.unpaidCount).toBe(2)
    expect(s.unpaidTotal).toBe(104.41 + 90)
    expect(r.workOrders.stats(new Date(2024, 3, 2))).toMatchObject({ completedThisMonth: 0, completedLastMonth: 1 })
  })

  it('lists years with completed work orders', () => {
    r.workOrders.save(draft({ dateCompleted: '2025-06-04' }))
    expect(r.workOrders.years()).toEqual([2025, 2024])
  })

  it('totals income by month created (expected) and completed (actual)', () => {
    const months = r.workOrders.incomeByMonth(2024)
    expect(months).toHaveLength(12)
    expect(months[2].expected).toBeCloseTo(WO1_TOTAL, 10)
    expect(months[2].actual).toBeCloseTo(WO1_TOTAL, 10)
    expect(months[10]).toEqual({ month: 11, expected: 90, actual: 0 })
    expect(months.filter((m) => m.expected || m.actual)).toHaveLength(2)
  })
})

describe('opening an existing database', () => {
  it('adds indexes without changing the Java app’s data, and can be reopened', () => {
    const file = r.db.name
    r.db.close()
    r = createRepos(file)
    r.db.close()
    r = createRepos(file)
    expect(r.workOrders.list()).toHaveLength(3)
    expect(r.db.prepare(`select count(*) as n from sqlite_master where type = 'index' and name like 'idx_%'`).get()).toEqual({ n: 5 })
  })
})

describe('voiding', () => {
  it('keeps the work order and its payments, but leaves it out of reporting', () => {
    const march = new Date(2024, 2, 15)
    const before = r.workOrders.stats(march)
    const voided = r.workOrders.setVoided(1, true, '2024-04-01')!
    expect(voided.dateVoided).toBe('2024-04-01')
    expect(voided.payments).toHaveLength(2)
    expect(ids(r.workOrders.list())).toEqual([3, 2, 1])
    expect(r.workOrders.stats(march)).toMatchObject({ completedThisMonth: 0, completedThisYear: 0, openCount: 2, unpaidCount: 1, unpaidTotal: 90 })
    expect(r.workOrders.years()).toEqual([])
    expect(r.workOrders.incomeByMonth(2024)[2]).toEqual({ month: 3, expected: 0, actual: 0 })

    // Saving it (as its editor does) leaves it voided; restoring brings everything back.
    r.workOrders.save(voided)
    expect(r.workOrders.getById(1)!.dateVoided).toBe('2024-04-01')
    expect(r.workOrders.setVoided(1, false)!.dateVoided).toBeNull()
    expect(r.workOrders.stats(march)).toEqual(before)
  })

  it('has its own status filter, and leaves the open list', () => {
    r.workOrders.setVoided(2, true)
    expect(ids(r.workOrders.filter({ status: 'voided' }))).toEqual([2])
    expect(ids(r.workOrders.filter({ status: 'open' }))).toEqual([3])
    expect(ids(r.workOrders.filter({ status: 'completed' }))).toEqual([1])
    expect(ids(r.workOrders.listIncomplete())).toEqual([3])
    // Voiding twice keeps the first date; unknown ids do nothing.
    const date = r.workOrders.getById(2)!.dateVoided
    expect(r.workOrders.setVoided(2, true, '2030-01-01')!.dateVoided).toBe(date)
    expect(r.workOrders.setVoided(99, true)).toBeNull()
    expect(r.db.prepare('select count(*) as n from work_order_void').get()).toEqual({ n: 1 })
  })

  it('is recorded outside the Java app’s tables, and deleted with the work order', () => {
    const columns = (r.db.prepare('pragma table_info(work_order)').all() as { name: string }[]).map((c) => c.name)
    expect(columns).not.toContain('date_voided')
    r.workOrders.setVoided(3, true)
    r.workOrders.delete(3)
    expect(r.db.prepare('select count(*) as n from work_order_void').get()).toEqual({ n: 0 })
  })
})
