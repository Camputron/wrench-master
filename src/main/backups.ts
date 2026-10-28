import type { Database } from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { basename, join } from 'path'

/** Why a backup was made. Only automatic ones are pruned. */
export type BackupKind = 'auto' | 'manual' | 'before-import' | 'before-restore'

/** Automatic backups kept; older ones are deleted. Other kinds are never deleted. */
export const AUTO_BACKUPS_KEPT = 14

/** How often an automatic backup is made. */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface BackupFile {
  path: string
  kind: BackupKind
  date: Date
}

/** e.g. autoshop-20261027-051203-auto.db, or autoshop-20261027-051203-2-auto.db for a second one that second. */
const BACKUP_NAME = /^autoshop-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:-\d+)?-(auto|manual|before-import|before-restore)\.db$/

const pad = (n: number): string => String(n).padStart(2, '0')

/** A backup path in `dir` that doesn't exist yet, stamped with the local time. */
export function newBackupPath(dir: string, kind: BackupKind, now = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  for (let i = 1; ; i++) {
    const path = join(dir, `autoshop-${stamp}${i > 1 ? `-${i}` : ''}-${kind}.db`)
    if (!existsSync(path)) return path
  }
}

/** When and why a backup was made, from its file name; null if `path` isn't named like a backup. */
export function parseBackupName(path: string): BackupFile | null {
  const m = BACKUP_NAME.exec(basename(path))
  if (!m) return null
  const [, y, mo, d, h, mi, s, kind] = m
  return { path, kind: kind as BackupKind, date: new Date(+y, +mo - 1, +d, +h, +mi, +s) }
}

/** Backups in `dir`, newest first. Other files are ignored. */
export function listBackups(dir: string): BackupFile[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => parseBackupName(join(dir, name)) ?? []).sort((a, b) => b.date.getTime() - a.date.getTime() || b.path.localeCompare(a.path))
}

/** Deletes all but the newest `keep` automatic backups. */
export function pruneAutoBackups(dir: string, keep = AUTO_BACKUPS_KEPT): void {
  for (const old of listBackups(dir)
    .filter((b) => b.kind === 'auto')
    .slice(keep)) {
    rmSync(old.path, { force: true })
  }
}

/** True when there's no automatic or manual backup from the last `interval`. */
export function isBackupDue(dir: string, now = new Date(), interval = AUTO_BACKUP_INTERVAL_MS): boolean {
  const last = listBackups(dir).find((b) => b.kind === 'auto' || b.kind === 'manual')
  return !last || now.getTime() - last.date.getTime() >= interval
}

/**
 * Copies the open database to a new file in `dir` (SQLite's online backup, so it's consistent even
 * while the app is in use). Automatic backups past the newest `AUTO_BACKUPS_KEPT` are then deleted.
 * Resolves to the backup's path.
 */
export async function backUpDatabase(db: Database, dir: string, kind: BackupKind, now = new Date()): Promise<string> {
  mkdirSync(dir, { recursive: true })
  const path = newBackupPath(dir, kind, now)
  await db.backup(path)
  if (kind === 'auto') pruneAutoBackups(dir)
  return path
}
