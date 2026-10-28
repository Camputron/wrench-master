import { existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHandlers } from '../../../src/main/ipc'
import { Services } from '../../../src/main/services'
import type { WorkOrder } from '../../../src/shared/types'
import { electronMock } from '../helpers/electronMock'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let dir: string
let services: Services
beforeEach(() => {
  dir = tempDir()
  createJavaDb(dir) // becomes the app's autoshop.db
  services = new Services(dir, () => {})
  electronMock.sent.length = 0
})
afterEach(() => services.close())

const blank = (): WorkOrder => ({
  id: 0,
  dateCreated: '2026-10-01',
  dateCompleted: null,
  customer: { id: 0, firstName: 'A', lastName: 'B', phone: '', email: '', company: '', street: '', city: '', state: 'UNKNOWN', zip: '' },
  vehicle: { vin: '', year: '', make: '', model: '', licensePlate: '', color: '', engine: '', transmission: '', mileageIn: '', mileageOut: '' },
  taxRate: 0.1,
  parts: [],
  labor: [],
  payments: []
})

describe('IPC handlers', () => {
  it('track recently saved work orders and forget deleted ones', async () => {
    const h = createHandlers(services)
    const a = await h.workOrders.save(blank())
    const b = await h.workOrders.save(blank())
    await h.workOrders.save({ ...(await h.workOrders.get(1))! })
    expect((await h.session.recentWorkOrders()).map((w) => w.id)).toEqual([1, b.id, a.id])
    await h.session.setOpenWorkOrderIds([a.id, b.id])
    await h.workOrders.delete(a.id)
    expect((await h.session.recentWorkOrders()).map((w) => w.id)).toEqual([1, b.id])
    expect(await h.session.openWorkOrderIds()).toEqual([b.id])
  })

  it('sanitize the unsaved-changes count the renderer reports', async () => {
    const h = createHandlers(services)
    await h.app.setUnsavedChanges(2)
    expect(services.unsavedChanges).toBe(2)
    await h.app.setUnsavedChanges('lots' as unknown as number)
    expect(services.unsavedChanges).toBe(0)
    await h.app.setUnsavedChanges(-1)
    expect(services.unsavedChanges).toBe(0)
  })

  it('report app info', async () => {
    expect(await createHandlers(services).app.info()).toMatchObject({ name: 'Wrench Master', version: '2.0.0', databasePath: join(dir, 'autoshop.db') })
  })
})

describe('replacing the database (File > Import)', () => {
  it('copies the new database in, backs up the old one, clears the session, and tells the windows', async () => {
    const h = createHandlers(services)
    await h.workOrders.save(blank())
    const importDir = tempDir()
    const source = createJavaDb(importDir)
    const backup = await services.replaceDatabase(source)
    expect(existsSync(backup)).toBe(true)
    expect((await h.workOrders.list()).map((w) => w.id)).toEqual([3, 2, 1])
    expect(services.session.recentWorkOrderIds()).toEqual([])
    expect(electronMock.sent).toContainEqual({ channel: 'event:data-changed', payload: null })
    // The source is read, never modified.
    expect(readdirSync(importDir)).toEqual(['autoshop.db'])
    // Restoring the backup right away doesn't overwrite it (backup names are unique).
    await services.replaceDatabase(backup)
    expect(await h.workOrders.list()).toHaveLength(4)
  })

  it('keeps the current data if the new file is unusable', async () => {
    const junk = join(tempDir(), 'junk.db')
    writeFileSync(junk, 'not a database')
    await expect(services.replaceDatabase(junk)).rejects.toThrow()
    expect(services.repos.workOrders.list()).toHaveLength(3)
  })
})
