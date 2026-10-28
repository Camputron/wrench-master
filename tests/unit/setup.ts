import { vi } from 'vitest'

// Main-process modules import `electron`, which only works inside Electron. Tests replace it with the
// few APIs those modules touch; see helpers/electronMock.ts for the shared state.
vi.mock('electron', async () => {
  const { electronMock } = await import('./helpers/electronMock')
  return {
    app: { name: 'Wrench Master', getName: () => 'Wrench Master', getVersion: () => '2.0.0', getPath: () => '/tmp' },
    BrowserWindow: { getAllWindows: () => electronMock.windows, getFocusedWindow: () => null },
    ipcMain: { handle: vi.fn() },
    shell: { openExternal: vi.fn(), showItemInFolder: vi.fn() },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn(), showMessageBox: vi.fn() },
    // The menu test walks the template, so building a menu just returns it.
    Menu: { buildFromTemplate: (items: unknown[]) => ({ items }) }
  }
})

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
