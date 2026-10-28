import { readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { closeApp, expect, launchApp, test } from './fixtures'
import { createJavaDb } from '../fixtures/javaDb'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'

test.use({ appOptions: { data: 'empty', settings: {} } })

test('saves preferences, applies the theme live, and keeps them after a restart', async ({ dataDir }) => {
  let { app, page } = await launchApp(dataDir)
  await expect(page.locator('html')).toHaveClass(/light/)
  await page.getByRole('button', { name: 'Shop menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences' }).click()
  const prefs = page.getByRole('dialog', { name: 'Preferences' })
  await prefs.getByLabel('Company name').fill("Joe's Auto Body")
  await prefs.getByRole('button', { name: /Theme/ }).click()
  await page.getByRole('option', { name: 'Dark' }).click()
  await prefs.getByRole('button', { name: 'Save' }).click()
  await expect(prefs).toBeHidden()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('button', { name: 'Shop menu' })).toHaveText('JA')

  // Cancel throws edits away.
  await page.getByRole('button', { name: 'Shop menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences' }).click()
  await page.getByRole('dialog', { name: 'Preferences' }).getByLabel('Company name').fill('Nope')
  await page.getByRole('dialog', { name: 'Preferences' }).getByRole('button', { name: 'Cancel' }).click()

  await closeApp(app)
  ;({ app, page } = await launchApp(dataDir))
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => window.api.settings.get().then((s) => [s.shop.company, s.theme]))).toEqual(["Joe's Auto Body", 'dark'])
  await closeApp(app)
})

test('imports a database and preferences from the Java app', async ({ app, page, menu, stubFileDialogs, dataDir }) => {
  const javaDir = mkdtempSync(join(tmpdir(), 'wrench-master-java-'))
  const javaDb = createJavaDb(javaDir)
  writeFileSync(join(javaDir, 'preferences.config'), 'company=Old Shop\nstate=New Jersey\ntax-rate=0.06625\n')
  await stubFileDialogs({ open: [javaDb] })
  // Confirm the import (keeping "also import preferences" checked), then dismiss the result.
  await app.evaluate(({ dialog }) => {
    const shown: string[] = []
    ;(globalThis as unknown as { shown: string[] }).shown = shown
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = args.at(-1) as { message: string; checkboxChecked?: boolean }
      shown.push(options.message)
      return { response: 0, checkboxChecked: options.checkboxChecked ?? false }
    }) as typeof dialog.showMessageBox
  })

  await page.getByRole('tab', { name: 'Customers' }).click()
  await expect(page.getByText(/No customers yet/)).toBeVisible()
  await menu('Import from Autoshop Invoice Manager…')

  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { shown: string[] }).shown)).toEqual(['Replace all current data?', 'Import complete'])
  await expect(page.getByRole('grid', { name: 'Customers' }).getByRole('rowheader')).toHaveText(['Doe, Jane', 'Smith, Bob'])
  expect(await page.evaluate(() => window.api.settings.get().then((s) => [s.shop.company, s.shop.state, s.taxRate]))).toEqual(['Old Shop', 'NEW_JERSEY', 0.06625])
  // The previous (empty) database was backed up next to the new one.
  expect(readdirSync(dataDir).some((f) => f.startsWith('autoshop-backup-'))).toBe(true)
})
