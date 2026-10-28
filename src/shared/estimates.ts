import type { Estimate, IsoDate } from './types'

/** How long a new estimate's prices hold. */
export const ESTIMATE_VALID_DAYS = 30

/** "E-00012", or "New estimate" before it's saved. */
export const estimateNumber = (id: number): string => (id > 0 ? `E-${String(id).padStart(5, '0')}` : 'New estimate')

/** `date` plus `days`, by the calendar (safe across daylight saving changes). */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
}

/** Open, but past its valid-until date: the prices may need checking before it's accepted. */
export const isExpired = (e: Pick<Estimate, 'status' | 'validUntil'>, today: IsoDate): boolean => e.status === 'open' && e.validUntil < today
