import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'fs'
import { listBackups } from './backups'
import { chooseBackupFolder, restoreFromBackup } from './restoreBackup'
import type { ApiHandlers } from '../shared/api'
import type { Estimate, WorkOrder } from '../shared/types'
import type { Services } from './services'
import { estimateFileName, estimateHtml, invoiceFileName, invoiceHtml } from './invoice'
import { printPage, savePagePdf, type Printable } from './printing'
import { decodeVin } from './vin'

export function createHandlers(services: Services): ApiHandlers {
  // Read repos on every call: importing a database replaces them.
  const db = (): Services['repos'] => services.repos
  const { settings, session } = services
  const invoice = (wo: WorkOrder): Printable => ({ html: invoiceHtml(wo, settings.get()), fileName: invoiceFileName(wo), noun: 'invoice' })
  const estimate = (e: Estimate): Printable => ({ html: estimateHtml(e, settings.get()), fileName: estimateFileName(e), noun: 'estimate' })
  return {
    customers: {
      get: (id) => db().customers.getById(id),
      list: (limit) => db().customers.list(limit),
      filter: (f) => db().customers.filter(f),
      search: (query, limit) => db().customers.search(query, limit),
      create: (c) => db().customers.create(c),
      update: (c) => db().customers.update(c),
      delete: (id) => db().customers.delete(id),
      suggestions: () => db().customers.suggestions()
    },
    vehicles: {
      get: (id) => db().vehicles.getById(id),
      listByCustomer: (customerId) => db().vehicles.listByCustomer(customerId),
      filter: (f) => db().vehicles.filter(f),
      create: (v) => db().vehicles.create(v),
      update: (v) => db().vehicles.update(v),
      delete: (id) => db().vehicles.delete(id),
      suggestions: () => db().vehicles.suggestions(),
      decodeVin: (vin) => decodeVin(vin)
    },
    parts: {
      search: (query, limit) => db().parts.search(query, limit),
      remember: (p) => db().parts.remember(p)
    },
    workOrders: {
      get: (id) => db().workOrders.getById(id),
      getByIds: (ids) => db().workOrders.getByIds(ids),
      list: (limit) => db().workOrders.list(limit),
      listByCustomer: (customerId) => db().workOrders.listByCustomer(customerId),
      listIncomplete: () => db().workOrders.listIncomplete(),
      filter: (f) => db().workOrders.filter(f),
      save: (wo): WorkOrder => {
        const saved = db().workOrders.save(wo)
        session.addRecent(saved.id)
        return saved
      },
      delete: (id): void => {
        if (db().workOrders.getById(id)?.payments.length) throw new Error('Work orders with payments can’t be deleted. Void it instead.')
        db().workOrders.delete(id)
        session.forget(id)
      },
      setVoided: (id, voided) => db().workOrders.setVoided(id, voided === true),
      stats: () => db().workOrders.stats(),
      years: () => db().workOrders.years(),
      incomeByMonth: (year) => db().workOrders.incomeByMonth(year)
    },
    estimates: {
      get: (id) => db().estimates.getById(id),
      getByIds: (ids) => db().estimates.getByIds(ids),
      filter: (f) => db().estimates.filter(f),
      listByCustomer: (customerId) => db().estimates.listByCustomer(customerId),
      save: (e) => db().estimates.save(e),
      delete: (id): void => {
        db().estimates.delete(id)
        session.forgetEstimate(id)
      },
      setStatus: (id, status) => db().estimates.setStatus(id, status === 'declined' ? 'declined' : 'open'),
      convert: (id): WorkOrder => {
        const workOrder = db().estimates.convert(id)
        session.addRecent(workOrder.id)
        return workOrder
      },
      html: (e) => estimateHtml(e, settings.get()),
      print: (e) => printPage(estimate(e)),
      savePdf: (e) => savePagePdf(BrowserWindow.getFocusedWindow(), estimate(e))
    },
    settings: {
      get: () => settings.get(),
      update: (patch) => settings.update(patch)
    },
    session: {
      recentWorkOrders: () => db().workOrders.getByIds(session.recentWorkOrderIds()),
      openWorkOrderIds: () => session.openWorkOrderIds(),
      setOpenWorkOrderIds: (ids) => session.setOpen(ids),
      openEstimateIds: () => session.openEstimateIds(),
      setOpenEstimateIds: (ids) => session.setOpenEstimates(ids)
    },
    invoices: {
      html: (wo) => invoiceHtml(wo, settings.get()),
      print: (wo) => printPage(invoice(wo)),
      savePdf: (wo) => savePagePdf(BrowserWindow.getFocusedWindow(), invoice(wo))
    },
    backups: {
      status: () => {
        const folder = services.backupFolder()
        const last = listBackups(folder)[0]
        return { folder, isDefault: !settings.get().backupFolder, last: last ? { path: last.path, date: last.date.toISOString() } : null }
      },
      backUpNow: () => services.backUp('manual'),
      chooseFolder: () => chooseBackupFolder(BrowserWindow.getFocusedWindow(), services),
      showFolder: async () => {
        const folder = services.backupFolder()
        mkdirSync(folder, { recursive: true })
        await shell.openPath(folder)
      },
      restore: async () => {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        if (win) await restoreFromBackup(win, services)
      }
    },
    app: {
      showItemInFolder: (path) => shell.showItemInFolder(path),
      info: () => ({
        name: app.getName(),
        version: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        databasePath: services.databasePath
      }),
      setUnsavedChanges: (kind, count) => {
        if (kind === 'workOrder' || kind === 'estimate') services.unsaved[kind] = Number.isInteger(count) && count > 0 ? count : 0
      }
    }
  }
}

/** Registers every handler on IPC channel `<namespace>.<method>`. */
export function registerIpc(services: Services): void {
  const handlers = createHandlers(services) as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>
  for (const [namespace, methods] of Object.entries(handlers)) {
    for (const [method, fn] of Object.entries(methods)) {
      ipcMain.handle(`${namespace}.${method}`, (_event, ...args) => fn(...args))
    }
  }
}
