import type {
  AppInfo,
  Customer,
  CustomerFilter,
  CustomerSuggestions,
  MenuAction,
  MonthlyIncome,
  Notice,
  PartSuggestion,
  Settings,
  SettingsPatch,
  Vehicle,
  VehicleFilter,
  VehicleSuggestions,
  WorkOrder,
  VinDecodeResult,
  WorkOrderFilter,
  WorkOrderStats
} from './types'

/**
 * The API the preload script exposes to the renderer as `window.api`.
 * Each method is an IPC call to the main process on channel `<namespace>.<method>`.
 */
export interface Api {
  customers: {
    get(id: number): Promise<Customer | null>
    list(limit?: number): Promise<Customer[]>
    filter(filter: CustomerFilter): Promise<Customer[]>
    /** Customers matching every word of `query` across name, company, phone, email, and address. */
    search(query: string, limit?: number): Promise<Customer[]>
    /** Resolves to null if an identical customer already exists. */
    create(customer: Customer): Promise<Customer | null>
    update(customer: Customer): Promise<Customer>
    /** Also deletes the customer's vehicles. */
    delete(id: number): Promise<void>
    suggestions(): Promise<CustomerSuggestions>
  }
  vehicles: {
    get(id: number): Promise<Vehicle | null>
    listByCustomer(customerId: number): Promise<Vehicle[]>
    filter(filter: VehicleFilter): Promise<Vehicle[]>
    /** Resolves to null if the customer already has a vehicle with this VIN. */
    create(vehicle: Vehicle): Promise<Vehicle | null>
    update(vehicle: Vehicle): Promise<Vehicle>
    delete(id: number): Promise<void>
    suggestions(): Promise<VehicleSuggestions>
    /** Looks the VIN up with NHTSA (needs internet). */
    decodeVin(vin: string): Promise<VinDecodeResult>
  }
  parts: {
    search(query: string, limit?: number): Promise<PartSuggestion[]>
    remember(part: PartSuggestion): Promise<void>
  }
  workOrders: {
    get(id: number): Promise<WorkOrder | null>
    getByIds(ids: number[]): Promise<WorkOrder[]>
    list(limit?: number): Promise<WorkOrder[]>
    listByCustomer(customerId: number): Promise<WorkOrder[]>
    listIncomplete(): Promise<WorkOrder[]>
    filter(filter: WorkOrderFilter): Promise<WorkOrder[]>
    /** Inserts or updates, including line items. Resolves to the stored work order (with its id). */
    save(workOrder: WorkOrder): Promise<WorkOrder>
    delete(id: number): Promise<void>
    stats(): Promise<WorkOrderStats>
    years(): Promise<number[]>
    incomeByMonth(year: number): Promise<MonthlyIncome[]>
  }
  settings: {
    get(): Promise<Settings>
    /** Merges the patch into the saved settings. Invalid values are ignored. Resolves to the new settings. */
    update(patch: SettingsPatch): Promise<Settings>
  }
  session: {
    /** Up to 10 most recently saved work orders, newest first. */
    recentWorkOrders(): Promise<WorkOrder[]>
    /** Work orders that were open in the editor, to reopen on launch. */
    openWorkOrderIds(): Promise<number[]>
    setOpenWorkOrderIds(ids: number[]): Promise<void>
  }
  invoices: {
    /** The printable invoice for a work order (saved or not) as a complete HTML page. */
    html(workOrder: WorkOrder): Promise<string>
    /** Opens the system print dialog. Resolves to false if cancelled. */
    print(workOrder: WorkOrder): Promise<boolean>
    /** Asks where to save, then writes a PDF. Resolves to its path, or null if cancelled. */
    savePdf(workOrder: WorkOrder): Promise<string | null>
  }
  app: {
    info(): Promise<AppInfo>
    /** Reveals a file in Finder / Explorer. */
    showItemInFolder(path: string): Promise<void>
    /** Tells the main process how many open work orders have unsaved changes, so quitting can warn. */
    setUnsavedChanges(count: number): Promise<void>
  }
}

/** Events the main process sends to the renderer. Subscribe with `window.events.on(name, listener)`. */
export interface AppEvents {
  'settings-changed': Settings
  menu: MenuAction
  notice: Notice
  /** The database was replaced (e.g. by an import); reload anything shown. */
  'data-changed': null
}

export const EVENT_CHANNEL_PREFIX = 'event:'

export interface Events {
  /** Returns a function that removes the listener. */
  on<K extends keyof AppEvents>(name: K, listener: (payload: AppEvents[K]) => void): () => void
}

/**
 * Every method name in `Api`, used by the preload script to build `window.api`.
 * Typed so that adding or removing a method in `Api` without updating this list is a compile error.
 */
export const API_METHODS: { [N in keyof Api]: Record<keyof Api[N], true> } = {
  customers: { get: true, list: true, filter: true, search: true, create: true, update: true, delete: true, suggestions: true },
  vehicles: { get: true, listByCustomer: true, filter: true, create: true, update: true, delete: true, suggestions: true, decodeVin: true },
  parts: { search: true, remember: true },
  workOrders: {
    get: true,
    getByIds: true,
    list: true,
    listByCustomer: true,
    listIncomplete: true,
    filter: true,
    save: true,
    delete: true,
    stats: true,
    years: true,
    incomeByMonth: true
  },
  settings: { get: true, update: true },
  session: { recentWorkOrders: true, openWorkOrderIds: true, setOpenWorkOrderIds: true },
  invoices: { html: true, print: true, savePdf: true },
  app: { info: true, showItemInFolder: true, setUnsavedChanges: true }
}

/** Main-process implementation of `Api`: same methods, but may return values directly. */
export type ApiHandlers = {
  [N in keyof Api]: {
    [M in keyof Api[N]]: Api[N][M] extends (...args: infer A) => Promise<infer R> ? (...args: A) => R | Promise<R> : never
  }
}
