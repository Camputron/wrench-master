import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { MenuAction } from '../shared/types'

export const ISSUES_URL = 'https://github.com/Camposm97/Autoshop-Invoice-Manager/issues'

export interface MenuHandlers {
  /** Forwards a command to the renderer. */
  send(action: MenuAction): void
  /** Steps the interface size up (+1), down (-1), or back to 100% (0). */
  zoom(step: 1 | -1 | 0): void
  importFromJavaApp(): void
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
        { label: 'Import from Autoshop Invoice Manager…', click: () => h.importFromJavaApp() },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' } satisfies MenuItemConstructorOptions] : [preferences, { type: 'separator' } satisfies MenuItemConstructorOptions, { role: 'quit', label: 'Exit' } satisfies MenuItemConstructorOptions])
      ]
    },
    { role: 'editMenu' },
    {
      label: 'Go',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => h.send({ type: 'navigate', page: 'dashboard' }) },
        { label: 'Customers', accelerator: 'CmdOrCtrl+2', click: () => h.send({ type: 'navigate', page: 'customers' }) },
        { label: 'Work Orders', accelerator: 'CmdOrCtrl+3', click: () => h.send({ type: 'navigate', page: 'workOrders' }) }
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
