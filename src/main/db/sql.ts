import type { IsoDate } from '../../shared/types'

/**
 * The Java app stored `java.sql.Date` values through sqlite-jdbc, which writes milliseconds since the epoch
 * at local midnight. We keep that format so existing databases keep working.
 */
export function toDbDate(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function fromDbDate(value: unknown): IsoDate | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(Number(value))
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today's date in local time as `YYYY-MM-DD`. */
export function today(): IsoDate {
  return fromDbDate(Date.now()) as IsoDate
}

/** Database value for local midnight `days` after `date`. Safe across DST changes. */
export function dbDatePlusDays(date: IsoDate, days: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d + days).getTime()
}

export const toDbBool = (b: boolean): number => (b ? 1 : 0)

/** Escapes LIKE wildcards in user input. Pair with `escape '\'` in the SQL. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

/** Builds a `where` clause from `column like 'value%'` prefix matches, skipping blank values. */
export function prefixMatches(fields: [column: string, value: string | undefined][]): { clauses: string[]; params: string[] } {
  const clauses: string[] = []
  const params: string[] = []
  for (const [column, value] of fields) {
    if (!value) continue
    clauses.push(`${column} like ? escape '\\'`)
    params.push(likeEscape(value) + '%')
  }
  return { clauses, params }
}

export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
