import type { Database } from 'better-sqlite3'
import type { PartSuggestion } from '../../shared/types'
import { likeEscape, str, toDbBool } from './sql'

type Row = Record<string, unknown>

function toSuggestion(r: Row): PartSuggestion {
  return {
    name: str(r.item_name),
    desc: str(r.desc),
    retailPrice: Number(r.retail_price ?? 0),
    listPrice: Number(r.list_price ?? 0),
    quantity: Number(r.quantity ?? 0),
    taxable: Boolean(r.taxable)
  }
}

/** The auto part catalog (`item` table), keyed by part name. */
export class PartRepo {
  constructor(private db: Database) {}

  /** Parts whose name or description contains `query`. */
  search(query: string, limit = 50): PartSuggestion[] {
    const pattern = `%${likeEscape(query)}%`
    const rows = this.db.prepare(`select * from item where item_name like ? escape '\\' or desc like ? escape '\\' order by item_name limit ?`).all(pattern, pattern, limit) as Row[]
    return rows.map(toSuggestion)
  }

  /** Adds the part to the catalog, or updates it if a part with the same name exists. */
  remember(p: PartSuggestion): void {
    this.db
      .prepare(
        `insert into item (item_name, desc, retail_price, list_price, taxable, quantity) values (?, ?, ?, ?, ?, ?)
         on conflict(item_name) do update set
           desc = excluded.desc, retail_price = excluded.retail_price, list_price = excluded.list_price,
           taxable = excluded.taxable, quantity = excluded.quantity`
      )
      .run(p.name, p.desc, p.retailPrice, p.listPrice, toDbBool(p.taxable), p.quantity)
  }
}
