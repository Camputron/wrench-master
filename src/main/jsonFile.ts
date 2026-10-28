import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'

/** Reads and writes a JSON file. A missing or unreadable file reads as `undefined`. Writes are atomic. */
export class JsonFile<T> {
  constructor(private path: string) {}

  read(): T | undefined {
    if (!existsSync(this.path)) return undefined
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as T
    } catch (error) {
      console.error(`Ignoring unreadable ${this.path}:`, error)
      return undefined
    }
  }

  write(value: T): void {
    const tmp = `${this.path}.tmp`
    writeFileSync(tmp, JSON.stringify(value, null, 2))
    renameSync(tmp, this.path)
  }
}
