import { app, shell, BrowserWindow, dialog, Menu, nativeTheme } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ZOOM_LEVELS, type Settings } from '../shared/types'
import { registerIpc } from './ipc'
import { importFromJavaApp } from './legacyImport'
import { runDevDbCommand, type DevDbAction } from './devData'
import { exportToExcel, EXPORT_FILE_NAMES, type ExportKind } from './excelExport'
import { buildMenu } from './menu'
import { emit, Services } from './services'
import { SettingsStore } from './settings'

let services: Services

// Unpackaged runs (npm run dev, the db:* scripts) keep their own data folder, so development and demo
// data can never touch the database of an installed copy of the app. An explicit --user-data-dir wins.
if (is.dev && !app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', join(app.getPath('appData'), `${app.getName()} (Dev)`))

/** `--dev-db=seed|drop|reset` (the db:* npm scripts): manage demo data in the dev data folder, then exit. */
const devDbAction = process.argv.find((a) => a.startsWith('--dev-db='))?.slice('--dev-db='.length)

/** Applies theme and interface size to every window, and tells the renderer. */
function applySettings(settings: Settings): void {
  // The renderer follows prefers-color-scheme, which tracks nativeTheme.themeSource.
  nativeTheme.themeSource = settings.theme
  for (const win of BrowserWindow.getAllWindows()) win.webContents.setZoomFactor(settings.zoom)
  emit('settings-changed', settings)
}

function stepZoom(step: 1 | -1 | 0): void {
  const levels: readonly number[] = ZOOM_LEVELS
  const i = levels.indexOf(services.settings.get().zoom)
  const next = step === 0 ? 1 : levels[Math.min(levels.length - 1, Math.max(0, (i < 0 ? levels.indexOf(1) : i) + step))]
  services.settings.update({ zoom: next })
}

/** File > Export to Excel: asks where to save, writes the workbook, and tells the renderer how it went. */
async function exportData(kind: ExportKind): Promise<void> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const options = { title: 'Export to Excel', defaultPath: join(app.getPath('documents'), EXPORT_FILE_NAMES[kind]), filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }] }
  const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return
  try {
    const count = await exportToExcel(kind, services.repos, filePath)
    const what = { customers: 'customer', vehicles: 'vehicle', workOrders: 'work order', parts: 'catalog part' }[kind]
    emit('notice', { kind: 'success', message: `Exported ${count} ${what}${count === 1 ? '' : 's'}`, path: filePath })
  } catch (error) {
    emit('notice', { kind: 'error', message: `Export failed: ${error instanceof Error ? error.message : String(error)}` })
  }
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(services.settings.get().zoom)
  })

  let closeConfirmed = false
  mainWindow.on('close', (event) => {
    const unsaved = services.unsavedChanges
    if (closeConfirmed || (unsaved === 0 && !services.settings.get().confirmExit)) return
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: unsaved > 0 ? 'warning' : 'question',
      message: unsaved > 0 ? `${unsaved === 1 ? 'A work order has' : `${unsaved} work orders have`} unsaved changes` : `Quit ${app.name}?`,
      detail: unsaved > 0 ? 'If you quit now, those changes are lost.' : undefined,
      buttons: unsaved > 0 ? ['Quit Without Saving', 'Cancel'] : ['Quit', 'Cancel'],
      defaultId: unsaved > 0 ? 1 : 0,
      cancelId: 1
    })
    if (choice === 0) {
      closeConfirmed = true
      app.quit()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (devDbAction !== undefined) {
    if (!is.dev || !['seed', 'drop', 'reset'].includes(devDbAction)) {
      console.error(is.dev ? `Unknown --dev-db action "${devDbAction}". Use seed, drop, or reset.` : '--dev-db only works in development.')
      app.exit(1)
      return
    }
    app.dock?.hide()
    const dataDir = app.getPath('userData')
    mkdirSync(dataDir, { recursive: true })
    const settings = new SettingsStore(join(dataDir, 'settings.json'), () => {}).get()
    app.exit(runDevDbCommand(devDbAction as DevDbAction, dataDir, settings))
    return
  }

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.camposmdev.wrenchmaster')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  services = new Services(app.getPath('userData'), applySettings)
  nativeTheme.themeSource = services.settings.get().theme
  registerIpc(services)

  Menu.setApplicationMenu(
    buildMenu({
      send: (action) => emit('menu', action),
      zoom: stepZoom,
      importFromJavaApp: () => {
        const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
        if (win) void importFromJavaApp(win, services)
      },
      exportData: (kind) => void exportData(kind)
    })
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  services?.close()
})
