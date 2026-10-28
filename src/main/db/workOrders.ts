import type { Database } from 'better-sqlite3'
import { bill, billFromSums } from '../../shared/billing'
import { PAYMENT_METHODS, type AutoPart, type Labor, type MonthlyIncome, type Payment, type PaymentMethod, type WorkOrder, type WorkOrderFilter, type WorkOrderStats } from '../../shared/types'
import { dbDatePlusDays, fromDbDate, likeEscape, prefixMatches, str, toDbBool, toDbDate, today } from './sql'

type Row = Record<string, unknown>

const HEADER_COLUMNS = `work_order_id, date_created, date_completed, customer_id,
  customer_first_name, customer_last_name, customer_phone, customer_email, customer_company,
  customer_address, customer_city, customer_state, customer_zip,
  vehicle_vin, vehicle_year, vehicle_make, vehicle_model, vehicle_license_plate, vehicle_color,
  vehicle_engine, vehicle_transmission, vehicle_mileage_in, vehicle_mileage_out, tax_rate`

/** SQL condition: the work order (`work_order_id` in scope) hasn't been voided. */
const NOT_VOIDED = 'work_order_id not in (select work_order_id from work_order_void)'

function toWorkOrder(r: Row): WorkOrder {
  return {
    id: Number(r.work_order_id),
    dateCreated: fromDbDate(r.date_created) ?? today(),
    dateCompleted: fromDbDate(r.date_completed),
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
    },
    taxRate: Number(r.tax_rate ?? 0),
    dateVoided: fromDbDate(r.date_voided),
    parts: [],
    labor: [],
    payments: []
  }
}

function headerParams(wo: WorkOrder): unknown[] {
  const { customer: c, vehicle: v } = wo
  return [
    toDbDate(wo.dateCreated),
    wo.dateCompleted ? toDbDate(wo.dateCompleted) : null,
    c.id,
    c.firstName,
    c.lastName,
    c.phone,
    c.email,
    c.company,
    c.street,
    c.city,
    c.state,
    c.zip,
    v.vin,
    v.year,
    v.make,
    v.model,
    v.licensePlate,
    v.color,
    v.engine,
    v.transmission,
    v.mileageIn,
    v.mileageOut,
    wo.taxRate
  ]
}

const toPart = (r: Row): AutoPart => ({
  id: Number(r.work_order_item_id),
  name: str(r.item_name),
  desc: str(r.item_desc),
  retailPrice: Number(r.item_retail_price ?? 0),
  listPrice: Number(r.item_list_price ?? 0),
  quantity: Number(r.item_quantity ?? 0),
  taxable: Boolean(r.item_taxable)
})

const toLabor = (r: Row): Labor => ({
  id: Number(r.work_order_labor_id),
  code: str(r.labor_code),
  desc: str(r.labor_desc),
  billedHrs: Number(r.labor_billed_hrs ?? 0),
  rate: Number(r.labor_rate ?? 0),
  taxable: Boolean(r.labor_taxable)
})

const toPayment = (r: Row): Payment => {
  const type = str(r.type).trim()
  return {
    id: Number(r.work_order_payment_id),
    date: fromDbDate(r.date_of_payment) ?? today(),
    method: (PAYMENT_METHODS as readonly string[]).includes(type) ? (type as PaymentMethod) : 'Cash',
    amount: Number(r.amount ?? 0)
  }
}

export class WorkOrderRepo {
  constructor(private db: Database) {}

  /**
   * Loads work orders matching `where`, with their line items, using one query per table.
   * Ordering follows `orderBy`.
   */
  private load(where: string, params: unknown[], orderBy = 'date_created desc, work_order_id desc', limit = 0): WorkOrder[] {
    const sql = `select ${HEADER_COLUMNS}, date_voided from work_order left join work_order_void using (work_order_id) ${where} order by ${orderBy}` + (limit > 0 ? ` limit ${Math.floor(limit)}` : '')
    const orders = (this.db.prepare(sql).all(...params) as Row[]).map(toWorkOrder)
    if (orders.length === 0) return orders

    const byId = new Map(orders.map((wo) => [wo.id, wo]))
    const ids = JSON.stringify(orders.map((wo) => wo.id))
    const children = (table: string, idColumn: string): Row[] => this.db.prepare(`select * from ${table} where work_order_id in (select value from json_each(?)) order by ${idColumn}`).all(ids) as Row[]

    for (const r of children('work_order_item', 'work_order_item_id')) byId.get(Number(r.work_order_id))?.parts.push(toPart(r))
    for (const r of children('work_order_labor', 'work_order_labor_id')) byId.get(Number(r.work_order_id))?.labor.push(toLabor(r))
    for (const r of children('work_order_payment', 'work_order_payment_id')) byId.get(Number(r.work_order_id))?.payments.push(toPayment(r))
    return orders
  }

  getById(id: number): WorkOrder | null {
    return this.load('where work_order_id = ?', [id])[0] ?? null
  }

  /** Work orders with the given ids, in the same order. Missing ids are skipped. */
  getByIds(ids: number[]): WorkOrder[] {
    const found = new Map(this.load('where work_order_id in (select value from json_each(?))', [JSON.stringify(ids)]).map((wo) => [wo.id, wo]))
    return ids.flatMap((id) => found.get(id) ?? [])
  }

  /** Most recently created first. `limit <= 0` returns every work order. */
  list(limit = 0): WorkOrder[] {
    return this.load('', [], undefined, limit)
  }

  listByCustomer(customerId: number): WorkOrder[] {
    return this.load('where customer_id = ?', [customerId])
  }

  listIncomplete(): WorkOrder[] {
    return this.load(`where date_completed is null and ${NOT_VOIDED}`, [])
  }

  /** Prefix match on each non-blank text field, plus optional id and creation date filters. */
  filter(f: WorkOrderFilter): WorkOrder[] {
    const { clauses, params } = prefixMatches([
      ['customer_first_name', f.firstName],
      ['customer_last_name', f.lastName],
      ['customer_company', f.company],
      ['vehicle_year', f.year],
      ['vehicle_make', f.make],
      ['vehicle_model', f.model]
    ])
    const args: unknown[] = params
    for (const word of (f.text ?? '').trim().split(/\s+/).filter(Boolean)) {
      const prefix = likeEscape(word) + '%'
      const columns = ['customer_first_name', 'customer_last_name', 'customer_company', 'vehicle_year', 'vehicle_make', 'vehicle_model', 'vehicle_license_plate', 'vehicle_vin']
      const id = /^#?\d+$/.test(word) ? Number(word.replace('#', '')) : null
      clauses.push(`(${columns.map((c) => `${c} like ? escape '\\'`).join(' or ')}${id !== null ? ' or work_order_id = ?' : ''})`)
      args.push(...columns.map(() => prefix))
      if (id !== null) args.push(id)
    }
    if (f.status === 'open') clauses.push(`date_completed is null and ${NOT_VOIDED}`)
    if (f.status === 'completed') clauses.push(`date_completed is not null and ${NOT_VOIDED}`)
    if (f.status === 'voided') clauses.push('date_voided is not null')
    if (f.id && f.id > 0) {
      clauses.push('work_order_id = ?')
      args.push(f.id)
    }
    const d = f.date
    if (d) {
      switch (d.mode) {
        case 'exactly':
          clauses.push('date_created >= ? and date_created < ?')
          args.push(toDbDate(d.date), dbDatePlusDays(d.date, 1))
          break
        case 'before':
          clauses.push('date_created < ?')
          args.push(dbDatePlusDays(d.date, 1))
          break
        case 'after':
          clauses.push('date_created >= ?')
          args.push(toDbDate(d.date))
          break
        case 'between':
          clauses.push('date_created >= ? and date_created < ?')
          args.push(toDbDate(d.from), dbDatePlusDays(d.to, 1))
          break
      }
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
    return this.load(where, args, undefined, f.limit)
  }

  /**
   * Inserts or updates the work order and makes its stored parts, labor and payments match the ones given:
   * lines with `id <= 0` are inserted, existing ones updated, and lines no longer present are deleted.
   * Returns the work order as stored.
   */
  save(wo: WorkOrder): WorkOrder {
    const id = this.db.transaction((): number => {
      let id = wo.id
      if (id <= 0) {
        const placeholders = Array(23).fill('?').join(', ')
        const columns = HEADER_COLUMNS.replace('work_order_id,', '')
        id = Number(this.db.prepare(`insert into work_order (${columns}) values (${placeholders})`).run(...headerParams(wo)).lastInsertRowid)
        this.db.prepare(`update counter set value = ? where id = 'work.order.id'`).run(id + 1)
      } else {
        this.db
          .prepare(
            `update work_order set
             date_created = ?, date_completed = ?, customer_id = ?,
             customer_first_name = ?, customer_last_name = ?, customer_phone = ?, customer_email = ?, customer_company = ?,
             customer_address = ?, customer_city = ?, customer_state = ?, customer_zip = ?,
             vehicle_vin = ?, vehicle_year = ?, vehicle_make = ?, vehicle_model = ?, vehicle_license_plate = ?, vehicle_color = ?,
             vehicle_engine = ?, vehicle_transmission = ?, vehicle_mileage_in = ?, vehicle_mileage_out = ?, tax_rate = ?
             where work_order_id = ?`
          )
          .run(...headerParams(wo), id)
      }

      this.syncLines(id, 'work_order_item', 'work_order_item_id', wo.parts, {
        insert: 'insert into work_order_item (item_name, item_desc, item_retail_price, item_list_price, item_quantity, item_taxable, work_order_id) values (?, ?, ?, ?, ?, ?, ?)',
        update: 'update work_order_item set item_name = ?, item_desc = ?, item_retail_price = ?, item_list_price = ?, item_quantity = ?, item_taxable = ? where work_order_id = ? and work_order_item_id = ?',
        params: (p) => [p.name, p.desc, p.retailPrice, p.listPrice, p.quantity, toDbBool(p.taxable)]
      })
      this.syncLines(id, 'work_order_labor', 'work_order_labor_id', wo.labor, {
        insert: 'insert into work_order_labor (labor_code, labor_desc, labor_billed_hrs, labor_rate, labor_taxable, work_order_id) values (?, ?, ?, ?, ?, ?)',
        update: 'update work_order_labor set labor_code = ?, labor_desc = ?, labor_billed_hrs = ?, labor_rate = ?, labor_taxable = ? where work_order_id = ? and work_order_labor_id = ?',
        params: (l) => [l.code, l.desc, l.billedHrs, l.rate, toDbBool(l.taxable)]
      })
      this.syncLines(id, 'work_order_payment', 'work_order_payment_id', wo.payments, {
        insert: 'insert into work_order_payment (date_of_payment, type, amount, work_order_id) values (?, ?, ?, ?)',
        update: 'update work_order_payment set date_of_payment = ?, type = ?, amount = ? where work_order_id = ? and work_order_payment_id = ?',
        params: (p) => [toDbDate(p.date), p.method, p.amount]
      })
      return id
    })()
    return this.getById(id) as WorkOrder
  }

  private syncLines<T extends { id: number }>(workOrderId: number, table: string, idColumn: string, lines: T[], sql: { insert: string; update: string; params: (line: T) => unknown[] }): void {
    const keep = lines.filter((l) => l.id > 0).map((l) => l.id)
    this.db.prepare(`delete from ${table} where work_order_id = ? and ${idColumn} not in (select value from json_each(?))`).run(workOrderId, JSON.stringify(keep))
    const insert = this.db.prepare(sql.insert)
    const update = this.db.prepare(sql.update)
    for (const line of lines) {
      if (line.id > 0) update.run(...sql.params(line), workOrderId, line.id)
      else insert.run(...sql.params(line), workOrderId)
    }
  }

  /** Voids the work order (or restores it, with `voided` false). Returns it as stored. */
  setVoided(id: number, voided: boolean, date = today()): WorkOrder | null {
    if (voided) this.db.prepare('insert or ignore into work_order_void (work_order_id, date_voided) select work_order_id, ? from work_order where work_order_id = ?').run(toDbDate(date), id)
    else this.db.prepare('delete from work_order_void where work_order_id = ?').run(id)
    return this.getById(id)
  }

  delete(id: number): void {
    this.db.transaction(() => {
      for (const table of ['work_order_item', 'work_order_labor', 'work_order_payment', 'work_order_void', 'work_order']) {
        this.db.prepare(`delete from ${table} where work_order_id = ?`).run(id)
      }
    })()
  }

  stats(now = new Date()): WorkOrderStats {
    // Voided work orders are kept for the records but don't count anywhere here.
    const count = (from: Date, to: Date): number => (this.db.prepare(`select count(*) as n from work_order where date_completed >= ? and date_completed < ? and ${NOT_VOIDED}`).get(from.getTime(), to.getTime()) as { n: number }).n
    const y = now.getFullYear()
    const m = now.getMonth()
    const { n: openCount } = this.db.prepare(`select count(*) as n from work_order where date_completed is null and ${NOT_VOIDED}`).get() as { n: number }
    // Sum each work order's lines in SQL rather than loading every line of every work order.
    const sums = this.db
      .prepare(
        `select coalesce(w.tax_rate, 0) as taxRate,
           coalesce((select sum(item_retail_price * item_quantity) from work_order_item i where i.work_order_id = w.work_order_id and not item_taxable), 0)
             + coalesce((select sum(labor_billed_hrs * labor_rate) from work_order_labor l where l.work_order_id = w.work_order_id and not labor_taxable), 0) as untaxed,
           coalesce((select sum(item_retail_price * item_quantity) from work_order_item i where i.work_order_id = w.work_order_id and item_taxable), 0)
             + coalesce((select sum(labor_billed_hrs * labor_rate) from work_order_labor l where l.work_order_id = w.work_order_id and labor_taxable), 0) as taxable,
           coalesce((select sum(amount) from work_order_payment p where p.work_order_id = w.work_order_id), 0) as paid
         from work_order w where w.${NOT_VOIDED}`
      )
      .all() as { taxRate: number; untaxed: number; taxable: number; paid: number }[]
    // Each balance to the cent, as printed on its invoice, so the total matches what customers were billed.
    const owed = sums.map((s) => Math.round((billFromSums(s) - s.paid) * 100) / 100).filter((x) => x > 0)
    return {
      completedThisMonth: count(new Date(y, m, 1), new Date(y, m + 1, 1)),
      completedLastMonth: count(new Date(y, m - 1, 1), new Date(y, m, 1)),
      completedThisYear: count(new Date(y, 0, 1), new Date(y + 1, 0, 1)),
      openCount,
      unpaidCount: owed.length,
      unpaidTotal: Math.round(owed.reduce((a, b) => a + b, 0) * 100) / 100
    }
  }

  /** Years that have completed work orders, newest first. */
  years(): number[] {
    const rows = this.db
      .prepare(
        `select distinct cast(strftime('%Y', date_completed / 1000, 'unixepoch', 'localtime') as integer) as year
         from work_order where date_completed is not null and ${NOT_VOIDED} order by year desc`
      )
      .all() as { year: number }[]
    return rows.map((r) => r.year)
  }

  /**
   * Billed totals per month for `year`. Expected counts work orders by the month they were created;
   * actual counts them by the month they were completed.
   */
  incomeByMonth(year: number): MonthlyIncome[] {
    const from = new Date(year, 0, 1).getTime()
    const to = new Date(year + 1, 0, 1).getTime()
    const orders = this.load(`where ((date_created >= ? and date_created < ?) or (date_completed >= ? and date_completed < ?)) and ${NOT_VOIDED}`, [from, to, from, to])
    const months: MonthlyIncome[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, expected: 0, actual: 0 }))
    const inYear = (d: string | null): boolean => d !== null && Number(d.slice(0, 4)) === year
    const month = (d: string): number => Number(d.slice(5, 7)) - 1
    for (const wo of orders) {
      const total = bill(wo)
      if (inYear(wo.dateCreated)) months[month(wo.dateCreated)].expected += total
      if (wo.dateCompleted && inYear(wo.dateCompleted)) months[month(wo.dateCompleted)].actual += total
    }
    return months
  }
}
