import { app, BrowserWindow, dialog, type WebContents } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { Settings, WorkOrder } from '../shared/types'
import { invoiceFileName, invoiceHtml } from './invoice'

/** Loads the invoice into a hidden, script-free window, runs `use`, then closes the window. */
async function withInvoice<T>(wo: WorkOrder, settings: Settings, use: (contents: WebContents) => Promise<T>): Promise<T> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(invoiceHtml(wo, settings))}`)
    return await use(win.webContents)
  } finally {
    win.destroy()
  }
}

/** Opens the system print dialog for the invoice. Resolves to false if the user cancels. */
export function printInvoice(wo: WorkOrder, settings: Settings): Promise<boolean> {
  return withInvoice(
    wo,
    settings,
    (contents) =>
      new Promise((resolve, reject) => {
        contents.print({ silent: false, printBackground: true }, (success, reason) => {
          // Cancelling isn't an error.
          if (success || /cancel/i.test(reason)) resolve(success)
          else reject(new Error(reason))
        })
      })
  )
}

/** Asks where to save, then writes the invoice as a PDF. Resolves to the file path, or null if cancelled. */
export async function saveInvoicePdf(parent: BrowserWindow | null, wo: WorkOrder, settings: Settings): Promise<string | null> {
  const options = { title: 'Save invoice as PDF', defaultPath: join(app.getPath('documents'), invoiceFileName(wo)), filters: [{ name: 'PDF', extensions: ['pdf'] }] }
  const { canceled, filePath } = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return null
  const pdf = await withInvoice(wo, settings, (contents) => contents.printToPDF({ printBackground: true, preferCSSPageSize: true }))
  await writeFile(filePath, pdf)
  return filePath
}
