import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { MenuAction } from '../shared/types'
import type { ExportKind } from './excelExport'

export const ISSUES_URL = 'https://github.com/Camposm97/Autoshop-Invoice-Manager/issues'

export interface MenuHandlers {
  /** Forwards a command to the renderer. */
  send(action: MenuAction): void
  /** Steps the interface size up (+1), down (-1), or back to 100% (0). */
  zoom(step: 1 | -1 | 0): void
  importFromJavaApp(): void
  exportData(kind: ExportKind): void
  backUpNow(): void
  restoreBackup(): void
}

export function buildMenu(h: MenuHandlers): Menu {
  const isMac = process.platform === 'darwin'
  const preferences: MenuItemConstructorOptions = { label: isMac ? 'Settings…' : 'Preferences…', accelerator: 'CmdOrCtrl+,', click: () => h.send({ type: 'preferences' }) }
  const about: MenuItemConstructorOptions = { label: `About ${app.name}`, click: () => h.send({ type: 'about' }) }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              about,
              { type: 'separator' },
              preferences,
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ] satisfies MenuItemConstructorOptions[]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Work Order', accelerator: 'CmdOrCtrl+N', click: () => h.send({ type: 'newWorkOrder' }) },
        { label: 'New Estimate', accelerator: 'Shift+CmdOrCtrl+N', click: () => h.send({ type: 'newEstimate' }) },
        { label: 'New Customer…', click: () => h.send({ type: 'newCustomer' }) },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => h.send({ type: 'save' }) },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => h.send({ type: 'print' }) },
        // Replaces the standard Close Window item (also Cmd+W); the renderer closes the window when no work order or estimate is shown.
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => h.send({ type: 'closeTab' }) },
        { type: 'separator' },
        { label: 'Import from Autoshop Invoice Manager…', click: () => h.importFromJavaApp() },
        {
          label: 'Export to Excel',
          submenu: [
            { label: 'Customers…', click: () => h.exportData('customers') },
            { label: 'Vehicles…', click: () => h.exportData('vehicles') },
            { label: 'Work Orders…', click: () => h.exportData('workOrders') },
            { label: 'Estimates…', click: () => h.exportData('estimates') },
            { label: 'Parts Catalog…', click: () => h.exportData('parts') }
          ]
        },
        { type: 'separator' },
        { label: 'Back Up Now', click: () => h.backUpNow() },
        { label: 'Restore from Backup…', click: () => h.restoreBackup() },
        ...(isMac ? [] : [{ type: 'separator' } satisfies MenuItemConstructorOptions, preferences, { type: 'separator' } satisfies MenuItemConstructorOptions, { role: 'quit', label: 'Exit' } satisfies MenuItemConstructorOptions])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Routed through the renderer: it undoes typing in a text field, or the last work order change otherwise.
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => h.send({ type: 'undo' }) },
        { label: 'Redo', accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'CmdOrCtrl+Y', click: () => h.send({ type: 'redo' }) },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => h.send({ type: 'find' }) }
      ]
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => h.send({ type: 'navigate', page: 'dashboard' }) },
        { label: 'Customers', accelerator: 'CmdOrCtrl+2', click: () => h.send({ type: 'navigate', page: 'customers' }) },
        { label: 'Work Orders', accelerator: 'CmdOrCtrl+3', click: () => h.send({ type: 'navigate', page: 'workOrders' }) },
        { label: 'Estimates', accelerator: 'CmdOrCtrl+4', click: () => h.send({ type: 'navigate', page: 'estimates' }) }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: () => h.zoom(0) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => h.zoom(1) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', visible: false, acceleratorWorksWhenHidden: true, click: () => h.zoom(1) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => h.zoom(-1) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(is.dev ? [{ type: 'separator' } satisfies MenuItemConstructorOptions, { role: 'reload' } satisfies MenuItemConstructorOptions, { role: 'toggleDevTools' } satisfies MenuItemConstructorOptions] : [])
      ]
    },
    ...(isMac ? [{ role: 'windowMenu' } satisfies MenuItemConstructorOptions] : []),
    {
      role: 'help',
      submenu: [{ label: 'Report an Issue…', click: () => shell.openExternal(ISSUES_URL) }, ...(isMac ? [] : [{ type: 'separator' } satisfies MenuItemConstructorOptions, about])]
    }
  ]
  return Menu.buildFromTemplate(template)
}
