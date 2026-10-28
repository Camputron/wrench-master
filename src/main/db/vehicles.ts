import type { Database } from 'better-sqlite3'
import type { Vehicle, VehicleFilter, VehicleSuggestions } from '../../shared/types'
import { prefixMatches, str } from './sql'

const COLUMNS = 'vehicle_id, customer_id, vin, year, make, model, license_plate, color, engine, transmission'

type Row = Record<string, unknown>

function toVehicle(r: Row): Vehicle {
  return {
    id: Number(r.vehicle_id),
    customerId: Number(r.customer_id),
    vin: str(r.vin),
    year: str(r.year),
    make: str(r.make),
    model: str(r.model),
    licensePlate: str(r.license_plate),
    color: str(r.color),
    engine: str(r.engine),
    transmission: str(r.transmission)
  }
}

const params = (v: Vehicle): unknown[] => [v.vin, v.year, v.make, v.model, v.licensePlate, v.color, v.engine, v.transmission]

export class VehicleRepo {
  constructor(private db: Database) {}

  getById(id: number): Vehicle | null {
    const row = this.db.prepare(`select ${COLUMNS} from vehicle where vehicle_id = ?`).get(id) as Row | undefined
    return row ? toVehicle(row) : null
  }

  listByCustomer(customerId: number): Vehicle[] {
    return (this.db.prepare(`select ${COLUMNS} from vehicle where customer_id = ?`).all(customerId) as Row[]).map(toVehicle)
  }

  /** Prefix match on each non-blank field, optionally limited to one customer's vehicles. */
  filter(f: VehicleFilter): Vehicle[] {
    const { clauses, params } = prefixMatches([
      ['vin', f.vin],
      ['year', f.year],
      ['make', f.make],
      ['model', f.model],
      ['license_plate', f.licensePlate],
      ['color', f.color],
      ['engine', f.engine],
      ['transmission', f.transmission]
    ])
    const args: unknown[] = params
    if (f.customerId !== undefined) {
      clauses.push('customer_id = ?')
      args.push(f.customerId)
    }
    const where = clauses.length ? `where ${clauses.join(' and ')}` : ''
    return (this.db.prepare(`select ${COLUMNS} from vehicle ${where}`).all(...args) as Row[]).map(toVehicle)
  }

  /** Returns the saved vehicle, or null if the customer already has a vehicle with the same VIN. */
  create(v: Vehicle): Vehicle | null {
    if (v.vin && this.db.prepare('select 1 from vehicle where customer_id = ? and vin = ?').get(v.customerId, v.vin)) {
      return null
    }
    const { lastInsertRowid } = this.db.prepare('insert into vehicle (vin, year, make, model, license_plate, color, engine, transmission, customer_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...params(v), v.customerId)
    return { ...v, id: Number(lastInsertRowid) }
  }

  update(v: Vehicle): Vehicle {
    this.db.prepare('update vehicle set vin = ?, year = ?, make = ?, model = ?, license_plate = ?, color = ?, engine = ?, transmission = ? where vehicle_id = ?').run(...params(v), v.id)
    return v
  }

  delete(id: number): void {
    this.db.prepare('delete from vehicle where vehicle_id = ?').run(id)
  }

  /** Existing values for autocomplete. */
  suggestions(): VehicleSuggestions {
    const distinct = (column: string): string[] => (this.db.prepare(`select distinct ${column} as v from vehicle where ${column} is not null and ${column} != '' order by ${column}`).all() as { v: unknown }[]).map((r) => str(r.v))
    return {
      year: distinct('year'),
      make: distinct('make'),
      model: distinct('model'),
      color: distinct('color'),
      engine: distinct('engine'),
      transmission: distinct('transmission')
    }
  }
}
