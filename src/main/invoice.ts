import { balance, bill, laborsSubtotal, laborSubtotal, partsSubtotal, partSubtotal, subtotal, tax, totalPayments } from '../shared/billing'
import { stateByKey } from '../shared/states'
import type { Settings, WorkOrder } from '../shared/types'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmt = (n: number): string => money.format(Math.abs(n) < 0.005 ? 0 : n)

/** Customer data goes into HTML, so everything is escaped. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const date = (iso: string | null): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

/** "Work order #00012", zero-padded like the Java app's invoices. */
export const invoiceNumber = (wo: WorkOrder): string => (wo.id > 0 ? `#${String(wo.id).padStart(5, '0')}` : 'Draft')

function address(parts: { street: string; city: string; state: string; zip: string }): string {
  const state = stateByKey(parts.state)?.abbreviation ?? ''
  return [parts.street, [parts.city, [state, parts.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter((s) => s.trim()).join(', ')
}

function mileage(wo: WorkOrder): string {
  const { mileageIn, mileageOut } = wo.vehicle
  const n = (s: string): string => (/^\d+$/.test(s) ? Number(s).toLocaleString('en-US') : s)
  if (mileageIn && mileageOut && /^\d+$/.test(mileageIn) && /^\d+$/.test(mileageOut)) return `${n(mileageIn)} → ${n(mileageOut)} (${(Number(mileageOut) - Number(mileageIn)).toLocaleString('en-US')} mi)`
  return [mileageIn && `In ${n(mileageIn)}`, mileageOut && `Out ${n(mileageOut)}`].filter(Boolean).join(' · ')
}

/** A label/value pair, skipped when empty. Details sit two pairs per row; `wide` values take a whole row. */
const field = (label: string, value: string, wide = false): string => (value.trim() ? `<dt${wide ? ' class="wide"' : ''}>${escapeHtml(label)}</dt><dd${wide ? ' class="wide"' : ''}>${escapeHtml(value)}</dd>` : '')

const STYLE = `
  @page { size: Letter; margin: 0.4in 0.45in; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.5pt/1.3 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; background: #fff; }
  /* The on-screen preview has no page margins, so pad it like the paper. Printing and PDFs use print media and skip this. */
  @media screen { body { padding: 0.4in 0.45in; } }
  /* Fills the printable height (11in - 0.8in margins) so the totals sit at the bottom of the page. */
  .page { display: flex; flex-direction: column; min-height: 10.15in; }
  header { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 6px; border-bottom: 1.5px solid #111; }
  h1 { font-size: 15pt; margin: 0 0 1px; line-height: 1.15; }
  .shop p, .meta p { margin: 0; color: #333; }
  .shop .title { font-weight: 600; color: #111; }
  .meta { text-align: right; white-space: nowrap; }
  .meta .number { font-size: 12pt; font-weight: 700; color: #111; }
  .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; }
  .box { border: 1px solid #bbb; border-radius: 3px; padding: 5px 8px; }
  h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #444; margin: 0 0 3px; }
  dl { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 1px 8px; margin: 0; }
  dt { color: #555; }
  dd { margin: 0; overflow-wrap: anywhere; }
  dt.wide { grid-column: 1; }
  dd.wide { grid-column: 2 / -1; }
  .lines h2 { margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.04em; color: #444; border-bottom: 1px solid #111; padding: 2px 5px; }
  td { border-bottom: 1px solid #ddd; padding: 2px 5px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 8.5pt; }
  .desc { white-space: pre-line; }
  .empty { color: #777; font-style: italic; }
  /* margin-top: auto pushes payments and totals to the bottom of the page. */
  .bottom { margin-top: auto; padding-top: 10px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; page-break-inside: avoid; }
  .payments { flex: 1; max-width: 3.6in; }
  .totals { width: 2.8in; border-collapse: collapse; }
  .totals td { border: 0; padding: 1px 5px; }
  .totals .strong td { font-weight: 700; border-top: 1px solid #111; padding-top: 3px; }
  .totals .due td { font-size: 11pt; font-weight: 700; border-top: 1.5px solid #111; padding-top: 4px; }
  .note { font-size: 8pt; color: #555; margin: 3px 0 0; }
`

/** The printable invoice for a work order, as a complete HTML page (always light, US Letter). */
export function invoiceHtml(wo: WorkOrder, settings: Settings): string {
  const { shop } = settings
  const c = wo.customer
  const v = wo.vehicle
  const stateAbbr = stateByKey(shop.state)?.abbreviation ?? ''
  const shopId = shop.repairShopId.trim() ? `${stateAbbr ? `${stateAbbr}S ` : ''}Repair Shop #${shop.repairShopId.trim()}` : ''
  const anyUntaxed = wo.parts.some((p) => !p.taxable) || wo.labor.some((l) => !l.taxable)
  const untaxedMark = (taxable: boolean): string => (taxable ? '' : ' *')

  const parts = wo.parts.length
    ? wo.parts
        .map(
          (p) =>
            `<tr><td class="code">${escapeHtml(p.name)}</td><td class="desc">${escapeHtml(p.desc)}</td><td class="num">${p.quantity}</td><td class="num">${fmt(p.retailPrice)}</td><td class="num">${fmt(partSubtotal(p))}${untaxedMark(p.taxable)}</td></tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">No parts</td></tr>`
  const labor = wo.labor.length
    ? wo.labor
        .map(
          (l) => `<tr><td class="code">${escapeHtml(l.code)}</td><td class="desc">${escapeHtml(l.desc)}</td><td class="num">${l.billedHrs}</td><td class="num">${fmt(l.rate)}</td><td class="num">${fmt(laborSubtotal(l))}${untaxedMark(l.taxable)}</td></tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">No labor</td></tr>`
  const payments = wo.payments.length
    ? `<table><thead><tr><th>Payment date</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${wo.payments
        .map((p) => `<tr><td>${date(p.date)}</td><td>${escapeHtml(p.method)}</td><td class="num">${fmt(p.amount)}</td></tr>`)
        .join('')}</tbody></table>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Work order ${escapeHtml(invoiceNumber(wo))}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="page">
  <header>
    <div class="shop">
      <h1>${escapeHtml(shop.company || 'Invoice')}</h1>
      ${address(shop) ? `<p>${escapeHtml(address(shop))}</p>` : ''}
      ${shop.phone ? `<p>${escapeHtml(shop.phone)}</p>` : ''}
      ${shopId ? `<p>${escapeHtml(shopId)}</p>` : ''}
      ${shop.invoiceTitle ? `<p class="title">${escapeHtml(shop.invoiceTitle)}</p>` : ''}
    </div>
    <div class="meta">
      <p class="number">Work order ${escapeHtml(invoiceNumber(wo))}</p>
      <p>Date ${date(wo.dateCreated)}</p>
      ${wo.dateCompleted ? `<p>Completed ${date(wo.dateCompleted)}</p>` : ''}
    </div>
  </header>

  <div class="boxes">
    <section class="box">
      <h2>Customer</h2>
      <dl>
        ${field('Name', [c.firstName, c.lastName].filter(Boolean).join(' '))}
        ${field('Phone', c.phone)}
        ${field('Company', c.company, true)}
        ${field('Email', c.email, true)}
        ${field('Address', address(c), true)}
      </dl>
    </section>
    <section class="box">
      <h2>Vehicle</h2>
      <dl>
        ${field('Vehicle', [v.year, v.make, v.model].filter(Boolean).join(' '))}
        ${field('Plate', v.licensePlate)}
        ${field('VIN', v.vin, true)}
        ${field('Color', v.color)}
        ${field('Engine', v.engine)}
        ${field('Transmission', v.transmission, true)}
        ${field('Mileage', mileage(wo), true)}
      </dl>
    </section>
  </div>

  <div class="lines">
  <h2>Parts</h2>
  <table>
    <thead><tr><th style="width:1.3in">Part #</th><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Total</th></tr></thead>
    <tbody>${parts}</tbody>
  </table>

  <h2>Labor</h2>
  <table>
    <thead><tr><th style="width:1.3in">Code</th><th>Description</th><th class="num">Hours</th><th class="num">Rate</th><th class="num">Total</th></tr></thead>
    <tbody>${labor}</tbody>
  </table>
  </div>

  <div class="bottom">
    <div class="payments">
      ${payments}
      ${anyUntaxed ? `<p class="note">* Not taxed</p>` : ''}
    </div>
    <table class="totals">
      <tr><td>Parts</td><td class="num">${fmt(partsSubtotal(wo))}</td></tr>
      <tr><td>Labor</td><td class="num">${fmt(laborsSubtotal(wo))}</td></tr>
      <tr><td>Subtotal</td><td class="num">${fmt(subtotal(wo))}</td></tr>
      <tr><td>Sales tax</td><td class="num">${fmt(tax(wo))}</td></tr>
      <tr class="strong"><td>Total</td><td class="num">${fmt(bill(wo))}</td></tr>
      <tr><td>Payments</td><td class="num">${totalPayments(wo) > 0 ? '−' : ''}${fmt(totalPayments(wo))}</td></tr>
      <tr class="due"><td>Amount due</td><td class="num">${fmt(balance(wo))}</td></tr>
    </table>
  </div>
</div>
</body>
</html>`
}

/** A file name like "Work Order 00012 - Doe.pdf". */
export function invoiceFileName(wo: WorkOrder): string {
  const who = (wo.customer.lastName || wo.customer.company || wo.customer.firstName).replace(/[\\/:*?"<>|]/g, '').trim()
  const number = wo.id > 0 ? String(wo.id).padStart(5, '0') : 'Draft'
  return `Work Order ${number}${who ? ` - ${who}` : ''}.pdf`
}
