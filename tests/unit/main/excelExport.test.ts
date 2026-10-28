import ExcelJS from 'exceljs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { balance } from '../../../src/shared/billing'
import { createRepos, type Repos } from '../../../src/main/db'
import { EXPORT_FILE_NAMES, exportToExcel, type ExportKind } from '../../../src/main/excelExport'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

let r: Repos
let dir: string
beforeEach(() => {
  dir = tempDir()
  r = createRepos(createJavaDb(dir))
})
afterEach(() => r.db.close())

async function exportAndRead(kind: ExportKind): Promise<{ count: number; book: ExcelJS.Workbook }> {
  const path = join(dir, EXPORT_FILE_NAMES[kind])
  const count = await exportToExcel(kind, r, path)
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(path)
  return { count, book }
}

const header = (sheet: ExcelJS.Worksheet): unknown[] => (sheet.getRow(1).values as unknown[]).slice(1)

describe('Excel export', () => {
  it('exports customers with readable headers and state abbreviations', async () => {
    const { count, book } = await exportAndRead('customers')
    const sheet = book.getWorksheet('Customers')!
    expect(count).toBe(2)
    expect(sheet.rowCount - 1).toBe(2)
    expect(header(sheet)).toEqual(['Customer #', 'First name', 'Last name', 'Company', 'Phone', 'Email', 'Street', 'City', 'State', 'ZIP'])
    expect(sheet.getRow(2).getCell(9).value).toBe('NY')
    expect(sheet.getRow(1).font?.bold).toBe(true)
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })

  it('exports vehicles with their owner', async () => {
    const { count, book } = await exportAndRead('vehicles')
    expect(count).toBe(1)
    expect((book.getWorksheet('Vehicles')!.getRow(2).values as unknown[]).slice(1, 6)).toEqual(['Jane Doe', '', '2003', 'Honda', 'Accord'])
  })

  it('exports work orders with totals, plus parts, labor, and payments sheets', async () => {
    const { count, book } = await exportAndRead('workOrders')
    expect(count).toBe(3)
    expect(book.worksheets.map((w) => w.name)).toEqual(['Work orders', 'Parts', 'Labor', 'Payments'])
    const sheet = book.getWorksheet('Work orders')!
    const last = sheet.getRow(sheet.rowCount)
    expect(last.getCell(1).value).toBe(1)
    expect((last.getCell(2).value as Date).toISOString().slice(0, 10)).toBe('2024-03-05')
    expect(last.getCell(2).numFmt).toBe('mm/dd/yyyy')
    expect(last.getCell(16).value).toBe(Math.round(balance(r.workOrders.getById(1)!) * 100) / 100)
    expect(last.getCell(16).numFmt).toBe('$#,##0.00')
    expect(book.getWorksheet('Parts')!.rowCount - 1).toBe(2)
    expect(book.getWorksheet('Labor')!.rowCount - 1).toBe(2)
    expect(book.getWorksheet('Payments')!.rowCount - 1).toBe(2)
  })

  it('exports the parts catalog', async () => {
    const { count, book } = await exportAndRead('parts')
    expect(count).toBe(1)
    expect((book.getWorksheet('Parts catalog')!.getRow(2).values as unknown[]).slice(1)).toEqual(['BP-100', 'Brake pads front', 45, 30, 'Yes'])
  })
})
