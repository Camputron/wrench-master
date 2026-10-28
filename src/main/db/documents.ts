import type { Database } from 'better-sqlite3'
import type { AutoPart, Customer, Labor, WorkOrderVehicle } from '../../shared/types'
import { likeEscape, str, toDbBool } from './sql'

/** Shared by work orders and estimates: both store a copy of the customer, vehicle, parts, and labor. */

export type Row = Record<string, unknown>

/** The customer and vehicle columns, in the order `snapshotParams` returns their values. */
export const SNAPSHOT_COLUMNS = `customer_id,
  customer_first_name, customer_last_name, customer_phone, customer_email, customer_company,
  customer_address, customer_city, customer_state, customer_zip,
  vehicle_vin, vehicle_year, vehicle_make, vehicle_model, vehicle_license_plate, vehicle_color,
  vehicle_engine, vehicle_transmission, vehicle_mileage_in, vehicle_mileage_out`

export function toSnapshot(r: Row): { customer: Customer; vehicle: WorkOrderVehicle } {
  return {
    customer: {
      id: Number(r.customer_id ?? 0),
      firstName: str(r.customer_first_name),
      lastName: str(r.customer_last_name),
      phone: str(r.customer_phone),
      email: str(r.customer_email),
      company: str(r.customer_company),
      street: str(r.customer_address),
      city: str(r.customer_city),
      state: str(r.customer_state),
      zip: str(r.customer_zip)
    },
    vehicle: {
      vin: str(r.vehicle_vin),
      year: str(r.vehicle_year),
      make: str(r.vehicle_make),
      model: str(r.vehicle_model),
      licensePlate: str(r.vehicle_license_plate),
      color: str(r.vehicle_color),
      engine: str(r.vehicle_engine),
      transmission: str(r.vehicle_transmission),
      mileageIn: str(r.vehicle_mileage_in),
      mileageOut: str(r.vehicle_mileage_out)
    }
  }
}

export function snapshotParams(c: Customer, v: WorkOrderVehicle): unknown[] {
  return [c.id, c.firstName, c.lastName, c.phone, c.email, c.company, c.street, c.city, c.state, c.zip, v.vin, v.year, v.make, v.model, v.licensePlate, v.color, v.engine, v.transmission, v.mileageIn, v.mileageOut]
}

export const toPart = (r: Row, idColumn: string): AutoPart => ({
  id: Number(r[idColumn]),
  name: str(r.item_name),
  desc: str(r.item_desc),
  retailPrice: Number(r.item_retail_price ?? 0),
  listPrice: Number(r.item_list_price ?? 0),
  quantity: Number(r.item_quantity ?? 0),
  taxable: Boolean(r.item_taxable)
})

export const toLabor = (r: Row, idColumn: string): Labor => ({
  id: Number(r[idColumn]),
  code: str(r.labor_code),
  desc: str(r.labor_desc),
  billedHrs: Number(r.labor_billed_hrs ?? 0),
  rate: Number(r.labor_rate ?? 0),
  taxable: Boolean(r.labor_taxable)
})

/** A line table and the column linking it to its document, e.g. `work_order_item` by `work_order_id`. */
export interface LineTable {
  table: string
  idColumn: string
  parentColumn: string
}

/** Rows of `lines` belonging to any of `parentIds`, in the order they were added. */
export function childRows(db: Database, lines: LineTable, parentIds: number[]): Row[] {
  return db.prepare(`select * from ${lines.table} where ${lines.parentColumn} in (select value from json_each(?)) order by ${lines.idColumn}`).all(JSON.stringify(parentIds)) as Row[]
}

/**
 * Makes the stored lines of a document match `items`: lines with `id <= 0` are inserted, existing ones
 * updated, and lines no longer present are deleted. Run inside the document's save transaction.
 */
export function syncLines<T extends { id: number }>(db: Database, lines: LineTable, parentId: number, items: T[], columns: string[], values: (item: T) => unknown[]): void {
  const keep = items.filter((l) => l.id > 0).map((l) => l.id)
  db.prepare(`delete from ${lines.table} where ${lines.parentColumn} = ? and ${lines.idColumn} not in (select value from json_each(?))`).run(parentId, JSON.stringify(keep))
  const insert = db.prepare(`insert into ${lines.table} (${columns.join(', ')}, ${lines.parentColumn}) values (${columns.map(() => '?').join(', ')}, ?)`)
  const update = db.prepare(`update ${lines.table} set ${columns.map((c) => `${c} = ?`).join(', ')} where ${lines.parentColumn} = ? and ${lines.idColumn} = ?`)
  for (const item of items) {
    if (item.id > 0) update.run(...values(item), parentId, item.id)
    else insert.run(...values(item), parentId)
  }
}

export const PART_COLUMNS = ['item_name', 'item_desc', 'item_retail_price', 'item_list_price', 'item_quantity', 'item_taxable']
export const partValues = (p: AutoPart): unknown[] => [p.name, p.desc, p.retailPrice, p.listPrice, p.quantity, toDbBool(p.taxable)]
export const LABOR_COLUMNS = ['labor_code', 'labor_desc', 'labor_billed_hrs', 'labor_rate', 'labor_taxable']
export const laborValues = (l: Labor): unknown[] => [l.code, l.desc, l.billedHrs, l.rate, toDbBool(l.taxable)]

/** Columns searched by the list's search box: the start of the customer's name or company, or the vehicle. */
const SEARCH_COLUMNS = ['customer_first_name', 'customer_last_name', 'customer_company', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_license_plate', 'vehicle_vin']

/**
 * A clause per word of `text`: each word must match the start of a searchable column, or be the
 * document's number (`numberPattern` picks out a number, e.g. "#12" or "E-12").
 */
export function textSearch(text: string | undefined, idColumn: string, numberPattern: RegExp): { clauses: string[]; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  for (const word of (text ?? '').trim().split(/\s+/).filter(Boolean)) {
    const prefix = likeEscape(word) + '%'
    const number = numberPattern.exec(word)
    const id = number ? Number(number[1]) : null
    clauses.push(`(${SEARCH_COLUMNS.map((c) => `${c} like ? escape '\\'`).join(' or ')}${id !== null ? ` or ${idColumn} = ?` : ''})`)
    params.push(...SEARCH_COLUMNS.map(() => prefix))
    if (id !== null) params.push(id)
  }
  return { clauses, params }
}
