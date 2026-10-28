import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { JsonFile } from '../../../src/main/jsonFile'
import { SessionStore } from '../../../src/main/session'
import { applyPatch, DEFAULT_SETTINGS, SettingsStore } from '../../../src/main/settings'
import type { SettingsPatch } from '../../../src/shared/types'
import { tempDir } from '../helpers/tempDir'

describe('settings', () => {
  it('ignores invalid values (the renderer is untrusted) and never mutates the defaults', () => {
    const bad = { taxRate: 1.5, laborRate: -3, zoom: 7, theme: 'neon', confirmExit: 'yes', shop: { company: 42, city: 'Queens', state: 'NOWHERE', extra: 'x' } } as unknown as SettingsPatch
    const s = applyPatch(DEFAULT_SETTINGS, bad)
    expect(s).toMatchObject({ taxRate: 0.08625, laborRate: 90, zoom: 1, theme: 'system', confirmExit: false })
    expect(s.shop).toEqual({ ...DEFAULT_SETTINGS.shop, city: 'Queens' })
    expect(DEFAULT_SETTINGS.shop.city).toBe('')
  })

  it('applies valid values', () => {
    expect(applyPatch(DEFAULT_SETTINGS, { taxRate: 0, laborRate: 120, zoom: 1.25, theme: 'dark', confirmExit: true, shop: { state: 'NEW_JERSEY' } })).toMatchObject({
      taxRate: 0,
      laborRate: 120,
      zoom: 1.25,
      theme: 'dark',
      confirmExit: true,
      shop: { state: 'NEW_JERSEY' }
    })
  })

  it('saves to disk, notifies, and reloads', () => {
    const file = join(tempDir(), 'settings.json')
    const onChange = vi.fn()
    new SettingsStore(file, onChange).update({ zoom: 1.1, shop: { company: 'X' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 1.1 }))
    expect(new SettingsStore(file, () => {}).get()).toMatchObject({ zoom: 1.1, shop: { company: 'X' } })
  })

  it('falls back to defaults when the file is corrupt', () => {
    const file = join(tempDir(), 'settings.json')
    writeFileSync(file, '{not json')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(new SettingsStore(file, () => {}).get()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('session', () => {
  it('keeps the 10 most recent work orders, newest first, without repeats', () => {
    const file = join(tempDir(), 'session.json')
    const s = new SessionStore(file)
    for (let id = 1; id <= 12; id++) s.addRecent(id)
    s.addRecent(5)
    expect(s.recentWorkOrderIds()).toEqual([5, 12, 11, 10, 9, 8, 7, 6, 4, 3])
    expect(new SessionStore(file).recentWorkOrderIds()).toEqual(s.recentWorkOrderIds())
  })

  it('forgets deleted work orders and dedupes open ones', () => {
    const s = new SessionStore(join(tempDir(), 'session.json'))
    s.addRecent(3)
    s.setOpen([3, 3, 5])
    expect(s.openWorkOrderIds()).toEqual([3, 5])
    s.forget(3)
    expect(s.recentWorkOrderIds()).toEqual([])
    expect(s.openWorkOrderIds()).toEqual([5])
    s.clear()
    expect(s.openWorkOrderIds()).toEqual([])
  })

  it('ignores junk in the file', () => {
    const file = join(tempDir(), 'session.json')
    writeFileSync(file, JSON.stringify({ recentWorkOrderIds: ['x', 3, -1, 2.5], openWorkOrderIds: 'nope' }))
    const s = new SessionStore(file)
    expect(s.recentWorkOrderIds()).toEqual([3])
    expect(s.openWorkOrderIds()).toEqual([])
  })
})

describe('JsonFile', () => {
  it('writes atomically and reads back; missing files read as undefined', () => {
    const file = join(tempDir(), 'x.json')
    const f = new JsonFile<{ a: number }>(file)
    expect(f.read()).toBeUndefined()
    f.write({ a: 1 })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ a: 1 })
    expect(f.read()).toEqual({ a: 1 })
  })
})
