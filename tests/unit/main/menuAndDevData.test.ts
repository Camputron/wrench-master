import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { bill } from '../../../src/shared/billing'
import { createRepos } from '../../../src/main/db'
import { dropDevData, runDevDbCommand, seedDemoData } from '../../../src/main/devData'
import { buildMenu } from '../../../src/main/menu'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { tempDir } from '../helpers/tempDir'

describe('application menu', () => {
  const handlers = { send: vi.fn(), zoom: vi.fn(), importFromJavaApp: vi.fn(), exportData: vi.fn(), backUpNow: vi.fn(), restoreBackup: vi.fn() }
  const menu = buildMenu(handlers) as unknown as { items: MenuItemConstructorOptions[] }
  const find = (label: string): MenuItemConstructorOptions => {
    const queue = [...menu.items]
    while (queue.length) {
      const item = queue.shift()!
      if (item.label === label) return item
      if (Array.isArray(item.submenu)) queue.push(...item.submenu)
    }
    throw new Error(`No menu item "${label}"`)
  }
  const click = (label: string): void => (find(label).click as () => void)()

  it.each([
    ['New Work Order', { type: 'newWorkOrder' }, 'CmdOrCtrl+N'],
    ['New Customer…', { type: 'newCustomer' }, undefined],
    ['Save Work Order', { type: 'save' }, 'CmdOrCtrl+S'],
    ['Print Work Order…', { type: 'print' }, 'CmdOrCtrl+P'],
    ['Close Work Order', { type: 'closeWorkOrder' }, 'CmdOrCtrl+W'],
    ['Find', { type: 'find' }, 'CmdOrCtrl+F'],
    ['Undo', { type: 'undo' }, 'CmdOrCtrl+Z'],
    ['Dashboard', { type: 'navigate', page: 'dashboard' }, 'CmdOrCtrl+1'],
    ['Customers', { type: 'navigate', page: 'customers' }, 'CmdOrCtrl+2'],
    ['Work Orders', { type: 'navigate', page: 'workOrders' }, 'CmdOrCtrl+3']
  ])('%s sends %j (%s)', (label, action, accelerator) => {
    click(label)
    expect(handlers.send).toHaveBeenLastCalledWith(action)
    expect(find(label).accelerator).toBe(accelerator)
  })

  it('wires zoom, import, every export, and backups', () => {
    click('Zoom In')
    click('Zoom Out')
    click('Actual Size')
    expect(handlers.zoom.mock.calls).toEqual([[1], [-1], [0]])
    click('Import from Autoshop Invoice Manager…')
    expect(handlers.importFromJavaApp).toHaveBeenCalled()
    for (const label of ['Customers…', 'Vehicles…', 'Work Orders…', 'Parts Catalog…']) click(label)
    expect(handlers.exportData.mock.calls.flat()).toEqual(['customers', 'vehicles', 'workOrders', 'parts'])
    click('Back Up Now')
    expect(handlers.backUpNow).toHaveBeenCalled()
    click('Restore from Backup…')
    expect(handlers.restoreBackup).toHaveBeenCalled()
  })
})

describe('demo data', () => {
  it('seeds the same realistic data every time, through the normal repositories', () => {
    const today = new Date(2026, 9, 27)
    const runs = [0, 1].map(() => {
      const r = createRepos(join(tempDir(), 'autoshop.db'))
      const summary = seedDemoData(r, 0.08625, 90, today)
      const snapshot = { summary, last: r.workOrders.list(1)[0], stats: r.workOrders.stats(today) }
      r.db.close()
      return snapshot
    })
    expect(runs[0]).toEqual(runs[1])
    const { summary, stats } = runs[0]
    expect(summary).toMatchObject({ customers: 28, parts: 13 })
    expect(summary.workOrders).toBeGreaterThan(200)
    expect(summary.open).toBe(stats.openCount)
  })

  it('includes semi-filled, empty, and long work orders for checking invoices', () => {
    const r = createRepos(join(tempDir(), 'autoshop.db'))
    const today = new Date(2026, 9, 27)
    const { invoiceExamples } = seedDemoData(r, 0.08625, 90, today)
    const [semi, empty, long] = [invoiceExamples.semiFilled, invoiceExamples.empty, invoiceExamples.long].map((id) => r.workOrders.getById(id)!)
    for (const wo of [semi, empty, long]) expect(wo.dateCreated).toBe('2026-10-27')
    expect([semi.parts.length, semi.labor.length, semi.payments.length]).toEqual([10, 3, 2])
    expect(bill(semi) - semi.payments.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(0, 2)
    expect([empty.parts, empty.labor, empty.payments, empty.dateCompleted]).toEqual([[], [], [], null])
    expect(long.parts.length).toBe(36)
    expect(long.labor.some((l) => l.desc.includes('\n'))).toBe(true)
    expect(long.payments.map((p) => p.amount)).toEqual([1000])
    // The long one is the biggest job in the demo data.
    expect(Math.max(...r.workOrders.list().map((w) => w.parts.length))).toBe(36)
    r.db.close()
  })

  it('agrees with line-by-line billing on every seeded work order', () => {
    const r = createRepos(join(tempDir(), 'autoshop.db'))
    seedDemoData(r, 0.08625, 90, new Date(2026, 9, 27))
    // Voided work orders are left out of the dashboard's numbers.
    const all = r.workOrders.list().filter((w) => !w.dateVoided)
    expect(r.workOrders.list().length - all.length).toBeGreaterThan(0)
    const owed = all.map((w) => Math.round((bill(w) - w.payments.reduce((s, p) => s + p.amount, 0)) * 100) / 100).filter((x) => x > 0)
    const stats = r.workOrders.stats(new Date(2026, 9, 27))
    expect(stats.unpaidCount).toBe(owed.length)
    expect(Math.round(stats.unpaidTotal * 100)).toBe(Math.round(owed.reduce((a, b) => a + b, 0) * 100))
    expect(stats.completedThisYear).toBe(all.filter((w) => w.dateCompleted?.startsWith('2026')).length)
    r.db.close()
  })

  it('refuses to seed over existing data; drop and reset work', () => {
    const dir = tempDir()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const settings = { taxRate: 0.08625, laborRate: 90 }
    expect(runDevDbCommand('seed', dir, settings)).toBe(0)
    // The invoice examples are on the dashboard's recent list, semi-filled one first.
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^Invoice examples .*#\d+ semi-filled, #\d+ empty, #\d+ long/))
    const recent = JSON.parse(readFileSync(join(dir, 'session.json'), 'utf8')).recentWorkOrderIds
    expect(recent).toHaveLength(3)
    expect(runDevDbCommand('seed', dir, settings)).toBe(1)
    expect(runDevDbCommand('reset', dir, settings)).toBe(0)
    expect(dropDevData(dir).length).toBeGreaterThan(0)
    expect(existsSync(join(dir, 'autoshop.db'))).toBe(false)
    expect(runDevDbCommand('drop', dir, settings)).toBe(0)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No dev database'))
  })
})
