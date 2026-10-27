import Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'
import { copyFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { EVENT_CHANNEL_PREFIX, type AppEvents } from '../shared/api'
import type { Settings } from '../shared/types'
import { createRepos, type Repos } from './db'
import { SessionStore } from './session'
import { SettingsStore } from './settings'

/** Sends an event to every window. */
export function emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(EVENT_CHANNEL_PREFIX + name, payload)
}

/** A backup path that doesn't exist yet, e.g. autoshop-backup-20261027-051203.db */
function newBackupPath(dir: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  for (let i = 1; ; i++) {
    const path = join(dir, `autoshop-backup-${stamp}${i > 1 ? `-${i}` : ''}.db`)
    if (!existsSync(path)) return path
  }
}

/** Everything the main process keeps open: the database, settings, and session state. */
export class Services {
  readonly databasePath: string
  readonly settings: SettingsStore
  readonly session: SessionStore
  /** Replaced when a database is imported, so always read it through this property. */
  repos: Repos

  constructor(
    private dataDir: string,
    onSettingsChange: (settings: Settings) => void
  ) {
    this.databasePath = join(dataDir, 'autoshop.db')
    this.repos = createRepos(this.databasePath)
    this.settings = new SettingsStore(join(dataDir, 'settings.json'), onSettingsChange)
    this.session = new SessionStore(join(dataDir, 'session.json'))
  }

  /**
   * Replaces the app's database with a copy of `source`. The current database is backed up first and
   * restored if the copy fails. Resolves to the backup's path.
   */
  async replaceDatabase(source: string): Promise<string> {
    const backup = newBackupPath(this.dataDir)
    await this.repos.db.backup(backup)
    this.repos.db.close()
    const removeDatabase = (): void => {
      for (const suffix of ['', '-wal', '-shm']) rmSync(this.databasePath + suffix, { force: true })
    }
    try {
      removeDatabase()
      const src = new Database(source, { readonly: true, fileMustExist: true })
      try {
        await src.backup(this.databasePath)
      } finally {
        src.close()
      }
      this.repos = createRepos(this.databasePath)
    } catch (error) {
      removeDatabase()
      copyFileSync(backup, this.databasePath)
      this.repos = createRepos(this.databasePath)
      throw error
    }
    this.session.clear()
    emit('data-changed', null)
    return backup
  }

  close(): void {
    this.repos.db.close()
  }
}
