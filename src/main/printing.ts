import { app, BrowserWindow, dialog, type WebContents } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'

/** A printable page (an invoice or estimate) and what to call it when saved as a PDF. */
export interface Printable {
  html: string
  fileName: string
  /** e.g. "invoice", for the save dialog's title. */
  noun: string
}

/** Loads the page into a hidden, script-free window, runs `use`, then closes the window. */
async function withPage<T>(html: string, use: (contents: WebContents) => Promise<T>): Promise<T> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await use(win.webContents)
  } finally {
    win.destroy()
  }
}

/** Opens the system print dialog. Resolves to false if the user cancels. */
export function printPage({ html }: Printable): Promise<boolean> {
  return withPage(
    html,
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

/** Asks where to save, then writes the page as a PDF. Resolves to the file path, or null if cancelled. */
export async function savePagePdf(parent: BrowserWindow | null, { html, fileName, noun }: Printable): Promise<string | null> {
  const options = { title: `Save ${noun} as PDF`, defaultPath: join(app.getPath('documents'), fileName), filters: [{ name: 'PDF', extensions: ['pdf'] }] }
  const { canceled, filePath } = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return null
  const pdf = await withPage(html, (contents) => contents.printToPDF({ printBackground: true, preferCSSPageSize: true }))
  await writeFile(filePath, pdf)
  return filePath
}
