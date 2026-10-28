import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRepos } from '../../src/main/db'
import { seedDemoData } from '../../src/main/devData'
import type { SettingsPatch } from '../../src/shared/types'
import { createJavaDb } from '../fixtures/javaDb'

const ROOT = join(__dirname, '..', '..')

export interface AppOptions {
  /** What's in the database at launch. */
  data: 'empty' | 'java' | 'demo'
  /** Saved before launch; tests default to the light theme so results don't depend on the OS setting. */
  settings: SettingsPatch
}

interface Fixtures {
  appOptions: AppOptions
  dataDir: string
  app: ElectronApplication
  page: Page
  /** Clicks a native menu item by its label. */
  menu: (label: string) => Promise<void>
  /** Replaces native file dialogs: each call returns the next path, or "cancelled" when none are left. */
  stubFileDialogs: (paths: { save?: string[]; open?: string[] }) => Promise<void>
}

/** Launches the built app against `dataDir` (explicit --user-data-dir, so dev data is never touched). */
export async function launchApp(dataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  // ELECTRON_RUN_AS_NODE (set by some editors' terminals) would stop Electron from starting as an app.
  const env = Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[0] !== 'ELECTRON_RUN_AS_NODE' && e[1] !== undefined))
  // colorScheme: null stops Playwright from forcing "light", so the app's own theme setting applies.
  const app = await electron.launch({ args: [ROOT, `--user-data-dir=${dataDir}`], cwd: ROOT, env, colorScheme: null })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

/** Closes the app, answering any "quit?" / unsaved-changes prompt with Quit. */
export async function closeApp(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBoxSync = () => 0
  })
  await app.close()
}

export const test = base.extend<Fixtures>({
  appOptions: [{ data: 'demo', settings: {} }, { option: true }],

  dataDir: async ({ appOptions }, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'wrench-master-e2e-'))
    if (appOptions.data === 'java') createJavaDb(dir)
    if (appOptions.data === 'demo') {
      const repos = createRepos(join(dir, 'autoshop.db'))
      seedDemoData(repos, 0.08625, 90)
      repos.db.close()
    }
    writeFileSync(join(dir, 'settings.json'), JSON.stringify({ theme: 'light', ...appOptions.settings }))
    await use(dir)
    rmSync(dir, { recursive: true, force: true })
  },

  app: async ({ dataDir }, use) => {
    const { app } = await launchApp(dataDir)
    await use(app)
    await closeApp(app)
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    // Wait for the app shell, not just the document.
    await page.getByRole('tab', { name: 'Dashboard' }).waitFor()
    await use(page)
  },

  menu: async ({ app }, use) => {
    await use(async (label) => {
      const found = await app.evaluate(({ Menu }, label) => {
        const queue = [...(Menu.getApplicationMenu()?.items ?? [])]
        while (queue.length) {
          const item = queue.shift()!
          if (item.label === label) {
            item.click()
            return true
          }
          if (item.submenu) queue.push(...item.submenu.items)
        }
        return false
      }, label)
      if (!found) throw new Error(`No menu item "${label}"`)
    })
  },

  stubFileDialogs: async ({ app }, use) => {
    await use(async ({ save = [], open = [] }) => {
      await app.evaluate(
        ({ dialog }, { save, open }) => {
          dialog.showSaveDialog = (async () => {
            const filePath = save.shift()
            return filePath ? { canceled: false, filePath } : { canceled: true, filePath: '' }
          }) as typeof dialog.showSaveDialog
          dialog.showOpenDialog = (async () => {
            const file = open.shift()
            return file ? { canceled: false, filePaths: [file] } : { canceled: true, filePaths: [] }
          }) as typeof dialog.showOpenDialog
        },
        { save, open }
      )
    })
  }
})

export { expect } from '@playwright/test'
