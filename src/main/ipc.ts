import { app, ipcMain } from 'electron'
import type { ApiHandlers } from '../shared/api'
import type { WorkOrder } from '../shared/types'
import type { Services } from './services'
import { decodeVin } from './vin'

export function createHandlers(services: Services): ApiHandlers {
  // Read repos on every call: importing a database replaces them.
  const db = (): Services['repos'] => services.repos
  const { settings, session } = services
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
        db().workOrders.delete(id)
        session.forget(id)
      },
      stats: () => db().workOrders.stats(),
      years: () => db().workOrders.years(),
      incomeByMonth: (year) => db().workOrders.incomeByMonth(year)
    },
    settings: {
      get: () => settings.get(),
      update: (patch) => settings.update(patch)
    },
    session: {
      recentWorkOrders: () => db().workOrders.getByIds(session.recentWorkOrderIds()),
      openWorkOrderIds: () => session.openWorkOrderIds(),
      setOpenWorkOrderIds: (ids) => session.setOpen(ids)
    },
    app: {
      info: () => ({
        name: app.getName(),
        version: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        databasePath: services.databasePath
      }),
      setUnsavedChanges: (count) => {
        services.unsavedChanges = Number.isInteger(count) && count > 0 ? count : 0
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
