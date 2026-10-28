import type { Page } from '@playwright/test'
import { closeApp, expect, launchApp, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: {} } })

const field = (scope: ReturnType<Page['locator']>, label: string): ReturnType<Page['locator']> => scope.locator('input, textarea').and(scope.getByLabel(label, { exact: true }))
const openTabs = (page: Page, name: string): Promise<string[]> => page.getByRole('navigation', { name }).getByRole('button').filter({ hasNotText: /^$/ }).allInnerTexts()
const totals = (page: Page): Promise<string> => page.locator('aside dl').filter({ visible: true }).innerText()

/** Starts an estimate for Jane Doe's Honda from her customer page, with one part and one labor line. */
async function quoteForJane(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Customers' }).click()
  await page.getByRole('grid', { name: 'Customers' }).getByRole('rowheader', { name: 'Doe, Jane' }).click()
  await page.getByRole('button', { name: /^New estimate for .*Honda/ }).click()
  await expect(page.getByRole('heading', { name: 'New estimate' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Estimates' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Last name')).toHaveValue('Doe')
  await expect(page.getByLabel('VIN')).toHaveValue('1HGCM82633A004352')

  await page.getByRole('button', { name: 'Add part' }).click()
  let dialog = page.getByRole('dialog', { name: 'Add part' })
  await dialog.getByRole('combobox', { name: 'Description' }).pressSequentially('brake')
  await page.getByRole('option', { name: /Brake pads front/ }).click()
  await dialog.getByRole('button', { name: 'Add part' }).click()
  await page.getByRole('button', { name: 'Add labor' }).click()
  dialog = page.getByRole('dialog', { name: 'Add labor' })
  await field(dialog, 'Description').fill('Replace front pads')
  await dialog.getByRole('button', { name: 'Add labor' }).click()
  // $45 part + $90 labor, 8.625% tax.
  await expect.poll(() => totals(page)).toMatch(/Parts\s+\$45\.00[\s\S]*Labor\s+\$90\.00[\s\S]*Tax\s+\$11\.64[\s\S]*Estimated total\s+\$146\.64/)
}

test('quotes a job, prints it, and turns it into a work order when accepted', async ({ page, menu }) => {
  await quoteForJane(page)
  await menu('Save')
  await expect(page.getByRole('heading', { name: 'Estimate E-00001' })).toBeVisible()
  expect(await openTabs(page, 'Open estimates')).toEqual(['All estimates', 'E-00001 · Doe'])

  // The printout is an estimate, with the authorization line.
  await menu('Print…')
  const preview = page.getByRole('dialog', { name: 'Print estimate E-00001' })
  const doc = preview.frameLocator('iframe')
  await expect(doc.getByText('Estimate E-00001')).toBeVisible()
  await expect(doc.getByText(/I authorize the repairs listed above/)).toBeVisible()
  await expect(doc.getByText('$146.64')).toBeVisible()
  await preview.getByRole('button', { name: 'Cancel' }).click()

  // Accepting creates work order #4 with the same lines and opens it.
  await page.getByRole('button', { name: 'Accept…' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Create work order' }).click()
  await expect(page.getByRole('heading', { name: 'Work order #4' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Work Orders' })).toHaveAttribute('aria-selected', 'true')
  const wo = await page.evaluate(() => window.api.workOrders.get(4))
  expect(wo!.parts.map((p) => p.name)).toEqual(['BP-100'])
  expect(wo!.labor.map((l) => l.desc)).toEqual(['Replace front pads'])

  // The estimate is now accepted, read-only, and links to the work order.
  await page.getByRole('tab', { name: 'Estimates' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'turned into work order #4' })).toBeVisible()
  const addPart = page.getByRole('button', { name: 'Add part' })
  await addPart.focus()
  await expect(addPart).not.toBeFocused()
  await expect(page.getByRole('button', { name: 'Accept…' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open work order #4' }).click()
  await expect(page.getByRole('heading', { name: 'Work order #4' })).toBeVisible()
})

test('declines and reopens an estimate, and finds it in the list', async ({ page, menu }) => {
  await quoteForJane(page)
  await page.getByRole('button', { name: 'Decline' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Declined' })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen' }).click()
  await expect(page.getByRole('button', { name: 'Accept…' })).toBeVisible()

  await page.getByRole('button', { name: 'All estimates' }).click()
  const ids = (): Promise<string[]> => page.getByRole('grid', { name: 'Estimates' }).getByRole('rowheader').allTextContents()
  await expect.poll(ids).toEqual(['E-00001'])
  await menu('Find')
  const search = page.getByRole('textbox', { name: 'Search estimates' })
  await expect(search).toBeFocused()
  const none = page.getByText('No estimates match these filters.')
  await search.fill('smith')
  await expect(none).toBeVisible()
  await search.fill('e1')
  await expect.poll(ids).toEqual(['E-00001'])
  await page
    .getByRole('button', { name: /^Open\s*Status$/ })
    .or(page.getByRole('button', { name: /^All\s*Status$/ }))
    .click()
  await page.getByRole('option', { name: 'Declined' }).click()
  await expect(none).toBeVisible()

  // The customer's page lists it too.
  await page.getByRole('tab', { name: 'Customers' }).click()
  await expect(page.getByRole('grid', { name: 'Estimates' }).filter({ visible: true }).getByRole('rowheader')).toHaveText(['E-00001'])
})

test('asks before closing an estimate with changes, and reopens open estimates after a restart', async ({ dataDir }) => {
  let { app, page } = await launchApp(dataDir)
  await page.getByRole('tab', { name: 'Dashboard' }).waitFor()
  const menu = (label: string): Promise<boolean> =>
    app.evaluate(({ Menu }, label) => {
      const queue = [...(Menu.getApplicationMenu()?.items ?? [])]
      while (queue.length) {
        const item = queue.shift()!
        if (item.label === label) {
          item.click()
          return true
        }
        if (item.submenu) queue.push(...item.submenu.items)
      }
      return false
    }, label)

  await quoteForJane(page)
  await menu('Close Tab')
  const ask = page.getByRole('alertdialog', { name: 'Discard this new estimate?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await menu('Save')
  await expect(page.getByRole('heading', { name: 'Estimate E-00001' })).toBeVisible()

  await closeApp(app)
  ;({ app, page } = await launchApp(dataDir))
  await page.getByRole('tab', { name: 'Estimates' }).click()
  await expect.poll(() => openTabs(page, 'Open estimates')).toEqual(['All estimates', 'E-00001 · Doe'])
  await closeApp(app)
})
