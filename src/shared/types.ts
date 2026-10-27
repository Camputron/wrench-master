/**
 * Domain types shared by the main process, preload, and renderer.
 *
 * Conventions:
 * - `id <= 0` means the record has not been saved yet.
 * - Dates are ISO calendar dates (`YYYY-MM-DD`). The database layer converts them to and from the
 *   epoch-millisecond values the original Java app stored.
 * - `state` holds the state key (e.g. `NEW_YORK`), matching what the Java app wrote. See `states.ts`.
 */

export type IsoDate = string

export interface Customer {
  id: number
  firstName: string
  lastName: string
  phone: string
  email: string
  company: string
  street: string
  city: string
  state: string
  zip: string
}

export interface VehicleInfo {
  vin: string
  year: string
  make: string
  model: string
  licensePlate: string
  color: string
  engine: string
  transmission: string
}

/** A vehicle owned by a customer (row in the `vehicle` table). */
export interface Vehicle extends VehicleInfo {
  id: number
  customerId: number
}

/** The vehicle as recorded on a work order, including mileage. */
export interface WorkOrderVehicle extends VehicleInfo {
  mileageIn: string
  mileageOut: string
}

export interface AutoPart {
  id: number
  name: string
  desc: string
  retailPrice: number
  listPrice: number
  quantity: number
  taxable: boolean
}

export interface Labor {
  id: number
  code: string
  desc: string
  billedHrs: number
  rate: number
  taxable: boolean
}

export const PAYMENT_METHODS = ['Cash', 'Check', 'Credit'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface Payment {
  id: number
  date: IsoDate
  method: PaymentMethod
  amount: number
}

/**
 * A work order keeps its own copy of the customer and vehicle details so that past invoices
 * don't change when a customer record is edited. `customer.id` links back to the customer.
 */
export interface WorkOrder {
  id: number
  dateCreated: IsoDate
  dateCompleted: IsoDate | null
  customer: Customer
  vehicle: WorkOrderVehicle
  /** Fraction, e.g. 0.08625 for 8.625% */
  taxRate: number
  parts: AutoPart[]
  labor: Labor[]
  payments: Payment[]
}

/** An entry in the auto part catalog (`item` table) used for autocomplete. */
export type PartSuggestion = Omit<AutoPart, 'id'>

export type CustomerFilter = Partial<Omit<Customer, 'id'>>

export type VehicleFilter = Partial<VehicleInfo> & { customerId?: number }

export type DateFilter = { mode: 'exactly' | 'before' | 'after'; date: IsoDate } | { mode: 'between'; from: IsoDate; to: IsoDate }

export interface WorkOrderFilter {
  id?: number
  firstName?: string
  lastName?: string
  company?: string
  year?: string
  make?: string
  model?: string
  date?: DateFilter
  limit?: number
}

export interface CustomerSuggestions {
  company: string[]
  street: string[]
  city: string[]
  zip: string[]
}

export interface VehicleSuggestions {
  year: string[]
  make: string[]
  model: string[]
  color: string[]
  engine: string[]
  transmission: string[]
}

export interface WorkOrderStats {
  completedThisMonth: number
  completedThisYear: number
}

export interface MonthlyIncome {
  /** 1-12 */
  month: number
  /** Total billed for work orders created this month */
  expected: number
  /** Total billed for work orders completed this month */
  actual: number
}

export type Theme = 'light' | 'dark' | 'system'

/** Interface size options, as Electron zoom factors. */
export const ZOOM_LEVELS = [0.9, 1, 1.1, 1.25, 1.5] as const

/** The shop's details, printed on invoices. */
export interface ShopInfo {
  company: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
  repairShopId: string
  invoiceTitle: string
}

export interface Settings {
  shop: ShopInfo
  /** Default hourly labor rate */
  laborRate: number
  /** Default sales tax rate for new work orders, as a fraction */
  taxRate: number
  theme: Theme
  /** One of ZOOM_LEVELS */
  zoom: number
  /** Ask before closing the window */
  confirmExit: boolean
}

export type SettingsPatch = Partial<Omit<Settings, 'shop'>> & { shop?: Partial<ShopInfo> }

export type Page = 'dashboard' | 'customers' | 'workOrders'

/** Native menu commands the renderer handles. */
export type MenuAction = { type: 'navigate'; page: Page } | { type: 'preferences' } | { type: 'about' }

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  databasePath: string
}
