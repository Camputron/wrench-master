import type { Database } from 'better-sqlite3'
import { openDatabase } from './connection'
import { CustomerRepo } from './customers'
import { EstimateRepo } from './estimates'
import { PartRepo } from './parts'
import { VehicleRepo } from './vehicles'
import { WorkOrderRepo } from './workOrders'

export interface Repos {
  db: Database
  customers: CustomerRepo
  vehicles: VehicleRepo
  parts: PartRepo
  workOrders: WorkOrderRepo
  estimates: EstimateRepo
}

export function createRepos(file: string): Repos {
  const db = openDatabase(file)
  const workOrders = new WorkOrderRepo(db)
  return {
    db,
    customers: new CustomerRepo(db),
    vehicles: new VehicleRepo(db),
    parts: new PartRepo(db),
    workOrders,
    estimates: new EstimateRepo(db, workOrders)
  }
}
