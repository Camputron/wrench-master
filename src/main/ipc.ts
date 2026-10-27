import { ipcMain } from 'electron'
import type { ApiHandlers } from '../shared/api'
import type { Repos } from './db'

export function createHandlers({ customers, vehicles, parts, workOrders }: Repos): ApiHandlers {
  return {
    customers: {
      get: (id) => customers.getById(id),
      list: (limit) => customers.list(limit),
      filter: (f) => customers.filter(f),
      create: (c) => customers.create(c),
      update: (c) => customers.update(c),
      delete: (id) => customers.delete(id),
      suggestions: () => customers.suggestions()
    },
    vehicles: {
      get: (id) => vehicles.getById(id),
      listByCustomer: (customerId) => vehicles.listByCustomer(customerId),
      filter: (f) => vehicles.filter(f),
      create: (v) => vehicles.create(v),
      update: (v) => vehicles.update(v),
      delete: (id) => vehicles.delete(id),
      suggestions: () => vehicles.suggestions()
    },
    parts: {
      search: (query, limit) => parts.search(query, limit),
      remember: (p) => parts.remember(p)
    },
    workOrders: {
      get: (id) => workOrders.getById(id),
      getByIds: (ids) => workOrders.getByIds(ids),
      list: (limit) => workOrders.list(limit),
      listByCustomer: (customerId) => workOrders.listByCustomer(customerId),
      listIncomplete: () => workOrders.listIncomplete(),
      filter: (f) => workOrders.filter(f),
      save: (wo) => workOrders.save(wo),
      delete: (id) => workOrders.delete(id),
      stats: () => workOrders.stats(),
      years: () => workOrders.years(),
      incomeByMonth: (year) => workOrders.incomeByMonth(year)
    }
  }
}

/** Registers every handler on IPC channel `<namespace>.<method>`. */
export function registerIpc(repos: Repos): void {
  const handlers = createHandlers(repos) as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>
  for (const [namespace, methods] of Object.entries(handlers)) {
    for (const [method, fn] of Object.entries(methods)) {
      ipcMain.handle(`${namespace}.${method}`, (_event, ...args) => fn(...args))
    }
  }
}
