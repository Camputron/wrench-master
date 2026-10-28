import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: {} } })

const openTabs = (page: Page): Promise<string[]> => page.getByRole('navigation', { name: 'Open work orders' }).getByRole('button').filter({ hasNotText: /^$/ }).allInnerTexts()
const listIds = (page: Page): Promise<string[]> => page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader').allTextContents()

test('voids a paid work order instead of deleting it, and restores it', async ({ page }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await expect.poll(() => listIds(page)).toEqual(['3', '2', '1'])
  // #2 has no payments, so it can still be deleted; #1 has payments, so it's voided.
  await expect(page.getByRole('button', { name: 'Delete work order #2' })).toBeVisible()
  await page.getByRole('button', { name: 'Void work order #1' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('voided rather than deleted')
  await confirm.getByRole('button', { name: 'Void work order' }).click()
  await expect(page.getByText('Voided work order #1')).toBeVisible()
  await expect.poll(() => listIds(page)).toEqual(['3', '2', '1'])
  const row1 = page
    .getByRole('grid', { name: 'Work orders' })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: '1', exact: true }) })
  await expect(row1).toContainText(/Voided \d\d\/\d\d\/\d{4}/)

  await page.getByRole('button', { name: /^All\s*Status$/ }).click()
  await page.getByRole('option', { name: 'Voided' }).click()
  await expect.poll(() => listIds(page)).toEqual(['1'])

  // Its editor is read-only, with a way back.
  await page.getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Voided on' })).toBeVisible()
  // Inert: nothing in it can be focused or clicked.
  const addPart = page.getByRole('button', { name: 'Add part' })
  await addPart.focus()
  await expect(addPart).not.toBeFocused()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Restored work order #1')).toBeVisible()
  await addPart.focus()
  await expect(addPart).toBeFocused()
  await expect(page.locator('header').getByText(/^Completed/)).toBeVisible()
})

test('Close Tab (Cmd/Ctrl+W) closes the tab, asking first if there are changes', async ({ page, menu }) => {
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await page.getByRole('rowheader', { name: '1', exact: true }).dblclick()
  await expect.poll(() => openTabs(page)).toEqual(['All work orders', '#1 · Doe'])
  await menu('Close Tab')
  await expect.poll(() => openTabs(page)).toEqual(['All work orders'])

  // Delete on a focused line removes it (undoably), which leaves unsaved changes.
  await page.getByRole('rowheader', { name: '1', exact: true }).dblclick()
  const parts = page.getByRole('grid', { name: 'Parts' })
  await expect(parts.getByRole('row')).toHaveCount(3)
  await parts.getByRole('row').nth(1).focus()
  await page.keyboard.press('Delete')
  await expect(parts.getByRole('row')).toHaveCount(2)
  await expect(page.locator('header').getByText('Unsaved changes', { exact: true })).toBeVisible()

  await menu('Close Tab')
  const ask = page.getByRole('alertdialog', { name: 'Discard changes to work order #1?' })
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await menu('Undo')
  await expect(parts.getByRole('row')).toHaveCount(3)
  await menu('Close Tab')
  await expect.poll(() => openTabs(page)).toEqual(['All work orders'])
})

test('Find (Cmd/Ctrl+F) jumps to the search on the customer or work order list', async ({ page, menu }) => {
  // From the dashboard (or a work order), it goes to the work order list.
  await menu('Find')
  await expect(page.getByRole('textbox', { name: 'Search work orders' })).toBeFocused()
  await page.getByRole('tab', { name: 'Customers' }).click()
  await page.getByRole('button', { name: 'New customer' }).focus()
  await menu('Find')
  await expect(page.getByRole('textbox', { name: 'Search customers' })).toBeFocused()
})
