import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Customer, Vehicle } from '../../../src/shared/types'
import { createRepos, type Repos } from '../../../src/main/db'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let r: Repos
beforeEach(() => {
  r = createRepos(createJavaDb(tempDir()))
})
afterEach(() => r.db.close())

const lastNames = (list: Customer[]): string[] => list.map((c) => c.lastName)
const vehicle = (customerId: number, overrides: Partial<Vehicle> = {}): Vehicle => ({ id: 0, customerId, vin: '', year: '', make: '', model: '', licensePlate: '', color: '', engine: '', transmission: '', ...overrides })

describe('customers', () => {
  it('lists by last name', () => {
    expect(lastNames(r.customers.list())).toEqual(['Doe', 'Smith'])
    expect(r.customers.list(1)).toHaveLength(1)
  })

  it.each([
    ['', ['Doe', 'Smith']],
    ['ja', ['Doe']],
    ['5551234', ['Doe']],
    ['555-12', ['Doe']],
    ['queens doe', ['Doe']],
    ['main st', ['Doe']],
    ['JANE@X', ['Doe']],
    ['acme_', ['Smith']],
    ['acme%', []],
    ['jane smith', []]
  ])('search %j -> %j', (query, expected) => {
    expect(lastNames(r.customers.search(query))).toEqual(expected)
  })

  it('filters by field prefix', () => {
    expect(r.customers.filter({ city: 'que', state: 'NEW' }).map((c) => c.id)).toEqual([1])
  })

  it('refuses an exact duplicate, then creates and updates', () => {
    const jane = r.customers.getById(1)!
    expect(r.customers.create({ ...jane, id: 0 })).toBeNull()
    const al = r.customers.create({ ...jane, id: 0, firstName: 'Al' })!
    expect(al.id).toBe(3)
    r.customers.update({ ...al, phone: '999' })
    expect(r.customers.getById(al.id)!.phone).toBe('999')
  })

  it('suggests existing values for autocomplete, without blanks', () => {
    expect(r.customers.suggestions()).toEqual({ company: ['Acme_Corp'], street: ['1 Main St'], city: ['Queens'], zip: ['11355'] })
  })

  it('deletes the customer’s vehicles too, but keeps their work orders', () => {
    r.customers.delete(1)
    expect(r.customers.getById(1)).toBeNull()
    expect(r.vehicles.listByCustomer(1)).toEqual([])
    expect(r.workOrders.getById(1)!.customer.lastName).toBe('Doe')
  })
})

describe('vehicles', () => {
  it('refuses the same VIN twice for one customer, but allows it for another', () => {
    const accord = r.vehicles.getById(1)!
    expect(r.vehicles.create({ ...accord, id: 0 })).toBeNull()
    expect(r.vehicles.create({ ...accord, id: 0, customerId: 2 })).not.toBeNull()
  })

  it('allows several vehicles without a VIN', () => {
    expect(r.vehicles.create(vehicle(2, { make: 'Ford' }))).not.toBeNull()
    expect(r.vehicles.create(vehicle(2, { make: 'Ford' }))).not.toBeNull()
    expect(r.vehicles.filter({ make: 'ford', customerId: 2 })).toHaveLength(2)
  })

  it('updates, filters, deletes, and suggests values', () => {
    r.vehicles.update({ ...r.vehicles.getById(1)!, color: 'Red' })
    expect(r.vehicles.getById(1)!.color).toBe('Red')
    expect(r.vehicles.filter({ make: 'Hon' }).map((v) => v.id)).toEqual([1])
    expect(r.vehicles.suggestions()).toMatchObject({ make: ['Honda'], color: ['Red'] })
    r.vehicles.delete(1)
    expect(r.vehicles.getById(1)).toBeNull()
  })
})

describe('parts catalog', () => {
  it('searches by name or description, literally', () => {
    expect(r.parts.search('brake').map((p) => p.name)).toEqual(['BP-100'])
    expect(r.parts.search('bp-')[0]).toMatchObject({ desc: 'Brake pads front', retailPrice: 45, taxable: true })
    expect(r.parts.search('%')).toEqual([])
  })

  it('adds new parts and updates existing ones by part number', () => {
    r.parts.remember({ name: 'BP-100', desc: 'Brake pads front (ceramic)', retailPrice: 55, listPrice: 35, quantity: 1, taxable: true })
    r.parts.remember({ name: 'OF-1', desc: 'Oil filter', retailPrice: 8, listPrice: 4, quantity: 1, taxable: false })
    expect(r.parts.search('')).toHaveLength(2)
    expect(r.parts.search('ceramic')[0].retailPrice).toBe(55)
    expect(r.parts.search('oil')[0].taxable).toBe(false)
  })
})
