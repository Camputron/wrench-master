import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTO_BACKUPS_KEPT, backUpDatabase, isBackupDue, listBackups, newBackupPath, parseBackupName, pruneAutoBackups } from '../../../src/main/backups'
import { Services } from '../../../src/main/services'
import { createJavaDb } from '../../fixtures/javaDb'
import { tempDir } from '../helpers/tempDir'

const at = (day: number, hour = 9): Date => new Date(2026, 9, day, hour, 30, 0)
const touch = (dir: string, name: string): void => writeFileSync(join(dir, name), '')

describe('backup files', () => {
  it('are named by local time and kind, and never overwrite each other', () => {
    const dir = tempDir()
    const first = newBackupPath(dir, 'auto', at(27))
    expect(basename(first)).toBe('autoshop-20261027-093000-auto.db')
    writeFileSync(first, '')
    expect(basename(newBackupPath(dir, 'auto', at(27)))).toBe('autoshop-20261027-093000-2-auto.db')
    expect(basename(newBackupPath(dir, 'before-restore', at(27)))).toBe('autoshop-20261027-093000-before-restore.db')
  })

  it('are listed newest first, ignoring other files', () => {
    const dir = tempDir()
    touch(dir, 'autoshop-20261025-093000-manual.db')
    touch(dir, 'autoshop-20261027-093000-auto.db')
    touch(dir, 'autoshop-20261026-093000-before-import.db')
    touch(dir, 'notes.txt')
    touch(dir, 'autoshop.db')
    expect(listBackups(dir).map((b) => [b.kind, b.date.getDate()])).toEqual([
      ['auto', 27],
      ['before-import', 26],
      ['manual', 25]
    ])
    expect(listBackups(join(dir, 'missing'))).toEqual([])
  })

  it(`keep the newest ${AUTO_BACKUPS_KEPT} automatic backups, and every other kind`, () => {
    const dir = tempDir()
    for (let day = 1; day <= 20; day++) touch(dir, basename(newBackupPath(dir, 'auto', at(day))))
    touch(dir, 'autoshop-20261001-080000-manual.db')
    touch(dir, 'autoshop-20261001-070000-before-import.db')
    pruneAutoBackups(dir)
    const left = listBackups(dir)
    expect(left.filter((b) => b.kind === 'auto').map((b) => b.date.getDate())).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7])
    expect(left.filter((b) => b.kind !== 'auto')).toHaveLength(2)
  })

  it('are due when there is no automatic or manual backup from the last day', () => {
    const dir = tempDir()
    expect(isBackupDue(dir, at(27))).toBe(true)
    touch(dir, 'autoshop-20261027-080000-before-import.db') // doesn't count
    expect(isBackupDue(dir, at(27))).toBe(true)
    touch(dir, 'autoshop-20261026-100000-manual.db')
    expect(isBackupDue(dir, at(27))).toBe(false)
    expect(isBackupDue(dir, at(27, 10))).toBe(true)
  })

  it('are complete, readable copies of the database, made while it is open', async () => {
    const db = new Database(createJavaDb(tempDir()))
    const dir = join(tempDir(), 'nested', 'Backups')
    const path = await backUpDatabase(db, dir, 'manual')
    db.close()
    const copy = new Database(path, { readonly: true })
    expect((copy.prepare('select count(*) as n from work_order').get() as { n: number }).n).toBe(3)
    copy.close()
  })
})

describe('Services backups', () => {
  let dir: string
  let services: Services
  beforeEach(() => {
    dir = tempDir()
    createJavaDb(dir)
    services = new Services(dir, () => {})
  })
  afterEach(() => {
    services.close()
    vi.useRealTimers()
  })

  it('go to Backups next to the database, or the folder chosen in Preferences', async () => {
    expect(services.backupFolder()).toBe(join(dir, 'Backups'))
    expect(basename(await services.backUp('manual'))).toMatch(/-manual\.db$/)
    const chosen = tempDir()
    services.settings.update({ backupFolder: chosen })
    expect(services.backupFolder()).toBe(chosen)
    // Relative paths aren't accepted.
    services.settings.update({ backupFolder: 'relative/folder' })
    expect(services.backupFolder()).toBe(chosen)
  })

  it('back up before an import or restore, into the backup folder', async () => {
    const backup = await services.replaceDatabase(createJavaDb(tempDir()))
    expect(backup.startsWith(join(dir, 'Backups'))).toBe(true)
    expect(basename(backup)).toMatch(/-before-import\.db$/)
    expect(basename(await services.replaceDatabase(backup, 'before-restore'))).toMatch(/-before-restore\.db$/)
  })

  it('back up automatically when one is due, and report a failure once', async () => {
    // Only the scheduling timers: SQLite's backup runs in steps on setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    const onError = vi.fn()
    services.startAutoBackups(onError, 0)
    await vi.advanceTimersByTimeAsync(10)
    await vi.waitFor(() => expect(listBackups(services.backupFolder()).map((b) => b.kind)).toEqual(['auto']))
    // Not due again within the day.
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(listBackups(services.backupFolder())).toHaveLength(1)

    // A folder that can't be created (a file is in the way) fails, and is reported only once.
    const blocked = join(tempDir(), 'file')
    writeFileSync(blocked, '')
    services.settings.update({ backupFolder: join(blocked, 'Backups') })
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000)
    await vi.waitFor(() => expect(onError).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(existsSync(join(blocked, 'Backups'))).toBe(false)
  })

  it('stop when the app closes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
    services.startAutoBackups(() => {}, 1000)
    services.close()
    await vi.advanceTimersByTimeAsync(5000)
    mkdirSync(services.backupFolder(), { recursive: true })
    expect(readdirSync(services.backupFolder())).toEqual([])
    services = new Services(dir, () => {})
  })
})

describe('parseBackupName', () => {
  it('reads when and why from the name, wherever the file is', () => {
    expect(parseBackupName('/somewhere/else/autoshop-20261027-093000-2-manual.db')).toEqual({ path: '/somewhere/else/autoshop-20261027-093000-2-manual.db', kind: 'manual', date: at(27) })
    expect(parseBackupName('/x/autoshop.db')).toBeNull()
  })
})
