import type { Customer, CustomerFilter, CustomerSuggestions, MonthlyIncome, PartSuggestion, Vehicle, VehicleFilter, VehicleSuggestions, WorkOrder, WorkOrderFilter, WorkOrderStats } from './types'

/**
 * The API the preload script exposes to the renderer as `window.api`.
 * Each method is an IPC call to the main process on channel `<namespace>.<method>`.
 */
export interface Api {
  customers: {
    get(id: number): Promise<Customer | null>
    list(limit?: number): Promise<Customer[]>
    filter(filter: CustomerFilter): Promise<Customer[]>
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
}

/**
 * Every method name in `Api`, used by the preload script to build `window.api`.
 * Typed so that adding or removing a method in `Api` without updating this list is a compile error.
 */
export const API_METHODS: { [N in keyof Api]: Record<keyof Api[N], true> } = {
  customers: { get: true, list: true, filter: true, create: true, update: true, delete: true, suggestions: true },
  vehicles: { get: true, listByCustomer: true, filter: true, create: true, update: true, delete: true, suggestions: true },
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
  }
}

/** Main-process implementation of `Api`: same methods, but may return values directly. */
export type ApiHandlers = {
  [N in keyof Api]: {
    [M in keyof Api[N]]: Api[N][M] extends (...args: infer A) => Promise<infer R> ? (...args: A) => R | Promise<R> : never
  }
}
