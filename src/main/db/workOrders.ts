import type { Database } from 'better-sqlite3'
import { bill, billFromSums } from '../../shared/billing'
import { PAYMENT_METHODS, type MonthlyIncome, type Payment, type PaymentMethod, type WorkOrder, type WorkOrderFilter, type WorkOrderStats } from '../../shared/types'
import { childRows, LABOR_COLUMNS, laborValues, PART_COLUMNS, partValues, snapshotParams, SNAPSHOT_COLUMNS, syncLines, textSearch, toLabor, toPart, toSnapshot, type LineTable, type Row } from './documents'
import { dbDatePlusDays, fromDbDate, prefixMatches, str, toDbDate, today } from './sql'

const HEADER_COLUMNS = `work_order_id, date_created, date_completed, ${SNAPSHOT_COLUMNS}, tax_rate`

/** SQL condition: the work order (`work_order_id` in scope) hasn't been voided. */
const NOT_VOIDED = 'work_order_id not in (select work_order_id from work_order_void)'

const PARTS: LineTable = { table: 'work_order_item', idColumn: 'work_order_item_id', parentColumn: 'work_order_id' }
const LABOR: LineTable = { table: 'work_order_labor', idColumn: 'work_order_labor_id', parentColumn: 'work_order_id' }
const PAYMENTS: LineTable = { table: 'work_order_payment', idColumn: 'work_order_payment_id', parentColumn: 'work_order_id' }

function toWorkOrder(r: Row): WorkOrder {
  return {
    id: Number(r.work_order_id),
    dateCreated: fromDbDate(r.date_created) ?? today(),
    dateCompleted: fromDbDate(r.date_completed),
    ...toSnapshot(r),
    taxRate: Number(r.tax_rate ?? 0),
    dateVoided: fromDbDate(r.date_voided),
    parts: [],
    labor: [],
    payments: []
  }
}

function headerParams(wo: WorkOrder): unknown[] {
  return [toDbDate(wo.dateCreated), wo.dateCompleted ? toDbDate(wo.dateCompleted) : null, ...snapshotParams(wo.customer, wo.vehicle), wo.taxRate]
}

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
    const ids = orders.map((wo) => wo.id)
    for (const r of childRows(this.db, PARTS, ids)) byId.get(Number(r.work_order_id))?.parts.push(toPart(r, PARTS.idColumn))
    for (const r of childRows(this.db, LABOR, ids)) byId.get(Number(r.work_order_id))?.labor.push(toLabor(r, LABOR.idColumn))
    for (const r of childRows(this.db, PAYMENTS, ids)) byId.get(Number(r.work_order_id))?.payments.push(toPayment(r))
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
    const search = textSearch(f.text, 'work_order_id', /^#?(\d+)$/)
    clauses.push(...search.clauses)
    args.push(...search.params)
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

      syncLines(this.db, PARTS, id, wo.parts, PART_COLUMNS, partValues)
      syncLines(this.db, LABOR, id, wo.labor, LABOR_COLUMNS, laborValues)
      syncLines(this.db, PAYMENTS, id, wo.payments, ['date_of_payment', 'type', 'amount'], (p) => [toDbDate(p.date), p.method, p.amount])
      return id
    })()
    return this.getById(id) as WorkOrder
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
