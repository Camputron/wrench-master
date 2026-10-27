import { bill } from '../../../shared/billing'
import { stateByKey } from '../../../shared/states'
import type { Customer, VehicleInfo, WorkOrder } from '../../../shared/types'

/** Number format for money fields. */
export const MONEY: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' }

const money = new Intl.NumberFormat('en-US', MONEY)

export const formatMoney = (amount: number): string => money.format(amount)

/** `2026-03-05` -> `03/05/2026` */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

/** "Doe, Jane", or the company when there's no name. */
export function customerName(c: Pick<Customer, 'firstName' | 'lastName' | 'company'>): string {
  const name = [c.lastName, c.firstName].filter((s) => s.trim()).join(', ')
  return name || c.company || 'Unnamed customer'
}

/** "1 Main St, Queens, NY 11355" */
export function formatAddress(c: Pick<Customer, 'street' | 'city' | 'state' | 'zip'>): string {
  const state = stateByKey(c.state)?.abbreviation ?? ''
  const stateZip = [state, c.zip].filter(Boolean).join(' ')
  return [c.street, c.city, stateZip].filter((s) => s.trim()).join(', ')
}

/** "2003 Honda Accord" */
export function vehicleName(v: Pick<VehicleInfo, 'year' | 'make' | 'model'>): string {
  return [v.year, v.make, v.model].filter((s) => s.trim()).join(' ') || 'Unknown vehicle'
}

export const workOrderTotal = (wo: WorkOrder): string => formatMoney(bill(wo))

/**
 * Formats up to 10 digits as you type: local numbers as `555-1234`, full numbers as `718-555-1234`.
 * Non-digits are dropped.
 */
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** Uppercase, no spaces, no I/O/Q (never used in VINs), at most 17 characters. */
export const cleanVin = (input: string): string =>
  input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[IOQ]/g, '')
    .slice(0, 17)

export const isCompleteVin = (vin: string): boolean => /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)

/** A copy of `obj` with surrounding whitespace removed from every string property. */
export function trimStrings<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as T
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })

/** `$950`, `$1.2K`, `$3.4M`: for axis ticks and summary figures. */
export const formatMoneyCompact = (amount: number): string => compactMoney.format(amount)
