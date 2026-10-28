import Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'
import { copyFileSync, rmSync } from 'fs'
import { join } from 'path'
import { EVENT_CHANNEL_PREFIX, type AppEvents } from '../shared/api'
import type { DocumentKind, Settings } from '../shared/types'
import { backUpDatabase, isBackupDue, type BackupKind } from './backups'
import { createRepos, type Repos } from './db'
import { SessionStore } from './session'
import { SettingsStore } from './settings'

/** Sends an event to every window. */
export function emit<K extends keyof AppEvents>(name: K, payload: AppEvents[K]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(EVENT_CHANNEL_PREFIX + name, payload)
}

/** Everything the main process keeps open: the database, settings, and session state. */
export class Services {
  readonly databasePath: string
  readonly settings: SettingsStore
  readonly session: SessionStore
  /** Replaced when a database is imported, so always read it through this property. */
  repos: Repos
  /** Open work orders and estimates with unsaved changes, as reported by the renderer. */
  readonly unsaved: Record<DocumentKind, number> = { workOrder: 0, estimate: 0 }
  private autoBackupTimer: NodeJS.Timeout | undefined

  constructor(
    private dataDir: string,
    onSettingsChange: (settings: Settings) => void
  ) {
    this.databasePath = join(dataDir, 'autoshop.db')
    this.repos = createRepos(this.databasePath)
    this.settings = new SettingsStore(join(dataDir, 'settings.json'), onSettingsChange)
    this.session = new SessionStore(join(dataDir, 'session.json'))
  }

  /** How many open documents have unsaved changes. */
  get unsavedChanges(): number {
    return this.unsaved.workOrder + this.unsaved.estimate
  }

  /** e.g. "A work order", "2 work orders and an estimate"; null when nothing is unsaved. */
  describeUnsaved(): string | null {
    const { workOrder: w, estimate: e } = this.unsaved
    const parts = [w === 1 ? 'a work order' : w > 1 ? `${w} work orders` : '', e === 1 ? 'an estimate' : e > 1 ? `${e} estimates` : ''].filter(Boolean)
    if (parts.length === 0) return null
    const text = parts.join(' and ')
    return text[0].toUpperCase() + text.slice(1)
  }

  /** Where backups go: the folder chosen in Preferences, or Backups next to the database. */
  backupFolder(): string {
    return this.settings.get().backupFolder || join(this.dataDir, 'Backups')
  }

  /** Backs up the database to the backup folder. Resolves to the backup's path. */
  backUp(kind: BackupKind): Promise<string> {
    return backUpDatabase(this.repos.db, this.backupFolder(), kind)
  }

  /**
   * Makes an automatic backup now if the last one is a day old or more, then checks again every hour (the
   * app is often left open for days). `onError` is told when one fails, once until one succeeds again.
   */
  startAutoBackups(onError: (error: unknown) => void, firstCheckDelayMs = 5000): void {
    let failing = false
    const check = async (): Promise<void> => {
      try {
        if (isBackupDue(this.backupFolder())) await this.backUp('auto')
        failing = false
      } catch (error) {
        if (!failing) onError(error)
        failing = true
      }
    }
    const first = setTimeout(() => {
      void check()
      this.autoBackupTimer = setInterval(() => void check(), 60 * 60 * 1000)
      this.autoBackupTimer.unref?.()
    }, firstCheckDelayMs)
    first.unref?.()
    this.autoBackupTimer = first
  }

  /**
   * Replaces the app's database with a copy of `source`. The current database is backed up first and
   * restored if the copy fails. Resolves to the backup's path.
   */
  async replaceDatabase(source: string, reason: Extract<BackupKind, 'before-import' | 'before-restore'> = 'before-import'): Promise<string> {
    const backup = await this.backUp(reason)
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
    clearTimeout(this.autoBackupTimer)
    clearInterval(this.autoBackupTimer)
    this.repos.db.close()
  }
}
