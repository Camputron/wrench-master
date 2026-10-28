import type { Database } from 'better-sqlite3'
import type { Customer, CustomerFilter, CustomerSuggestions } from '../../shared/types'
import { likeEscape, prefixMatches, str } from './sql'

const COLUMNS = 'customer_id, first_name, last_name, phone, email, company, address, city, state, zip'

type Row = Record<string, unknown>

function toCustomer(r: Row): Customer {
  return {
    id: Number(r.customer_id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    phone: str(r.phone),
    email: str(r.email),
    company: str(r.company),
    street: str(r.address),
    city: str(r.city),
    state: str(r.state),
    zip: str(r.zip)
  }
}

const params = (c: Customer): unknown[] => [c.firstName, c.lastName, c.phone, c.email, c.company, c.street, c.city, c.state, c.zip]

export class CustomerRepo {
  constructor(private db: Database) {}

  getById(id: number): Customer | null {
    const row = this.db.prepare(`select ${COLUMNS} from customer where customer_id = ?`).get(id) as Row | undefined
    return row ? toCustomer(row) : null
  }

  /** All customers sorted by last name. `limit <= 0` returns every customer. */
  list(limit = 0): Customer[] {
    const sql = `select ${COLUMNS} from customer order by last_name` + (limit > 0 ? ' limit ?' : '')
    const rows = (limit > 0 ? this.db.prepare(sql).all(limit) : this.db.prepare(sql).all()) as Row[]
    return rows.map(toCustomer)
  }

  /** Prefix match on each non-blank field. */
  filter(f: CustomerFilter): Customer[] {
    const { clauses, params } = prefixMatches([
      ['first_name', f.firstName],
      ['last_name', f.lastName],
      ['phone', f.phone],
      ['email', f.email],
      ['company', f.company],
      ['address', f.street],
      ['city', f.city],
      ['state', f.state],
      ['zip', f.zip]
    ])
    const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
    const rows = this.db.prepare(`select ${COLUMNS} from customer ${where} order by last_name`).all(...params) as Row[]
    return rows.map(toCustomer)
  }

  /**
   * Customers matching every word in `query`. A word matches the start of a first name, last name,
   * company, email, city, or ZIP, or appears anywhere in the street or phone number (ignoring dashes).
   * Sorted by last name, then first name.
   */
  search(query: string, limit = 200): Customer[] {
    const words = query.trim().split(/\s+/).filter(Boolean)
    const clauses: string[] = []
    const params: unknown[] = []
    for (const word of words) {
      const prefix = likeEscape(word) + '%'
      const anywhere = '%' + likeEscape(word) + '%'
      const digits = word.replace(/\D/g, '')
      clauses.push(
        `(first_name like ? escape '\\' or last_name like ? escape '\\' or company like ? escape '\\' or email like ? escape '\\'
          or city like ? escape '\\' or zip like ? escape '\\' or address like ? escape '\\'` +
          (digits ? ` or replace(replace(replace(replace(phone, '-', ''), ' ', ''), '(', ''), ')', '') like ?` : '') +
          ')'
      )
      params.push(prefix, prefix, prefix, prefix, prefix, prefix, anywhere)
      if (digits) params.push('%' + digits + '%')
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
    const rows = this.db.prepare(`select ${COLUMNS} from customer ${where} order by last_name collate nocase, first_name collate nocase limit ?`).all(...params, limit) as Row[]
    return rows.map(toCustomer)
  }

  /** True if a customer with exactly the same details already exists. */
  exists(c: Customer): boolean {
    const row = this.db
      .prepare(
        `select 1 from customer
         where first_name = ? and last_name = ? and phone = ? and email = ? and company = ?
         and address = ? and city = ? and state = ? and zip = ?`
      )
      .get(...params(c))
    return row !== undefined
  }

  /** Returns the saved customer, or null if an identical customer already exists. */
  create(c: Customer): Customer | null {
    if (this.exists(c)) return null
    const { lastInsertRowid } = this.db.prepare('insert into customer (first_name, last_name, phone, email, company, address, city, state, zip) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...params(c))
    return { ...c, id: Number(lastInsertRowid) }
  }

  update(c: Customer): Customer {
    this.db
      .prepare(
        `update customer set first_name = ?, last_name = ?, phone = ?, email = ?, company = ?,
         address = ?, city = ?, state = ?, zip = ? where customer_id = ?`
      )
      .run(...params(c), c.id)
    return c
  }

  /** Deletes the customer and their vehicles. Work orders keep their own copy of the customer's details. */
  delete(id: number): void {
    this.db.transaction(() => {
      this.db.prepare('delete from vehicle where customer_id = ?').run(id)
      this.db.prepare('delete from customer where customer_id = ?').run(id)
    })()
  }

  /** Existing values for autocomplete. */
  suggestions(): CustomerSuggestions {
    const distinct = (column: string): string[] => (this.db.prepare(`select distinct ${column} as v from customer where ${column} is not null and ${column} != '' order by ${column}`).all() as { v: unknown }[]).map((r) => str(r.v))
    return {
      company: distinct('company'),
      street: distinct('address'),
      city: distinct('city'),
      zip: distinct('zip')
    }
  }
}
