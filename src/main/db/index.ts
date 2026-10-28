import type { Database } from 'better-sqlite3'
import { openDatabase } from './connection'
import { CustomerRepo } from './customers'
import { PartRepo } from './parts'
import { VehicleRepo } from './vehicles'
import { WorkOrderRepo } from './workOrders'

export interface Repos {
  db: Database
  customers: CustomerRepo
  vehicles: VehicleRepo
  parts: PartRepo
  workOrders: WorkOrderRepo
}

export function createRepos(file: string): Repos {
  const db = openDatabase(file)
  return {
    db,
    customers: new CustomerRepo(db),
    vehicles: new VehicleRepo(db),
    parts: new PartRepo(db),
    workOrders: new WorkOrderRepo(db)
  }
}
