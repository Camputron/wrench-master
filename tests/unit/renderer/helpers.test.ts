import { describe, expect, it } from 'vitest'
import { cleanVin, customerName, formatAddress, formatDate, formatMoney, formatMoneyCompact, formatPhone, isCompleteVin, trimStrings, vehicleName } from '../../../src/renderer/src/lib/format'
import { suggestPartNumber } from '../../../src/renderer/src/lib/partNumber'
import { EMPTY_CUSTOMER, emptyWorkOrder, validateWorkOrder } from '../../../src/renderer/src/lib/records'

describe('formatting', () => {
  it('formats money and dates', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoneyCompact(1500)).toBe('$1.5K')
    expect(formatDate('2026-03-05')).toBe('03/05/2026')
    expect(formatDate(null)).toBe('')
  })

  it.each([
    ['5551234', '555-1234'],
    ['(718) 555-0100 ext', '718-555-0100'],
    ['71855501009', '718-555-0100'],
    ['55', '55'],
    ['abc', '']
  ])('phone %j -> %j', (input, expected) => {
    expect(formatPhone(input)).toBe(expected)
  })

  it('cleans VINs: uppercase, no spaces, no I/O/Q, at most 17 characters', () => {
    expect(cleanVin('1hgcm 82633a0o04352q')).toBe('1HGCM82633A004352')
    expect(isCompleteVin('1HGCM82633A004352')).toBe(true)
    expect(isCompleteVin('1HGCM82633A00435')).toBe(false)
  })

  it('names customers and vehicles for lists', () => {
    expect(customerName({ firstName: 'Jane', lastName: 'Doe', company: 'X' })).toBe('Doe, Jane')
    expect(customerName({ firstName: '', lastName: '', company: 'Acme' })).toBe('Acme')
    expect(customerName({ firstName: '', lastName: '', company: '' })).toBe('Unnamed customer')
    expect(formatAddress({ street: '1 Main St', city: 'Queens', state: 'NEW_YORK', zip: '11355' })).toBe('1 Main St, Queens, NY 11355')
    expect(formatAddress({ street: '', city: '', state: 'UNKNOWN', zip: '' })).toBe('')
    expect(vehicleName({ year: '2003', make: 'Honda', model: '' })).toBe('2003 Honda')
  })

  it('trims every string field', () => {
    expect(trimStrings({ ...EMPTY_CUSTOMER, firstName: ' Al ', id: 3 })).toEqual({ ...EMPTY_CUSTOMER, firstName: 'Al', id: 3 })
  })
})

describe('part numbers suggested from the description (the Java app’s rules)', () => {
  it.each([
    ['Brake pads front', 'BRAEPADSFROT'],
    ['A/C compressor 007', 'ACCOOR7'],
    ['Oil filter 5W30', 'OILFIER5W30'],
    ['  ', '']
  ])('%j -> %j', (desc, expected) => {
    expect(suggestPartNumber(desc)).toBe(expected)
  })
})

describe('work order validation', () => {
  const wo = emptyWorkOrder(0.08625, '2026-02-01')

  it('starts new work orders today with the default tax rate', () => {
    expect(wo).toMatchObject({ id: 0, dateCreated: '2026-02-01', dateCompleted: null, taxRate: 0.08625, parts: [], labor: [], payments: [] })
  })

  it('rejects a completed date before the created date', () => {
    expect(validateWorkOrder({ ...wo, dateCompleted: '2026-01-31' })).toMatch(/can’t be before/)
    expect(validateWorkOrder({ ...wo, dateCompleted: '2026-02-01' })).toBeNull()
    expect(validateWorkOrder(wo)).toBeNull()
  })
})
