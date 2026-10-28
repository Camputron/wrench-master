import { mkdtempSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, test } from './fixtures'

test.use({ appOptions: { data: 'java', settings: {} } })

test('backs up now, to a chosen folder, and restores a backup', async ({ app, page, menu, stubFileDialogs, dataDir }) => {
  const backupsIn = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.db'))

  // File > Back Up Now saves to Backups next to the database.
  await menu('Back Up Now')
  await expect(page.getByText('Backed up your data')).toBeVisible()
  const [manual] = backupsIn(join(dataDir, 'Backups')).filter((f) => f.endsWith('-manual.db'))
  expect(manual).toBeTruthy()

  // Preferences shows it, and can switch to another folder (right away, and Save doesn't undo it).
  await page.getByRole('button', { name: 'Shop menu' }).click()
  await page.getByRole('menuitem', { name: 'Preferences' }).click()
  const prefs = page.getByRole('dialog', { name: 'Preferences' })
  await expect(prefs.getByText('None yet')).toHaveCount(0)
  await expect(prefs.getByText('(default)')).toBeVisible()
  const elsewhere = mkdtempSync(join(tmpdir(), 'wrench-master-backups-'))
  await stubFileDialogs({ open: [elsewhere] })
  await prefs.getByRole('button', { name: 'Change folder…' }).click()
  await expect(prefs.getByText(elsewhere)).toBeVisible()
  await prefs.getByRole('button', { name: 'Back up now' }).click()
  await expect.poll(() => backupsIn(elsewhere)).toHaveLength(1)
  await prefs.getByRole('button', { name: 'Save' }).click()
  expect(await page.evaluate(() => window.api.settings.get().then((s) => s.backupFolder))).toBe(elsewhere)

  // Change the data, then restore the earlier backup (confirming), which brings the old data back.
  await page.evaluate(() => window.api.workOrders.delete(3))
  await stubFileDialogs({ open: [join(dataDir, 'Backups', manual)] })
  await app.evaluate(({ dialog }) => {
    const shown: string[] = []
    ;(globalThis as unknown as { shown: string[] }).shown = shown
    dialog.showMessageBox = (async (...args: unknown[]) => {
      shown.push((args.at(-1) as { message: string }).message)
      return { response: 0, checkboxChecked: false }
    }) as typeof dialog.showMessageBox
  })
  await menu('Restore from Backup…')
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { shown: string[] }).shown)).toEqual([expect.stringMatching(/^Restore the backup from .+\?$/), 'Backup restored'])
  await page.getByRole('tab', { name: 'Work Orders' }).click()
  await expect.poll(() => page.getByRole('grid', { name: 'Work orders' }).getByRole('rowheader').allTextContents()).toEqual(['3', '2', '1'])
  // The data from before the restore was backed up first, in the chosen folder.
  expect(backupsIn(elsewhere).some((f) => f.endsWith('-before-restore.db'))).toBe(true)
})
