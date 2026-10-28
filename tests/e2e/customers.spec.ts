import { expect, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: {} } })

test.beforeEach(async ({ page }) => {
  await page.getByRole('tab', { name: 'Customers' }).click()
})

const rowNames = (page: import('@playwright/test').Page): Promise<string[]> => page.getByRole('grid', { name: 'Customers' }).getByRole('rowheader').allTextContents()

test('searches across names, phone numbers, and companies', async ({ page }) => {
  const search = page.getByRole('textbox', { name: 'Search customers' })
  await expect.poll(() => rowNames(page)).toEqual(['Doe, Jane', 'Smith, Bob'])
  await search.fill('5551234')
  await expect.poll(() => rowNames(page)).toEqual(['Doe, Jane'])
  await search.fill('acme')
  await expect.poll(() => rowNames(page)).toEqual(['Smith, Bob'])
  await search.fill('zzz')
  await expect(page.getByText('No customers match “zzz”.')).toBeVisible()
})

test('adds a customer with validation, formatting, and duplicate checks', async ({ page }) => {
  await page.getByRole('button', { name: 'New customer' }).click()
  const dialog = page.getByRole('dialog', { name: 'New customer' })
  await dialog.getByRole('button', { name: 'Add customer' }).click()
  await expect(dialog.getByText('Enter a name or a company.')).toBeVisible()

  await dialog.getByLabel('First name').fill('Al')
  await dialog.getByLabel('Last name').fill('Rivera')
  await dialog.getByLabel('Phone').pressSequentially('(718) 555 0100')
  await expect(dialog.getByLabel('Phone')).toHaveValue('718-555-0100')
  await dialog.getByLabel('Email').fill('al@')
  await dialog.getByRole('button', { name: 'Add customer' }).click()
  await expect(dialog.getByText('Enter a valid email address, or leave it blank.')).toBeVisible()
  await dialog.getByLabel('Email').fill('al@rivera.com')
  await dialog.getByRole('combobox', { name: 'Company' }).pressSequentially('Ac')
  await page.getByRole('option', { name: 'Acme_Corp' }).click()
  await dialog.getByRole('button', { name: 'Add customer' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Al Rivera' })).toBeVisible()
  await expect.poll(() => rowNames(page)).toEqual(['Doe, Jane', 'Rivera, Al', 'Smith, Bob'])

  // The exact same details again are refused.
  await page.getByRole('button', { name: 'New customer' }).click()
  const again = page.getByRole('dialog', { name: 'New customer' })
  await again.getByLabel('First name').fill('Al')
  await again.getByLabel('Last name').fill('Rivera')
  await again.getByLabel('Phone').fill('7185550100')
  await again.getByLabel('Email').fill('al@rivera.com')
  await again.getByRole('combobox', { name: 'Company' }).fill('Acme_Corp')
  await again.getByRole('combobox', { name: 'Company' }).press('Tab') // closes the suggestion list, like moving to the next field
  await again.getByRole('button', { name: 'Add customer' }).click()
  await expect(again.getByText('A customer with exactly these details already exists.')).toBeVisible()
})

test('adds and removes vehicles, refusing a duplicate VIN', async ({ page }) => {
  await page.getByRole('rowheader', { name: 'Smith, Bob' }).click()
  await page.getByRole('button', { name: 'Add vehicle' }).click()
  const dialog = page.getByRole('dialog', { name: 'New vehicle' })
  await dialog.getByLabel('VIN').pressSequentially('1hgcm 82633a0o04352')
  await expect(dialog.getByLabel('VIN')).toHaveValue('1HGCM82633A004352')
  await dialog.getByRole('combobox', { name: 'Make' }).fill('Honda')
  await dialog.getByRole('combobox', { name: 'Make' }).press('Tab')
  await dialog.getByRole('button', { name: 'Add vehicle' }).click()
  await expect(dialog).toBeHidden()
  const vehicles = page.getByRole('grid', { name: 'Vehicles' })
  await expect(vehicles.getByRole('row')).toHaveCount(2) // header + 1

  await page.getByRole('button', { name: 'Add vehicle' }).click()
  const again = page.getByRole('dialog', { name: 'New vehicle' })
  await again.getByLabel('VIN').fill('1HGCM82633A004352')
  await again.getByRole('button', { name: 'Add vehicle' }).click()
  await expect(again.getByText('This customer already has a vehicle with this VIN.')).toBeVisible()
  await again.getByRole('button', { name: 'Cancel' }).click()

  await vehicles.getByRole('button', { name: /^Delete / }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete vehicle' }).click()
  await expect(vehicles.getByText('No vehicles yet.')).toBeVisible()
})

test('deleting a customer keeps their work orders', async ({ page }) => {
  await page.getByRole('rowheader', { name: 'Doe, Jane' }).click()
  await page.getByRole('button', { name: 'Delete customer' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete customer' }).click()
  await expect.poll(() => rowNames(page)).toEqual(['Smith, Bob'])
  expect(await page.evaluate(() => window.api.workOrders.get(1).then((w) => w?.customer.lastName))).toBe('Doe')
})

test('File > New Customer opens the form from any page', async ({ page, menu }) => {
  await page.getByRole('tab', { name: 'Dashboard' }).click()
  await menu('New Customer…')
  await expect(page.getByRole('dialog', { name: 'New customer' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Customers' })).toHaveAttribute('aria-selected', 'true')
})
