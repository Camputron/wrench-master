import { describe, expect, it } from 'vitest'
import { dbDatePlusDays, fromDbDate, likeEscape, prefixMatches, toDbDate } from '../../../src/main/db/sql'
import { javaDate } from '../../fixtures/javaDb'

describe('dates stored like the Java app (ms at local midnight)', () => {
  it('round-trips ISO dates', () => {
    expect(toDbDate('2024-03-05')).toBe(javaDate(2024, 3, 5))
    expect(fromDbDate(javaDate(2024, 3, 5))).toBe('2024-03-05')
  })

  it('reads empty values as no date, and accepts ISO text', () => {
    expect(fromDbDate(null)).toBeNull()
    expect(fromDbDate(undefined)).toBeNull()
    expect(fromDbDate('')).toBeNull()
    expect(fromDbDate('2025-07-04T00:00:00')).toBe('2025-07-04')
    expect(fromDbDate('not a date')).toBeNull()
  })

  it('adds calendar days safely across daylight saving changes', () => {
    // US DST starts 2026-03-08: the next local midnight is 23 hours later, not 24.
    expect(fromDbDate(dbDatePlusDays('2026-03-07', 1))).toBe('2026-03-08')
    expect(fromDbDate(dbDatePlusDays('2026-03-08', 1))).toBe('2026-03-09')
    expect(fromDbDate(dbDatePlusDays('2026-12-31', 1))).toBe('2027-01-01')
  })
})

describe('LIKE helpers', () => {
  it('escapes wildcards so user input matches literally', () => {
    expect(likeEscape('50%_off\\')).toBe('50\\%\\_off\\\\')
  })

  it('builds prefix clauses only for non-blank values', () => {
    expect(
      prefixMatches([
        ['a', 'x_'],
        ['b', ''],
        ['c', undefined]
      ])
    ).toEqual({ clauses: ["a like ? escape '\\'"], params: ['x\\_%'] })
  })
})
