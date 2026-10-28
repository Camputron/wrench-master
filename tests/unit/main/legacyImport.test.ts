import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { inspectLegacyDatabase, parseJavaPreferences } from '../../../src/main/legacyImport'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

describe('Java preferences.config', () => {
  it('maps every key the Java app wrote', () => {
    const text = [
      'company=Joe Auto',
      'address=1 Main St',
      'city=Flushing',
      'state=New York',
      'zip=11355',
      'phone=718-555-0100',
      'repair-shop-id=7012345',
      'title=NYS Inspection',
      'labor-rate=110.0',
      'tax-rate=0.08875',
      'gui-scale=Large',
      'theme=Dark',
      'confirm-exit=true'
    ].join('\r\n')
    expect(parseJavaPreferences(text)).toEqual({
      shop: { company: 'Joe Auto', street: '1 Main St', city: 'Flushing', zip: '11355', phone: '718-555-0100', repairShopId: '7012345', invoiceTitle: 'NYS Inspection', state: 'NEW_YORK' },
      laborRate: 110,
      taxRate: 0.08875,
      theme: 'dark',
      zoom: 1.25,
      confirmExit: true
    })
  })

  it('drops the Java default of 1.08625 (108% tax) and unknown values', () => {
    const p = parseJavaPreferences('tax-rate=1.08625\nstate=Atlantis\ngui-scale=Huge\ntheme=Blue\nlabor-rate=abc\ncompany=A=B Motors')
    expect(p).toEqual({ shop: { company: 'A=B Motors', state: 'UNKNOWN' } })
  })
})

describe('recognizing a Java database', () => {
  it('counts customers and work orders in a real one', () => {
    expect(inspectLegacyDatabase(createJavaDb(tempDir()))).toEqual({ customers: 2, workOrders: 3 })
  })

  it('rejects files that aren’t one', () => {
    const dir = tempDir()
    const junk = join(dir, 'junk.db')
    writeFileSync(junk, 'not a database')
    expect(inspectLegacyDatabase(junk)).toBeNull()
    expect(inspectLegacyDatabase(join(dir, 'missing.db'))).toBeNull()
  })
})
