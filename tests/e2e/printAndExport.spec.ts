import ExcelJS from 'exceljs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { expect, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: { shop: { company: "Joe's Auto Body", state: 'NEW_YORK', repairShopId: '7012345' } } } })

test('previews the invoice and saves it as a PDF', async ({ page, dataDir, stubFileDialogs, menu }) => {
  const pdf = join(dataDir, 'invoice.pdf')
  await stubFileDialogs({ save: [pdf] })
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await menu('Print Work Order…')

  const preview = page.getByRole('dialog', { name: 'Print work order #1' })
  const invoice = preview.frameLocator('iframe')
  await expect(invoice.getByText("Joe's Auto Body")).toBeVisible()
  await expect(invoice.getByText('NYS Repair Shop #7012345')).toBeVisible()
  await expect(invoice.getByText('Work order #00001')).toBeVisible()
  await expect(invoice.getByRole('row', { name: /Amount due/ })).toContainText('$104.41')

  await preview.getByRole('button', { name: 'Save as PDF…' }).click()
  await expect(page.getByText('Saved the invoice as a PDF')).toBeVisible()
  expect(readFileSync(pdf).subarray(0, 5).toString()).toBe('%PDF-')
})

test('sends the invoice to the system print dialog', async ({ app, page }) => {
  // Stand in for the OS print dialog: record the request, then "cancel".
  await app.evaluate(({ BrowserWindow }) => {
    const proto = Object.getPrototypeOf(BrowserWindow.getAllWindows()[0].webContents)
    ;(globalThis as unknown as { printed: unknown[] }).printed = []
    proto.print = function (options: unknown, callback: (ok: boolean, reason: string) => void) {
      ;(globalThis as unknown as { printed: unknown[] }).printed.push({ options, url: this.getURL().slice(0, 15) })
      callback(false, 'Print job canceled')
    }
  })
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await page.getByRole('button', { name: 'Print…' }).click()
  await page.getByRole('dialog', { name: 'Print work order #1' }).getByRole('button', { name: 'Print…' }).click()
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { printed: unknown[] }).printed)).toEqual([{ options: { silent: false, printBackground: true }, url: 'data:text/html;' }])
  // Cancelling isn't an error: the preview stays open.
  await expect(page.getByRole('dialog', { name: 'Print work order #1' })).toBeVisible()
})

test('exports every kind of data to Excel', async ({ page, dataDir, stubFileDialogs, menu }) => {
  const files = { customers: join(dataDir, 'c.xlsx'), vehicles: join(dataDir, 'v.xlsx'), workOrders: join(dataDir, 'w.xlsx'), parts: join(dataDir, 'p.xlsx') }
  await stubFileDialogs({ save: Object.values(files) })
  for (const [label, message] of [
    ['Customers…', 'Exported 2 customers'],
    ['Vehicles…', 'Exported 1 vehicle'],
    ['Work Orders…', 'Exported 3 work orders'],
    ['Parts Catalog…', 'Exported 1 catalog part']
  ]) {
    await menu(label)
    await expect(page.getByText(message)).toBeVisible()
  }
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(files.workOrders)
  expect(book.worksheets.map((w) => w.name)).toEqual(['Work orders', 'Parts', 'Labor', 'Payments'])
  // Cancelling the save dialog exports nothing and says nothing.
  await menu('Customers…')
  await expect(page.getByText('Exported 2 customers')).toHaveCount(1)
})
