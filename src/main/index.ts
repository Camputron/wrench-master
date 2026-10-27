import { app, shell, BrowserWindow, dialog, Menu, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ZOOM_LEVELS, type Settings } from '../shared/types'
import { registerIpc } from './ipc'
import { importFromJavaApp } from './legacyImport'
import { buildMenu } from './menu'
import { emit, Services } from './services'

let services: Services

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
    if (closeConfirmed || !services.settings.get().confirmExit) return
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      message: `Quit ${app.name}?`,
      buttons: ['Quit', 'Cancel'],
      defaultId: 0,
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
      }
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
