import Database from 'better-sqlite3'
import { dialog, type BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { US_STATES } from '../shared/states'
import type { SettingsPatch } from '../shared/types'
import type { Services } from './services'

const GUI_SCALE_ZOOM: Record<string, number> = { Small: 1, Medium: 1.1, Large: 1.25, X_Large: 1.5 }

/**
 * Converts the Java app's `preferences.config` (`key=value` lines) to a settings patch.
 * The Java app wrote the state by display name ("New York") and the tax rate as a fraction.
 */
export function parseJavaPreferences(text: string): SettingsPatch {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0) values.set(line.slice(0, i).trim(), line.slice(i + 1).trim())
  }
  const shop: NonNullable<SettingsPatch['shop']> = {}
  const copy = (key: string, field: keyof typeof shop): void => {
    const v = values.get(key)
    if (v !== undefined) shop[field] = v
  }
  copy('company', 'company')
  copy('address', 'street')
  copy('city', 'city')
  copy('zip', 'zip')
  copy('phone', 'phone')
  copy('repair-shop-id', 'repairShopId')
  copy('title', 'invoiceTitle')
  const stateName = values.get('state')
  if (stateName !== undefined) shop.state = US_STATES.find((s) => s.name.toLowerCase() === stateName.toLowerCase())?.key ?? 'UNKNOWN'

  const patch: SettingsPatch = { shop }
  const num = (key: string): number | undefined => {
    const v = Number(values.get(key))
    return values.has(key) && Number.isFinite(v) ? v : undefined
  }
  const laborRate = num('labor-rate')
  if (laborRate !== undefined) patch.laborRate = laborRate
  // The Java app defaulted to 1.08625 (108% tax) by mistake; only fractions below 1 are real rates.
  const taxRate = num('tax-rate')
  if (taxRate !== undefined && taxRate >= 0 && taxRate < 1) patch.taxRate = taxRate
  const theme = values.get('theme')
  if (theme === 'Light' || theme === 'Dark') patch.theme = theme === 'Light' ? 'light' : 'dark'
  const zoom = GUI_SCALE_ZOOM[values.get('gui-scale') ?? '']
  if (zoom) patch.zoom = zoom
  const confirmExit = values.get('confirm-exit')
  if (confirmExit === 'true' || confirmExit === 'false') patch.confirmExit = confirmExit === 'true'
  return patch
}

/** Counts records in an Autoshop Invoice Manager database, or returns null if `file` isn't one. */
export function inspectLegacyDatabase(file: string): { customers: number; workOrders: number } | null {
  let db: Database.Database | undefined
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
    const count = (table: string): number => (db!.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n
    for (const table of ['vehicle', 'item', 'work_order_item', 'work_order_labor', 'work_order_payment']) count(table)
    return { customers: count('customer'), workOrders: count('work_order') }
  } catch {
    return null
  } finally {
    db?.close()
  }
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** File > Import: replaces the app's data with a database (and preferences) from the Java app. */
export async function importFromJavaApp(win: BrowserWindow, services: Services): Promise<void> {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Import from Autoshop Invoice Manager',
    message: 'Choose the autoshop.db file from the Java version of the app.',
    buttonLabel: 'Import',
    filters: [{ name: 'Autoshop database', extensions: ['db', 'sqlite', 'sqlite3'] }],
    properties: ['openFile']
  })
  const source = picked.filePaths[0]
  if (picked.canceled || !source) return

  const counts = inspectLegacyDatabase(source)
  if (!counts) {
    await dialog.showMessageBox(win, {
      type: 'error',
      message: 'This file isn’t an Autoshop Invoice Manager database',
      detail: `${basename(source)} doesn’t have the customer and work order tables the app expects.`
    })
    return
  }

  const prefsFile = join(dirname(source), 'preferences.config')
  const hasPrefs = existsSync(prefsFile)
  const confirm = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Replace all current data?',
    detail: `${basename(source)} has ${plural(counts.customers, 'customer')} and ${plural(counts.workOrders, 'work order')}. ` + 'Importing replaces every customer, vehicle, and work order in this app. A backup of the current data is saved first.',
    buttons: ['Import', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: hasPrefs ? 'Also import shop details and preferences (preferences.config)' : undefined,
    checkboxChecked: hasPrefs
  })
  if (confirm.response !== 0) return

  try {
    const backup = await services.replaceDatabase(source)
    if (hasPrefs && confirm.checkboxChecked) services.settings.update(parseJavaPreferences(readFileSync(prefsFile, 'utf8')))
    await dialog.showMessageBox(win, {
      type: 'info',
      message: 'Import complete',
      detail: `Imported ${plural(counts.customers, 'customer')} and ${plural(counts.workOrders, 'work order')}.\n\nThe previous data was backed up to:\n${backup}`
    })
  } catch (error) {
    await dialog.showMessageBox(win, {
      type: 'error',
      message: 'Import failed',
      detail: `Your previous data was restored.\n\n${error instanceof Error ? error.message : String(error)}`
    })
  }
}
