import ExcelJS from 'exceljs'
import { balance, bill, laborSubtotal, partSubtotal, tax, totalPayments } from '../shared/billing'
import { stateByKey } from '../shared/states'
import type { WorkOrder } from '../shared/types'
import type { Repos } from './db'

/**
 * Excel exports (File > Export). Unlike the Java app, which dumped raw database columns, these use
 * readable headers, real dates and money formats, and include each work order's totals.
 */

export type ExportKind = 'customers' | 'vehicles' | 'workOrders' | 'parts'

export const EXPORT_FILE_NAMES: Record<ExportKind, string> = {
  customers: 'customers.xlsx',
  vehicles: 'vehicles.xlsx',
  workOrders: 'work-orders.xlsx',
  parts: 'parts-catalog.xlsx'
}

type Column = { header: string; key: string; width: number; format?: 'money' | 'date' | 'percent' }

const FORMATS = { money: '$#,##0.00', date: 'mm/dd/yyyy', percent: '0.000%' }

/** `YYYY-MM-DD` to a Date at UTC midnight, which Excel shows as that calendar day. */
const excelDate = (iso: string | null): Date | null => (iso ? new Date(`${iso}T00:00:00Z`) : null)

function addSheet(book: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[]): void {
  const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.format ? { numFmt: FORMATS[c.format] } : {} }))
  sheet.addRows(rows)
  sheet.getRow(1).font = { bold: true }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
}

const name = (first: string, last: string): string => [first, last].filter(Boolean).join(' ')
const stateAbbr = (key: string): string => stateByKey(key)?.abbreviation ?? ''

/** Builds the workbook for `kind` and writes it to `path`. Resolves to the number of rows exported. */
export async function exportToExcel(kind: ExportKind, repos: Repos, path: string): Promise<number> {
  const book = new ExcelJS.Workbook()
  book.creator = 'Wrench Master'
  book.created = new Date()
  let count = 0

  if (kind === 'customers') {
    const customers = repos.customers.list()
    count = customers.length
    addSheet(
      book,
      'Customers',
      [
        { header: 'Customer #', key: 'id', width: 11 },
        { header: 'First name', key: 'firstName', width: 14 },
        { header: 'Last name', key: 'lastName', width: 16 },
        { header: 'Company', key: 'company', width: 24 },
        { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Street', key: 'street', width: 26 },
        { header: 'City', key: 'city', width: 16 },
        { header: 'State', key: 'state', width: 7 },
        { header: 'ZIP', key: 'zip', width: 8 }
      ],
      customers.map((c) => ({ ...c, state: stateAbbr(c.state) }))
    )
  }

  if (kind === 'vehicles') {
    const owners = new Map(repos.customers.list().map((c) => [c.id, c]))
    const vehicles = repos.vehicles.filter({})
    count = vehicles.length
    addSheet(
      book,
      'Vehicles',
      [
        { header: 'Owner', key: 'owner', width: 22 },
        { header: 'Owner company', key: 'company', width: 22 },
        { header: 'Year', key: 'year', width: 7 },
        { header: 'Make', key: 'make', width: 12 },
        { header: 'Model', key: 'model', width: 16 },
        { header: 'VIN', key: 'vin', width: 20 },
        { header: 'Plate', key: 'licensePlate', width: 11 },
        { header: 'Color', key: 'color', width: 10 },
        { header: 'Engine', key: 'engine', width: 14 },
        { header: 'Transmission', key: 'transmission', width: 18 }
      ],
      vehicles.map((v) => {
        const owner = owners.get(v.customerId)
        return { ...v, owner: owner ? name(owner.firstName, owner.lastName) : '', company: owner?.company ?? '' }
      })
    )
  }

  if (kind === 'workOrders') {
    const workOrders: WorkOrder[] = repos.workOrders.list()
    count = workOrders.length
    addSheet(
      book,
      'Work orders',
      [
        { header: 'Work order #', key: 'id', width: 12 },
        { header: 'Created', key: 'created', width: 11, format: 'date' },
        { header: 'Completed', key: 'completed', width: 11, format: 'date' },
        { header: 'Voided', key: 'voided', width: 11, format: 'date' },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Company', key: 'company', width: 20 },
        { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Vehicle', key: 'vehicle', width: 24 },
        { header: 'VIN', key: 'vin', width: 20 },
        { header: 'Plate', key: 'plate', width: 10 },
        { header: 'Mileage in', key: 'mileageIn', width: 11 },
        { header: 'Mileage out', key: 'mileageOut', width: 11 },
        { header: 'Tax rate', key: 'taxRate', width: 9, format: 'percent' },
        { header: 'Tax', key: 'tax', width: 11, format: 'money' },
        { header: 'Total', key: 'total', width: 12, format: 'money' },
        { header: 'Paid', key: 'paid', width: 12, format: 'money' },
        { header: 'Balance', key: 'balance', width: 12, format: 'money' }
      ],
      workOrders.map((wo) => ({
        id: wo.id,
        created: excelDate(wo.dateCreated),
        completed: excelDate(wo.dateCompleted),
        voided: excelDate(wo.dateVoided),
        customer: name(wo.customer.firstName, wo.customer.lastName),
        company: wo.customer.company,
        phone: wo.customer.phone,
        vehicle: [wo.vehicle.year, wo.vehicle.make, wo.vehicle.model].filter(Boolean).join(' '),
        vin: wo.vehicle.vin,
        plate: wo.vehicle.licensePlate,
        mileageIn: wo.vehicle.mileageIn ? Number(wo.vehicle.mileageIn) || wo.vehicle.mileageIn : null,
        mileageOut: wo.vehicle.mileageOut ? Number(wo.vehicle.mileageOut) || wo.vehicle.mileageOut : null,
        taxRate: wo.taxRate,
        tax: round(tax(wo)),
        total: round(bill(wo)),
        paid: round(totalPayments(wo)),
        balance: round(balance(wo))
      }))
    )
    addSheet(
      book,
      'Parts',
      [
        { header: 'Work order #', key: 'workOrder', width: 12 },
        { header: 'Part #', key: 'name', width: 16 },
        { header: 'Description', key: 'desc', width: 30 },
        { header: 'Qty', key: 'quantity', width: 6 },
        { header: 'Price', key: 'retailPrice', width: 11, format: 'money' },
        { header: 'Cost', key: 'listPrice', width: 11, format: 'money' },
        { header: 'Taxable', key: 'taxable', width: 9 },
        { header: 'Total', key: 'total', width: 11, format: 'money' }
      ],
      workOrders.flatMap((wo) => wo.parts.map((p) => ({ ...p, workOrder: wo.id, taxable: p.taxable ? 'Yes' : 'No', total: round(partSubtotal(p)) })))
    )
    addSheet(
      book,
      'Labor',
      [
        { header: 'Work order #', key: 'workOrder', width: 12 },
        { header: 'Code', key: 'code', width: 10 },
        { header: 'Description', key: 'desc', width: 40 },
        { header: 'Hours', key: 'billedHrs', width: 7 },
        { header: 'Rate', key: 'rate', width: 10, format: 'money' },
        { header: 'Taxable', key: 'taxable', width: 9 },
        { header: 'Total', key: 'total', width: 11, format: 'money' }
      ],
      workOrders.flatMap((wo) => wo.labor.map((l) => ({ ...l, workOrder: wo.id, taxable: l.taxable ? 'Yes' : 'No', total: round(laborSubtotal(l)) })))
    )
    addSheet(
      book,
      'Payments',
      [
        { header: 'Work order #', key: 'workOrder', width: 12 },
        { header: 'Date', key: 'date', width: 11, format: 'date' },
        { header: 'Method', key: 'method', width: 9 },
        { header: 'Amount', key: 'amount', width: 12, format: 'money' }
      ],
      workOrders.flatMap((wo) => wo.payments.map((p) => ({ workOrder: wo.id, date: excelDate(p.date), method: p.method, amount: p.amount })))
    )
  }

  if (kind === 'parts') {
    const parts = repos.parts.search('', 100_000)
    count = parts.length
    addSheet(
      book,
      'Parts catalog',
      [
        { header: 'Part #', key: 'name', width: 18 },
        { header: 'Description', key: 'desc', width: 34 },
        { header: 'Price', key: 'retailPrice', width: 11, format: 'money' },
        { header: 'Cost', key: 'listPrice', width: 11, format: 'money' },
        { header: 'Taxable', key: 'taxable', width: 9 }
      ],
      parts.map((p) => ({ ...p, taxable: p.taxable ? 'Yes' : 'No' }))
    )
  }

  await book.xlsx.writeFile(path)
  return count
}

const round = (n: number): number => Math.round(n * 100) / 100
