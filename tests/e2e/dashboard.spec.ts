import { expect, test } from './fixtures'

test('shows the shop’s numbers, matching the database', async ({ page }) => {
  const stats = await page.evaluate(() => window.api.workOrders.stats())
  const tile = (label: RegExp): ReturnType<typeof page.locator> =>
    page
      .locator('div')
      .filter({ has: page.getByText(label, { exact: true }) })
      .last()

  await expect(tile(/^Completed in (January|February|March|April|May|June|July|August|September|October|November|December)$/)).toContainText(String(stats.completedThisMonth))
  await expect(tile(/^Open work orders$/)).toContainText(String(stats.openCount))
  const unpaid = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.unpaidTotal)
  await expect(tile(/^Unpaid balance$/)).toContainText(unpaid)
  await expect(page.getByRole('heading', { name: `Open work orders (${stats.openCount})` })).toBeVisible()
})

test('income chart has a readout per month and a table view with yearly totals', async ({ page }) => {
  const year = new Date().getFullYear()
  const months = await page.evaluate((y) => window.api.workOrders.incomeByMonth(y), year)
  const money = (n: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

  await expect(page.getByRole('img', { name: new RegExp(`^January ${year}: created`) })).toBeVisible()
  await expect(page.getByRole('img', { name: new RegExp(`${year}: created`) })).toHaveCount(12)

  await page.getByRole('img', { name: new RegExp(`^March ${year}`) }).hover()
  await expect(page.getByRole('presentation').filter({ hasText: `March ${year}` })).toContainText(money(months[2].expected))

  await page.getByRole('button', { name: 'Show table' }).click()
  const total = page.getByRole('table').getByRole('row', { name: /^Total/ })
  await expect(total).toContainText(money(months.reduce((s, m) => s + m.expected, 0)))
  await expect(total).toContainText(money(months.reduce((s, m) => s + m.actual, 0)))
})

test('double-clicking an open work order opens it in the editor', async ({ page }) => {
  const table = page.getByRole('grid', { name: 'Open work orders' })
  const firstId = await table.getByRole('rowheader').first().textContent()
  await table.getByRole('rowheader').first().dblclick()
  await expect(page.getByRole('heading', { name: `Work order #${firstId}` })).toBeVisible()
})
