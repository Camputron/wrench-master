import type { Database } from 'better-sqlite3'
import { estimateNumber } from '../../shared/estimates'
import type { Estimate, EstimateFilter, EstimateStatus, IsoDate, WorkOrder } from '../../shared/types'
import { childRows, LABOR_COLUMNS, laborValues, PART_COLUMNS, partValues, snapshotParams, SNAPSHOT_COLUMNS, syncLines, textSearch, toLabor, toPart, toSnapshot, type LineTable, type Row } from './documents'
import { fromDbDate, toDbDate, today } from './sql'
import type { WorkOrderRepo } from './workOrders'

const HEADER_COLUMNS = `estimate_id, date_created, date_valid_until, status, work_order_id, ${SNAPSHOT_COLUMNS}, tax_rate`
const SAVED_COLUMNS = `date_created, date_valid_until, ${SNAPSHOT_COLUMNS}, tax_rate`

const PARTS: LineTable = { table: 'estimate_item', idColumn: 'estimate_item_id', parentColumn: 'estimate_id' }
const LABOR: LineTable = { table: 'estimate_labor', idColumn: 'estimate_labor_id', parentColumn: 'estimate_id' }

const STATUSES: EstimateStatus[] = ['open', 'accepted', 'declined']

/** An estimate number as typed in a search: "12", "E12", "E-00012", "#12". */
const NUMBER = /^(?:#|e-?)?(\d+)$/i

function toEstimate(r: Row): Estimate {
  const created = fromDbDate(r.date_created) ?? today()
  const status = String(r.status) as EstimateStatus
  return {
    id: Number(r.estimate_id),
    dateCreated: created,
    validUntil: fromDbDate(r.date_valid_until) ?? created,
    ...toSnapshot(r),
    taxRate: Number(r.tax_rate ?? 0),
    parts: [],
    labor: [],
    status: STATUSES.includes(status) ? status : 'open',
    workOrderId: r.work_order_id === null || r.work_order_id === undefined ? null : Number(r.work_order_id)
  }
}

function savedParams(e: Estimate): unknown[] {
  return [toDbDate(e.dateCreated), toDbDate(e.validUntil), ...snapshotParams(e.customer, e.vehicle), e.taxRate]
}

export class EstimateRepo {
  constructor(
    private db: Database,
    private workOrders: WorkOrderRepo
  ) {}

  /** Loads estimates matching `where`, newest first, with their parts and labor. */
  private load(where: string, params: unknown[], limit = 0): Estimate[] {
    const sql = `select ${HEADER_COLUMNS} from estimate ${where} order by date_created desc, estimate_id desc` + (limit > 0 ? ` limit ${Math.floor(limit)}` : '')
    const estimates = (this.db.prepare(sql).all(...params) as Row[]).map(toEstimate)
    if (estimates.length === 0) return estimates
    const byId = new Map(estimates.map((e) => [e.id, e]))
    const ids = estimates.map((e) => e.id)
    for (const r of childRows(this.db, PARTS, ids)) byId.get(Number(r.estimate_id))?.parts.push(toPart(r, PARTS.idColumn))
    for (const r of childRows(this.db, LABOR, ids)) byId.get(Number(r.estimate_id))?.labor.push(toLabor(r, LABOR.idColumn))
    return estimates
  }

  getById(id: number): Estimate | null {
    return this.load('where estimate_id = ?', [id])[0] ?? null
  }

  /** Estimates with the given ids, in the same order. Missing ids are skipped. */
  getByIds(ids: number[]): Estimate[] {
    const found = new Map(this.load('where estimate_id in (select value from json_each(?))', [JSON.stringify(ids)]).map((e) => [e.id, e]))
    return ids.flatMap((id) => found.get(id) ?? [])
  }

  /** Newest first. `limit <= 0` returns every estimate. */
  list(limit = 0): Estimate[] {
    return this.load('', [], limit)
  }

  listByCustomer(customerId: number): Estimate[] {
    return this.load('where customer_id = ?', [customerId])
  }

  /** Every word of `text` must match (see `textSearch`); `status` 'expired' means open and past its valid-until date. */
  filter(f: EstimateFilter, now: IsoDate = today()): Estimate[] {
    const { clauses, params } = textSearch(f.text, 'estimate_id', NUMBER)
    if (f.status === 'expired') {
      clauses.push(`status = 'open' and date_valid_until < ?`)
      params.push(toDbDate(now))
    } else if (f.status) {
      clauses.push('status = ?')
      params.push(f.status)
    }
    return this.load(clauses.length ? `where ${clauses.join(' and ')}` : '', params, f.limit)
  }

  /**
   * Inserts or updates the estimate and its parts and labor (see `syncLines`). Status and the linked work
   * order aren't changed here; see `setStatus` and `convert`. Returns the estimate as stored.
   */
  save(e: Estimate): Estimate {
    const id = this.db.transaction((): number => {
      let id = e.id
      if (id <= 0) {
        const columns = SAVED_COLUMNS
        id = Number(
          this.db
            .prepare(
              `insert into estimate (${columns}) values (${savedParams(e)
                .map(() => '?')
                .join(', ')})`
            )
            .run(...savedParams(e)).lastInsertRowid
        )
      } else {
        const current = this.getById(id)
        if (!current) throw new Error(`Estimate ${estimateNumber(id)} no longer exists.`)
        if (current.status === 'accepted') throw new Error(`Estimate ${estimateNumber(id)} was accepted and can’t be changed.`)
        const sets = SAVED_COLUMNS.split(',').map((c) => `${c.trim()} = ?`)
        this.db.prepare(`update estimate set ${sets.join(', ')} where estimate_id = ?`).run(...savedParams(e), id)
      }
      syncLines(this.db, PARTS, id, e.parts, PART_COLUMNS, partValues)
      syncLines(this.db, LABOR, id, e.labor, LABOR_COLUMNS, laborValues)
      return id
    })()
    return this.getById(id) as Estimate
  }

  /** Declines an open estimate, or reopens a declined one. Accepted estimates can't change. */
  setStatus(id: number, status: Exclude<EstimateStatus, 'accepted'>): Estimate | null {
    this.db.prepare(`update estimate set status = ? where estimate_id = ? and status != 'accepted'`).run(status, id)
    return this.getById(id)
  }

  /**
   * Turns an open estimate into a new work order (dated `date`, with copies of its customer, vehicle,
   * parts, and labor) and marks the estimate accepted, linked to it. All or nothing. Returns the work order.
   */
  convert(id: number, date: IsoDate = today()): WorkOrder {
    return this.db.transaction((): WorkOrder => {
      const e = this.getById(id)
      if (!e) throw new Error(`Estimate ${estimateNumber(id)} no longer exists.`)
      if (e.status !== 'open') throw new Error(`Estimate ${estimateNumber(id)} is ${e.status}; only open estimates can be accepted.`)
      const workOrder = this.workOrders.save({
        id: 0,
        dateCreated: date,
        dateCompleted: null,
        dateVoided: null,
        customer: e.customer,
        vehicle: { ...e.vehicle, mileageOut: '' },
        taxRate: e.taxRate,
        parts: e.parts.map((p) => ({ ...p, id: 0 })),
        labor: e.labor.map((l) => ({ ...l, id: 0 })),
        payments: []
      })
      this.db.prepare(`update estimate set status = 'accepted', work_order_id = ? where estimate_id = ?`).run(workOrder.id, id)
      return workOrder
    })()
  }

  /** Deletes an open or declined estimate. Accepted ones are kept as the record of what was quoted. */
  delete(id: number): void {
    this.db.transaction(() => {
      if (this.getById(id)?.status === 'accepted') throw new Error(`Estimate ${estimateNumber(id)} was accepted, so it’s kept as the record of the quote.`)
      for (const table of ['estimate_item', 'estimate_labor', 'estimate']) this.db.prepare(`delete from ${table} where estimate_id = ?`).run(id)
    })()
  }
}
