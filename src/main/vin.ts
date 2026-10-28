import type { VinDecodeResult } from '../shared/types'

const VPIC_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/'

/** Makes NHTSA reports in capitals that should stay that way. Others are title-cased ("HONDA" -> "Honda"). */
const UPPERCASE_MAKES = new Set(['BMW', 'GMC', 'RAM', 'MINI', 'AMC', 'MG', 'BYD'])

const titleCase = (s: string): string => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase())

function formatMake(make: string): string {
  return make
    .split(/\s+/)
    .map((w) => (UPPERCASE_MAKES.has(w.toUpperCase()) ? w.toUpperCase() : titleCase(w)))
    .join(' ')
}

/** e.g. "2.4L I4", "5.7L V8 Diesel", "Electric" */
export function formatEngine(r: Record<string, string>): string {
  const parts: string[] = []
  const liters = Number(r.DisplacementL)
  if (r.DisplacementL && Number.isFinite(liters) && liters > 0) parts.push(`${liters.toFixed(1)}L`)
  const cylinders = r.EngineCylinders
  if (cylinders) {
    const config = r.EngineConfiguration ?? ''
    const prefix = /^V/i.test(config) ? 'V' : /^In-?Line/i.test(config) ? 'I' : /^W/i.test(config) ? 'W' : /opposed|boxer/i.test(config) ? 'H' : null
    parts.push(prefix ? `${prefix}${cylinders}` : `${cylinders}-cyl`)
  }
  const fuel = r.FuelTypePrimary ?? ''
  if (fuel && !/^gasoline$/i.test(fuel)) parts.push(fuel.replace(/\s*\(.*\)/, ''))
  return parts.join(' ')
}

/** e.g. "6-Speed Automatic", "Manual", "CVT" */
export function formatTransmission(r: Record<string, string>): string {
  let style = r.TransmissionStyle ?? ''
  if (/continuously variable/i.test(style)) return 'CVT'
  if (/manual/i.test(style)) style = 'Manual'
  else if (/^automatic$/i.test(style) || /automated manual/i.test(style)) style = style.split('(')[0].trim()
  return style && r.TransmissionSpeeds ? `${r.TransmissionSpeeds}-Speed ${style}` : style
}

/** Turns a vPIC `DecodeVinValues` result row into the fields the app stores. */
export function parseVpicResult(r: Record<string, string>): VinDecodeResult {
  const errorCodes = (r.ErrorCode ?? '').split(',').map((c) => c.trim())
  const message = (r.ErrorText ?? '')
    .split(';')[0]
    .replace(/^\d+\s*-\s*/, '')
    .trim()
  if (!r.Make) return { ok: false, error: message || 'NHTSA couldn’t find a vehicle for this VIN.' }
  return {
    ok: true,
    vehicle: {
      year: r.ModelYear ?? '',
      make: formatMake(r.Make),
      model: r.Model ?? '',
      engine: formatEngine(r),
      transmission: formatTransmission(r)
    },
    warning: errorCodes.every((c) => c === '0' || c === '') ? undefined : message || undefined
  }
}

export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const clean = vin.trim().toUpperCase()
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(clean)) return { ok: false, error: 'A VIN has 17 letters and numbers (no I, O, or Q).' }
  try {
    const response = await fetch(`${VPIC_URL}${encodeURIComponent(clean)}?format=json`, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return { ok: false, error: `NHTSA’s VIN service returned an error (${response.status}). Try again later.` }
    const body = (await response.json()) as { Results?: Record<string, string>[] }
    const row = body.Results?.[0]
    return row ? parseVpicResult(row) : { ok: false, error: 'NHTSA’s VIN service returned no results.' }
  } catch {
    return { ok: false, error: 'Couldn’t reach NHTSA’s VIN service. Check your internet connection and try again.' }
  }
}
