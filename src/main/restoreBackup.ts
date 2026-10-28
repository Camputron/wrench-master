import { dialog, type BrowserWindow } from 'electron'
import { mkdirSync } from 'fs'
import { basename } from 'path'
import { parseBackupName } from './backups'
import { inspectLegacyDatabase, unsavedWarning } from './legacyImport'
import type { Services } from './services'

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** File > Restore from Backup: replaces the app's data with a backup, after saving a backup of the current data. */
export async function restoreFromBackup(win: BrowserWindow, services: Services): Promise<void> {
  const folder = services.backupFolder()
  mkdirSync(folder, { recursive: true })
  const picked = await dialog.showOpenDialog(win, {
    title: 'Restore from Backup',
    message: 'Choose a backup to restore.',
    buttonLabel: 'Restore',
    defaultPath: folder,
    filters: [{ name: 'Backup', extensions: ['db'] }],
    properties: ['openFile']
  })
  const source = picked.filePaths[0]
  if (picked.canceled || !source) return

  // Backups have the same tables as the Java app's database.
  const counts = inspectLegacyDatabase(source)
  if (!counts) {
    await dialog.showMessageBox(win, { type: 'error', message: 'This file isn’t a backup', detail: `${basename(source)} doesn’t have the customer and work order tables the app expects.` })
    return
  }
  const made = parseBackupName(source)?.date
  const when = made ? ` from ${made.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : ''
  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    message: `Restore the backup${when}?`,
    detail:
      `It has ${plural(counts.customers, 'customer')} and ${plural(counts.workOrders, 'work order')}. ` +
      'Restoring replaces every customer, vehicle, and work order in the app with the ones in the backup. A backup of the current data is saved first.' +
      unsavedWarning(services),
    buttons: ['Restore', 'Cancel'],
    defaultId: 1,
    cancelId: 1
  })
  if (confirm.response !== 0) return

  try {
    const backup = await services.replaceDatabase(source, 'before-restore')
    await dialog.showMessageBox(win, { type: 'info', message: 'Backup restored', detail: `The data from before the restore was backed up to:\n${backup}` })
  } catch (error) {
    await dialog.showMessageBox(win, { type: 'error', message: 'Restore failed', detail: `Your data wasn’t changed.\n\n${error instanceof Error ? error.message : String(error)}` })
  }
}

/** Asks for a folder to save backups in. Resolves to it, or null if cancelled. */
export async function chooseBackupFolder(win: BrowserWindow | null, services: Services): Promise<string | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose a Folder for Backups',
    message: 'Backups are saved here. A folder on another drive, or one your cloud storage syncs, also protects against losing this computer.',
    buttonLabel: 'Choose',
    defaultPath: services.backupFolder(),
    properties: ['openDirectory', 'createDirectory']
  }
  const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const folder = picked.filePaths[0]
  if (picked.canceled || !folder) return null
  services.settings.update({ backupFolder: folder })
  return folder
}
