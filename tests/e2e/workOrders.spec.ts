import type { Page } from '@playwright/test'
import { closeApp, expect, launchApp, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: {} } })

const editor = (page: Page): ReturnType<Page['locator']> => page.locator('main')
const totals = (page: Page): Promise<string> => page.locator('aside dl').innerText()
const openTabs = (page: Page): Promise<string[]> => page.getByRole('navigation', { name: 'Open work orders' }).getByRole('button').filter({ hasNotText: /^$/ }).allInnerTexts()

/** The input for a labelled field (number fields also label their group and stepper buttons). */
const field = (scope: ReturnType<Page['locator']>, label: string): ReturnType<Page['locator']> => scope.locator('input, textarea').and(scope.getByLabel(label, { exact: true }))

/** Types into a number field and commits it. */
async function setNumber(dialog: ReturnType<Page['locator']>, label: string, value: string): Promise<void> {
  const input = field(dialog, label)
  await input.fill(value)
  await input.press('Tab')
}

test('builds, totals, and saves a work order', async ({ page, menu }) => {
  await menu('New Work Order')
  await expect(page.getByRole('heading', { name: 'New work order' })).toBeVisible()

  await page.getByRole('button', { name: 'Choose customer…' }).click()
  await page.getByRole('dialog', { name: 'Choose a customer' }).getByRole('rowheader').filter({ hasText: 'Doe, Jane' }).click()
  await expect(editor(page).getByLabel('Last name')).toHaveValue('Doe')
  await page.getByRole('button', { name: 'Choose vehicle…' }).click()
  await page.getByRole('dialog', { name: 'Choose a vehicle' }).getByRole('rowheader').first().click()
  await expect(editor(page).getByLabel('VIN')).toHaveValue('1HGCM82633A004352')

  // A part from the catalog, two of them.
  await page.getByRole('button', { name: 'Add part' }).click()
  let dialog = page.getByRole('dialog', { name: 'Add part' })
  await dialog.getByRole('combobox', { name: 'Description' }).pressSequentially('brake')
  await page.getByRole('option', { name: /Brake pads front/ }).click()
  await expect(dialog.getByLabel('Part number')).toHaveValue('BP-100')
  await setNumber(dialog, 'Quantity', '2')
  await dialog.getByRole('button', { name: 'Add part' }).click()

  // A new, non-taxed part gets a suggested part number.
  await page.getByRole('button', { name: 'Add part' }).click()
  dialog = page.getByRole('dialog', { name: 'Add part' })
  await dialog.getByRole('combobox', { name: 'Description' }).fill('Oil filter')
  await dialog.getByRole('combobox', { name: 'Description' }).press('Tab')
  await expect(dialog.getByLabel('Part number')).toHaveValue('OILFIER')
  await setNumber(dialog, 'Price (each)', '8')
  await dialog.getByText('Taxable').click()
  await dialog.getByRole('button', { name: 'Add part' }).click()

  // Labor described from the parts, at the shop's default rate.
  await page.getByRole('button', { name: 'Add labor' }).click()
  dialog = page.getByRole('dialog', { name: 'Add labor' })
  await expect(field(dialog, 'Rate (per hour)')).toHaveValue('$90.00')
  await dialog.getByRole('button', { name: 'Describe from parts' }).click()
  await expect(field(dialog, 'Description')).toHaveValue('Installed Brake pads front, Oil filter')
  await setNumber(dialog, 'Billed hours', '1.5')
  await dialog.getByRole('button', { name: 'Add labor' }).click()

  // $98 parts + $135 labor; 8.625% tax on the taxable $225.
  await expect.poll(() => totals(page)).toMatch(/Parts\s+\$98\.00[\s\S]*Labor\s+\$135\.00[\s\S]*Tax\s+\$19\.41[\s\S]*Total\s+\$252\.41[\s\S]*Balance due\s+\$252\.41/)

  await page.getByRole('button', { name: 'Add payment' }).click()
  dialog = page.getByRole('dialog', { name: 'Add payment' })
  await dialog.getByRole('button', { name: 'Pay full balance' }).click()
  await dialog.getByRole('button', { name: 'Add payment' }).click()
  await expect.poll(() => totals(page)).toMatch(/Balance due\s+\$0\.00/)

  await menu('Save Work Order')
  await expect(page.getByRole('heading', { name: 'Work order #4' })).toBeVisible()
  await expect(page.locator('main header').getByText('Unsaved changes')).toBeHidden()

  const stored = await page.evaluate(() => window.api.workOrders.get(4))
  expect(stored).toMatchObject({ customer: { id: 1, lastName: 'Doe' }, vehicle: { make: 'Honda' } })
  expect(stored!.parts.map((p) => [p.name, p.quantity, p.taxable])).toEqual([
    ['BP-100', 2, true],
    ['OILFIER', 1, false]
  ])
  expect(stored!.labor.map((l) => [l.billedHrs, l.rate])).toEqual([[1.5, 90]])
  expect(stored!.payments.map((p) => p.amount)).toEqual([252.41])
  expect(await page.evaluate(() => window.api.parts.search('oil').then((r) => r.map((p) => p.name)))).toEqual(['OILFIER'])
})

test('undo and redo line changes from the buttons and the Edit menu', async ({ page, menu }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'Work order #1' })).toBeVisible()
  const parts = page.getByRole('grid', { name: 'Parts' })
  await expect(parts.getByRole('row')).toHaveCount(3)

  await parts.getByRole('button', { name: /^Remove part Shop supplies/ }).click()
  await expect(parts.getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(parts.getByRole('row')).toHaveCount(3)
  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(parts.getByRole('row')).toHaveCount(2)

  await page.getByRole('heading', { name: 'Work order #1' }).click() // focus outside any text field
  await expect(page.locator('input:focus, textarea:focus')).toHaveCount(0)
  await menu('Undo')
  await expect(parts.getByRole('row')).toHaveCount(3)

  // While typing in a field, Edit > Undo undoes the typing instead.
  const color = editor(page).getByRole('combobox', { name: 'Color' })
  await color.click()
  await color.press('End')
  await color.pressSequentially('XYZ')
  await menu('Undo')
  await expect(color).not.toHaveValue('BlueXYZ')
  await expect(parts.getByRole('row')).toHaveCount(3)
})

test('asks before discarding unsaved changes', async ({ page }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await editor(page).getByLabel('Mileage out').fill('100099')
  await expect(page.locator('main header').getByText('Unsaved changes')).toBeVisible()

  await page.getByRole('button', { name: 'Close #1 · Doe' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Discard changes to work order #1?' })
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Work order #1' })).toBeVisible()

  await page.getByRole('button', { name: 'Close #1 · Doe' }).click()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('grid', { name: 'Work orders' })).toBeVisible()
  expect(await page.evaluate(() => window.api.workOrders.get(1).then((w) => w?.vehicle.mileageOut))).toBe('100050')
})

test('warns before quitting with unsaved changes', async ({ app, page }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('button', { name: 'New work order' }).click()
  await editor(page).getByLabel('First name').fill('Zed')

  // Answer the native prompt with "Cancel" and record what it said.
  await app.evaluate(({ dialog }) => {
    const shown: string[] = []
    ;(globalThis as unknown as { shown: string[] }).shown = shown
    dialog.showMessageBoxSync = ((...args: unknown[]) => {
      const options = args.at(-1) as { message: string; buttons: string[] }
      shown.push(`${options.message} | ${options.buttons.join('/')}`)
      return 1
    }) as typeof dialog.showMessageBoxSync
  })
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0].close(), true))).toBe(true)
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { shown: string[] }).shown)).toEqual(['A work order has unsaved changes | Quit Without Saving/Cancel'])
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
})

test('"Quit Without Saving" quits, even when quitting with Cmd+Q', async ({ dataDir }) => {
  const { app, page } = await launchApp(dataDir)
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('button', { name: 'New work order' }).click()
  await editor(page).getByLabel('First name').fill('Zed')
  await expect(page.locator('main header').getByText('Unsaved changes')).toBeVisible()
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBoxSync = (() => 0) as typeof dialog.showMessageBoxSync // "Quit Without Saving"
  })
  const exited = new Promise<void>((resolve) => app.process().once('exit', () => resolve()))
  await app.evaluate(({ app }) => app.quit()) // what Cmd+Q / File > Exit do
  await exited
})

test('reopens the work orders that were open last time', async ({ dataDir }) => {
  let { app, page } = await launchApp(dataDir)
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader', { name: '2', exact: true }).dblclick()
  await expect(page.getByRole('heading', { name: 'Work order #2' })).toBeVisible()
  await closeApp(app)
  ;({ app, page } = await launchApp(dataDir))
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await expect.poll(() => openTabs(page)).toContain('#2 · Smith')
  await closeApp(app)
})

test('searches and filters the list, and deleting closes an open editor', async ({ page }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  const ids = (): Promise<string[]> => page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader').allTextContents()
  await expect.poll(ids).toEqual(['3', '2', '1'])
  const search = page.getByRole('textbox', { name: 'Search work orders' })
  await search.fill('honda')
  await expect.poll(ids).toEqual(['1'])
  await search.fill('')
  await page.getByRole('button', { name: /^All\s*Status$/ }).click()
  await page.getByRole('option', { name: 'Open' }).click()
  await expect.poll(ids).toEqual(['3', '2'])

  await page.getByRole('rowheader', { name: '2', exact: true }).dblclick()
  await page.getByRole('button', { name: 'All work orders' }).click()
  await page.getByRole('button', { name: 'Delete work order #2' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete work order' }).click()
  await expect.poll(ids).toEqual(['3'])
  await expect.poll(() => openTabs(page)).toEqual(['All work orders'])
})

test.describe('with a full database', () => {
  test.use({ appOptions: { data: 'demo', settings: {} } })

  test('loads more work orders as the list is scrolled, and keeps the search when switching pages', async ({ page }) => {
    await page.getByRole('tab', { name: 'Work Orders' }).click()
    const grid = page.getByRole('grid', { name: 'Work orders' })
    const rowCount = (): Promise<number> => grid.getByRole('rowheader').count()
    await expect.poll(rowCount).toBe(50)
    // Scroll to the end until everything has loaded (the demo data has a few hundred).
    await expect
      .poll(async () => {
        await grid.evaluate((el) => {
          const scroller = el.closest('[data-slot=table-scroll-container]')!
          scroller.scrollTop = scroller.scrollHeight
        })
        return rowCount()
      })
      .toBeGreaterThan(200)

    // A new search starts back at the first page.
    const search = page.getByRole('textbox', { name: 'Search work orders' })
    await search.fill('kim')
    await expect.poll(rowCount).toBeLessThanOrEqual(50)
    const found = await rowCount()

    // Pages stay as they were left.
    await page.getByRole('tab', { name: 'Customers' }).click()
    await page.getByRole('tab', { name: 'Work Orders' }).click()
    await expect(search).toHaveValue('kim')
    expect(await rowCount()).toBe(found)
  })
})
