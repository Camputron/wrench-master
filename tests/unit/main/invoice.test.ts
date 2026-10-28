import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRepos, type Repos } from '../../../src/main/db'
import { escapeHtml, invoiceFileName, invoiceHtml, invoiceNumber } from '../../../src/main/invoice'
import { DEFAULT_SETTINGS } from '../../../src/main/settings'
import type { Settings, WorkOrder } from '../../../src/shared/types'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let r: Repos
let wo: WorkOrder
beforeEach(() => {
  r = createRepos(createJavaDb(tempDir()))
  wo = r.workOrders.getById(1)!
})
afterEach(() => r.db.close())

const shop: Settings = {
  ...DEFAULT_SETTINGS,
  shop: { company: "Joe's <Auto>", street: '1 Main St', city: 'Flushing', state: 'NEW_YORK', zip: '11354', phone: '718-555-0142', repairShopId: '7012345', invoiceTitle: 'NYS Inspection Station' }
}

describe('invoice HTML', () => {
  it('escapes everything that came from users', () => {
    const html = invoiceHtml({ ...wo, customer: { ...wo.customer, firstName: '<script>alert(1)</script>' }, parts: [{ ...wo.parts[0], desc: 'a & b "c"' }] }, shop)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('a &amp; b &quot;c&quot;')
    expect(html).toContain('Joe&#39;s &lt;Auto&gt;')
    expect(escapeHtml(`'"<>&`)).toBe('&#39;&quot;&lt;&gt;&amp;')
  })

  it('blocks scripts and remote content with its own content security policy', () => {
    expect(invoiceHtml(wo, shop)).toContain(`content="default-src 'none'; style-src 'unsafe-inline'"`)
  })

  it('shows the shop, the work order, and the totals', () => {
    const html = invoiceHtml(wo, shop)
    expect(html).toContain('NYS Repair Shop #7012345')
    expect(html).toContain('NYS Inspection Station')
    expect(html).toContain('Work order #00001')
    expect(html).toContain('Date 03/05/2024')
    expect(html).toContain('Completed 03/20/2024')
    expect(html).toContain('100,000 → 100,050 (50 mi)')
    expect(html).toContain('<td>Sales tax</td>')
    expect(html).not.toContain('8.625')
    expect(html).toContain('$254.41') // total
    expect(html).toContain('$104.41') // amount due
    expect(html).toContain('* Not taxed') // the shop supplies line
  })

  it('pins the payments and totals to the bottom of a full-height page', () => {
    const html = invoiceHtml(wo, shop)
    expect(html).toMatch(/\.page \{[^}]*min-height: 10\.15in/)
    expect(html).toMatch(/\.bottom \{[^}]*margin-top: auto/)
    expect(html.indexOf('class="bottom"')).toBeGreaterThan(html.indexOf('class="lines"'))
  })

  it('pads the on-screen preview like the paper, but only on screen', () => {
    const html = invoiceHtml(wo, shop)
    expect(html).toContain('@media screen { body { padding: 0.4in 0.45in; } }')
    expect(html).toMatch(/@page \{[^}]*margin: 0\.4in 0\.45in/)
  })

  it('labels unsaved work orders as drafts and leaves out an empty shop ID line', () => {
    expect(invoiceNumber({ ...wo, id: 0 })).toBe('Draft')
    expect(invoiceHtml({ ...wo, id: 0 }, shop)).toContain('Work order Draft')
    expect(invoiceHtml(wo, DEFAULT_SETTINGS)).not.toContain('Repair Shop #')
  })

  it('suggests a safe PDF file name', () => {
    expect(invoiceFileName(wo)).toBe('Work Order 00001 - Doe.pdf')
    expect(invoiceFileName({ ...wo, id: 0, customer: { ...wo.customer, lastName: 'A/B:C*' } })).toBe('Work Order Draft - ABC.pdf')
    expect(invoiceFileName({ ...wo, customer: { ...wo.customer, firstName: '', lastName: '', company: '' } })).toBe('Work Order 00001.pdf')
  })
})
