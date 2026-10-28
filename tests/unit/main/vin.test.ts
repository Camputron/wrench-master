import { readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeVin, formatEngine, formatTransmission, parseVpicResult } from '../../../src/main/vin'

/** Recorded NHTSA vPIC responses (DecodeVinValues). */
const recorded = (name: string): Record<string, string> => JSON.parse(readFileSync(join(__dirname, '../../fixtures/vin', `${name}.json`), 'utf8')).Results[0]

describe('parsing NHTSA results', () => {
  it('formats a clean decode', () => {
    expect(parseVpicResult(recorded('accord-clean'))).toEqual({ ok: true, vehicle: { year: '2003', make: 'Honda', model: 'Accord', engine: '3.0L V6', transmission: '5-Speed Automatic' }, warning: undefined })
  })

  it('keeps the vehicle but warns when NHTSA flags the VIN', () => {
    const result = parseVpicResult(recorded('accord-bad-check-digit'))
    expect(result).toMatchObject({ ok: true, warning: 'Check Digit (9th position) does not calculate properly' })
    expect(parseVpicResult(recorded('tesla-check-digit'))).toMatchObject({ ok: true, vehicle: { make: 'Tesla', engine: 'Electric' } })
  })

  it('fails when NHTSA finds no vehicle', () => {
    expect(parseVpicResult(recorded('junk'))).toMatchObject({ ok: false })
  })

  it.each([
    [{ DisplacementL: '2.0', EngineCylinders: '4', EngineConfiguration: 'In-Line', FuelTypePrimary: 'Diesel' }, '2.0L I4 Diesel'],
    [{ DisplacementL: '2.5', EngineCylinders: '4', EngineConfiguration: 'Horizontally opposed (boxer)' }, '2.5L H4'],
    [{ DisplacementL: '6.0', EngineCylinders: '12', EngineConfiguration: 'W-Shaped' }, '6.0L W12'],
    [{ DisplacementL: '1.6', EngineCylinders: '3' }, '1.6L 3-cyl'],
    [{ FuelTypePrimary: 'Electric' }, 'Electric']
  ])('engine %j -> %s', (row, expected) => {
    expect(formatEngine(row)).toBe(expected)
  })

  it.each([
    [{ TransmissionStyle: 'Continuously Variable Transmission (CVT)' }, 'CVT'],
    [{ TransmissionStyle: 'Manual/Standard', TransmissionSpeeds: '6' }, '6-Speed Manual'],
    [{ TransmissionStyle: 'Automatic' }, 'Automatic'],
    [{}, '']
  ])('transmission %j -> %s', (row, expected) => {
    expect(formatTransmission(row)).toBe(expected)
  })

  it('keeps acronym makes uppercase and title-cases the rest', () => {
    expect(parseVpicResult({ Make: 'BMW' })).toMatchObject({ vehicle: { make: 'BMW' } })
    expect(parseVpicResult({ Make: 'LAND ROVER' })).toMatchObject({ vehicle: { make: 'Land Rover' } })
  })
})

describe('decodeVin', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects malformed VINs without calling NHTSA', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const vin of ['', 'SHORT', '1HGCM82633A00435O', '1HGCM82633A0043521']) expect(await decodeVin(vin)).toMatchObject({ ok: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('looks up a valid VIN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ Results: [recorded('accord-clean')] }) }))
    )
    expect(await decodeVin(' 1hgcm82633a004352 ')).toMatchObject({ ok: true, vehicle: { make: 'Honda' } })
  })

  it('explains network and server failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline')))
    )
    expect(await decodeVin('1HGCM82633A004352')).toMatchObject({ ok: false, error: expect.stringContaining('internet') })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 }))
    )
    expect(await decodeVin('1HGCM82633A004352')).toMatchObject({ ok: false, error: expect.stringContaining('503') })
  })
})
