import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach } from 'vitest'

/** A temp folder removed after the current test. */
export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wrench-master-test-'))
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}
