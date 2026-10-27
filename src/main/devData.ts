import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { bill } from '../shared/billing'
import type { AutoPart, Customer, Labor, Payment, PaymentMethod, Vehicle, WorkOrder } from '../shared/types'
import { createRepos, type Repos } from './db'

/**
 * Demo data for development (`npm run db:seed`, `db:drop`, `db:reset`). Only ever used with the dev
 * data folder; see index.ts. Seeding goes through the normal repositories, so the data is exactly
 * what the app itself would store. It's deterministic, with dates relative to today.
 */

export type DevDbAction = 'seed' | 'drop' | 'reset'

const FIRST = ['Maria', 'James', 'Wei', 'Priya', 'Carlos', 'Aisha', 'Tom', 'Sofia', 'Dmitri', 'Grace', 'Luis', 'Hannah', 'Kwame', 'Elena', 'Raj', 'Nora', 'Omar', 'Julia', 'Sam', 'Tina']
const LAST = ['Garcia', 'Chen', 'Patel', 'Johnson', "O'Brien", 'Kim', 'Rossi', 'Nguyen', 'Okafor', 'Silva', 'Schmidt', 'Cohen', 'Rivera', 'Haddad', 'Novak', 'Mendez']
const COMPANIES = ['Queens Plumbing Co', 'Flushing Florist', 'Bayside Bakery', 'Metro Courier LLC']
const STREETS = ['Main St', 'Northern Blvd', 'Roosevelt Ave', 'Kissena Blvd', 'Union Tpke', 'Francis Lewis Blvd', 'Bell Blvd', 'Parsons Blvd']
const CITIES: [string, string][] = [
  ['Flushing', '11355'],
  ['Bayside', '11361'],
  ['Fresh Meadows', '11365'],
  ['Whitestone', '11357'],
  ['Jamaica', '11432']
]
const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Blue', 'Red', 'Green']
const VEHICLES: [number, string, string, string, string][] = [
  [2012, 'Honda', 'Accord', '2.4L I4', '5-Speed Automatic'],
  [2016, 'Toyota', 'Camry', '2.5L I4', '6-Speed Automatic'],
  [2019, 'Ford', 'F-150', '3.5L V6', '10-Speed Automatic'],
  [2015, 'Nissan', 'Altima', '2.5L I4', 'CVT'],
  [2018, 'Subaru', 'Outback', '2.5L H4', 'CVT'],
  [2014, 'Chevrolet', 'Silverado 1500', '5.3L V8', '6-Speed Automatic'],
  [2020, 'Hyundai', 'Elantra', '2.0L I4', 'CVT'],
  [2011, 'BMW', '328i', '3.0L I6', '6-Speed Automatic'],
  [2017, 'Jeep', 'Grand Cherokee', '3.6L V6', '8-Speed Automatic'],
  [2013, 'Toyota', 'Sienna', '3.5L V6', '6-Speed Automatic'],
  [2021, 'Tesla', 'Model 3', 'Electric', '1-Speed Automatic'],
  [2010, 'Ford', 'E-350', '5.4L V8', '5-Speed Automatic']
]
/** [description, part number, price, cost, taxable] */
const PARTS: [string, string, number, number, boolean][] = [
  ['Brake pads front', 'BRAEPADSFROT', 89.99, 42.5, true],
  ['Brake rotors front (pair)', 'BRAERORS', 159.99, 78, true],
  ['Oil filter', 'OILFIER', 12.99, 4.25, true],
  ['Synthetic oil 5qt', 'SYNTHC5QT', 42.99, 21, true],
  ['Air filter', 'AIRFIER', 24.99, 9.5, true],
  ['Cabin air filter', 'CABNAIRFIER', 29.99, 11, true],
  ['Wiper blades (pair)', 'WIPEBLAES', 34.99, 14, true],
  ['Battery 12V', 'BATTERY12V', 189.99, 110, true],
  ['Spark plug', 'SPAKPLUG', 11.99, 4.8, true],
  ['Serpentine belt', 'SENTBELT', 49.99, 22, true],
  ['Coolant 1 gal', 'COOLANT1GAL', 24.99, 10, true],
  ['Tire disposal fee', 'TIREDIEFEE', 4.0, 0, false],
  ['State inspection sticker', 'STATINSPSTER', 21.0, 21, false]
]
const LABOR = [
  'Oil and filter change',
  'Front brake service',
  'Replace battery and test charging system',
  'NYS safety and emissions inspection',
  'Diagnose check engine light',
  'Replace serpentine belt',
  'Tune-up: replace spark plugs',
  'Cooling system flush',
  'Replace wiper blades and air filters'
]

/** Small deterministic random generator so every seed produces the same data. */
function makeRandom(seed: number): { next: () => number; pick: <T>(list: readonly T[]) => T; int: (min: number, max: number) => number; chance: (p: number) => boolean } {
  let state = seed
  const next = (): number => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
  return {
    next,
    pick: (list) => list[Math.floor(next() * list.length)],
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p
  }
}

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, days: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'

export interface SeedSummary {
  customers: number
  vehicles: number
  workOrders: number
  open: number
  parts: number
}

export function seedDemoData(repos: Repos, taxRate: number, laborRate: number, today = new Date()): SeedSummary {
  const r = makeRandom(20260601)
  const owners: { customer: Customer; vehicles: Vehicle[] }[] = []
  let summary: SeedSummary = { customers: 0, vehicles: 0, workOrders: 0, open: 0, parts: 0 }

  repos.db.transaction(() => {
    for (const [desc, name, retailPrice, listPrice, taxable] of PARTS) repos.parts.remember({ name, desc, retailPrice, listPrice, quantity: 1, taxable })

    for (let i = 0; i < 28; i++) {
      const isCompany = i < COMPANIES.length
      const firstName = r.pick(FIRST)
      const lastName = r.pick(LAST)
      const [city, zip] = r.pick(CITIES)
      const customer = repos.customers.create({
        id: 0,
        firstName,
        lastName,
        company: isCompany ? COMPANIES[i] : '',
        phone: `718-555-${String(r.int(100, 9999)).padStart(4, '0')}`,
        email: r.chance(0.7) ? `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z.]/g, '') + '@example.com' : '',
        street: `${r.int(10, 240)}-${r.int(10, 99)} ${r.pick(STREETS)}`,
        city,
        state: 'NEW_YORK',
        zip
      })
      if (!customer) continue
      const vehicles: Vehicle[] = []
      for (let v = 0; v < (isCompany ? 3 : r.int(1, 2)); v++) {
        const [year, make, model, engine, transmission] = isCompany ? VEHICLES[11] : r.pick(VEHICLES)
        const vin = Array.from({ length: 17 }, () => r.pick(VIN_CHARS.split(''))).join('')
        const vehicle = repos.vehicles.create({
          id: 0,
          customerId: customer.id,
          vin,
          year: String(year),
          make,
          model,
          licensePlate: `${String.fromCharCode(65 + r.int(0, 25), 65 + r.int(0, 25), 65 + r.int(0, 25))}${r.int(1000, 9999)}`,
          color: r.pick(COLORS),
          engine,
          transmission
        })
        if (vehicle) vehicles.push(vehicle)
      }
      owners.push({ customer, vehicles })
    }

    // About 18 months of work, busier in spring and summer.
    let workOrders = 0
    let open = 0
    for (let day = 540; day >= 0; day--) {
      const date = addDays(today, -day)
      if (date.getDay() === 0) continue // closed Sundays
      const busy = date.getMonth() >= 3 && date.getMonth() <= 7 ? 0.65 : 0.45
      if (!r.chance(busy)) continue
      const { customer, vehicles } = r.pick(owners)
      const vehicle = r.pick(vehicles)
      const parts: AutoPart[] = Array.from({ length: r.int(1, 3) }, () => {
        const [desc, name, retailPrice, listPrice, taxable] = r.pick(PARTS)
        return { id: 0, name, desc, retailPrice, listPrice, quantity: name === 'SPAKPLUG' ? 4 : r.chance(0.2) ? 2 : 1, taxable }
      })
      const labor: Labor[] = Array.from({ length: r.chance(0.25) ? 2 : 1 }, () => ({ id: 0, code: '', desc: r.pick(LABOR), billedHrs: r.pick([0.5, 1, 1, 1.5, 2, 3]), rate: laborRate, taxable: true }))
      // Recent jobs are often still in the shop.
      const done = day > 14 ? r.chance(0.94) : r.chance(0.45)
      const completed = done ? addDays(date, r.int(0, 6)) : null
      const completedIso = completed && completed <= today ? iso(completed) : null
      const mileageIn = r.int(20_000, 180_000)
      const draft: WorkOrder = {
        id: 0,
        dateCreated: iso(date),
        dateCompleted: completedIso,
        customer,
        vehicle: { ...vehicle, mileageIn: String(mileageIn), mileageOut: completedIso ? String(mileageIn + r.int(1, 12)) : '' },
        taxRate,
        parts,
        labor,
        payments: []
      }
      const saved = repos.workOrders.save(draft)
      const total = Math.round(bill(saved) * 100) / 100
      const method = (): PaymentMethod => r.pick(['Cash', 'Check', 'Credit', 'Credit'] as const)
      const payments: Payment[] = []
      if (completedIso) {
        const share = r.chance(0.85) ? 1 : r.chance(0.6) ? 0.5 : 0
        if (share > 0) payments.push({ id: 0, date: completedIso, method: method(), amount: Math.round(total * share * 100) / 100 })
      } else if (r.chance(0.25)) {
        payments.push({ id: 0, date: iso(date), method: method(), amount: 100 })
      }
      if (payments.length) repos.workOrders.save({ ...saved, payments })
      workOrders++
      if (!completedIso) open++
    }
    summary = { customers: owners.length, vehicles: owners.reduce((s, o) => s + o.vehicles.length, 0), workOrders, open, parts: PARTS.length }
  })()
  return summary
}

const DB_FILES = ['autoshop.db', 'autoshop.db-wal', 'autoshop.db-shm', 'session.json']

/** Deletes the dev database and session state (open/recent work orders). Settings are kept. */
export function dropDevData(dataDir: string): string[] {
  const removed = DB_FILES.map((f) => join(dataDir, f)).filter((f) => existsSync(f))
  for (const f of removed) rmSync(f)
  return removed
}

/** Runs a `--dev-db=<action>` command against the dev data folder and returns the exit code. */
export function runDevDbCommand(action: DevDbAction, dataDir: string, settings: { taxRate: number; laborRate: number }): number {
  if (action === 'drop' || action === 'reset') {
    const removed = dropDevData(dataDir)
    console.log(removed.length ? `Dropped the dev database in ${dataDir}` : `No dev database to drop in ${dataDir}`)
    if (action === 'drop') return 0
  }
  const repos = createRepos(join(dataDir, 'autoshop.db'))
  try {
    const existing = (repos.db.prepare('select (select count(*) from customer) + (select count(*) from work_order) as n').get() as { n: number }).n
    if (existing > 0) {
      console.error(`The dev database already has data (${join(dataDir, 'autoshop.db')}). Run "npm run db:reset" to replace it.`)
      return 1
    }
    const s = seedDemoData(repos, settings.taxRate, settings.laborRate)
    console.log(`Seeded the dev database: ${s.customers} customers, ${s.vehicles} vehicles, ${s.workOrders} work orders (${s.open} open), ${s.parts} catalog parts.`)
    console.log(`Location: ${join(dataDir, 'autoshop.db')}`)
    return 0
  } finally {
    repos.db.close()
  }
}
