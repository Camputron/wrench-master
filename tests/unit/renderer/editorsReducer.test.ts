import { describe, expect, it } from 'vitest'
import { editorsReducer, initialEditorsState, isDirty, type EditorsAction, type EditorsState } from '../../../src/renderer/src/editors/editorsReducer'
import { emptyLabor, emptyPart, emptyWorkOrder } from '../../../src/renderer/src/lib/records'
import type { WorkOrder } from '../../../src/shared/types'

const wo = (id: number): WorkOrder => ({ ...emptyWorkOrder(0.1, '2026-01-01'), id })
const run = (...actions: EditorsAction[]): EditorsState => actions.reduce(editorsReducer, initialEditorsState)
const keys = (s: EditorsState): string[] => s.editors.map((e) => e.key)

describe('open work order editors', () => {
  it('opens each work order once, switching to it if already open', () => {
    let s = run({ type: 'open', doc: wo(5), activate: true }, { type: 'open', doc: wo(6), activate: false })
    expect(keys(s)).toEqual(['wo-5', 'wo-6'])
    expect(s.active).toBe('wo-5')
    s = editorsReducer(s, { type: 'open', doc: { ...wo(6), parts: [emptyPart()] }, activate: true })
    expect(keys(s)).toEqual(['wo-5', 'wo-6'])
    expect(s.active).toBe('wo-6')
    expect(s.editors[1].draft.parts).toEqual([]) // keeps the open draft
  })

  it('gives new work orders unique keys', () => {
    expect(keys(run({ type: 'openNew', draft: wo(0) }, { type: 'openNew', draft: wo(0) }))).toEqual(['new-1', 'new-2'])
  })

  it('shows a neighbor when the shown editor closes, then the list', () => {
    let s = run({ type: 'openNew', draft: wo(0) }, { type: 'openNew', draft: wo(0) }, { type: 'open', doc: wo(9), activate: true }, { type: 'activate', key: 'new-2' })
    s = editorsReducer(s, { type: 'close', key: 'new-2' })
    expect(s.active).toBe('wo-9')
    s = editorsReducer(s, { type: 'close', key: 'wo-9' })
    expect(s.active).toBe('new-1')
    s = editorsReducer(s, { type: 'close', key: 'new-1' })
    expect(s.active).toBeNull()
    expect(editorsReducer(s, { type: 'close', key: 'nope' })).toBe(s)
  })
})

describe('undo and redo', () => {
  it('records only line changes; typing survives undo', () => {
    let s = run({ type: 'openNew', draft: wo(0) })
    const edit = (update: (d: WorkOrder) => WorkOrder, record: boolean): void => {
      s = editorsReducer(s, { type: 'edit', key: 'new-1', update, record })
    }
    edit((d) => ({ ...d, vehicle: { ...d.vehicle, make: 'Ford' } }), false)
    edit((d) => ({ ...d, parts: [...d.parts, emptyPart()] }), true)
    edit((d) => ({ ...d, labor: [emptyLabor(90)] }), true)
    expect(s.editors[0].past).toHaveLength(2)

    s = editorsReducer(s, { type: 'undo', key: 'new-1' })
    expect(s.editors[0].draft.labor).toEqual([])
    expect(s.editors[0].draft.vehicle.make).toBe('Ford')
    s = editorsReducer(s, { type: 'undo', key: 'new-1' })
    s = editorsReducer(s, { type: 'undo', key: 'new-1' }) // nothing left: no-op
    expect(s.editors[0].draft.parts).toEqual([])
    s = editorsReducer(s, { type: 'redo', key: 'new-1' })
    expect(s.editors[0].draft.parts).toHaveLength(1)

    edit((d) => ({ ...d, taxRate: 0.2 }), true) // a new change clears redo
    expect(s.editors[0].future).toEqual([])
  })

  it('keeps at most 100 steps', () => {
    let s = run({ type: 'openNew', draft: wo(0) })
    for (let i = 0; i < 150; i++) s = editorsReducer(s, { type: 'edit', key: 'new-1', update: (d) => ({ ...d, taxRate: i }), record: true })
    expect(s.editors[0].past).toHaveLength(100)
  })
})

describe('unsaved changes and saving', () => {
  it('ignores edits that change nothing and tracks changes against what’s saved', () => {
    let s = run({ type: 'open', doc: wo(3), activate: true })
    const before = s.editors[0]
    s = editorsReducer(s, { type: 'edit', key: 'wo-3', update: (d) => d, record: true })
    expect(s.editors[0]).toBe(before)
    expect(isDirty(s.editors[0])).toBe(false)
    s = editorsReducer(s, { type: 'edit', key: 'wo-3', update: (d) => ({ ...d, taxRate: 0.3 }), record: true })
    expect(isDirty(s.editors[0])).toBe(true)
    s = editorsReducer(s, { type: 'undo', key: 'wo-3' })
    expect(isDirty(s.editors[0])).toBe(false)
  })

  it('re-keys a new work order once saved, with the stored line ids', () => {
    let s = run({ type: 'openNew', draft: wo(0) }, { type: 'edit', key: 'new-1', update: (d) => ({ ...d, parts: [emptyPart()] }), record: true })
    s = editorsReducer(s, { type: 'saved', key: 'new-1', doc: { ...s.editors[0].draft, id: 12, parts: [{ ...emptyPart(), id: 40 }] } })
    expect(keys(s)).toEqual(['wo-12'])
    expect(s.active).toBe('wo-12')
    expect(isDirty(s.editors[0])).toBe(false)
    expect(s.editors[0].draft.parts[0].id).toBe(40)
  })
})

describe('voided work orders', () => {
  it('can’t be changed, even by undo; reloading replaces the draft and history', () => {
    let s = run({ type: 'open', doc: wo(4), activate: true }, { type: 'edit', key: 'wo-4', update: (d) => ({ ...d, parts: [emptyPart()] }), record: true }, { type: 'saved', key: 'wo-4', doc: { ...wo(4), parts: [emptyPart()] } })
    const voided = { ...s.editors[0].draft, dateVoided: '2026-02-01' }
    s = editorsReducer(s, { type: 'reload', doc: voided })
    expect(s.editors[0]).toMatchObject({ draft: voided, baseline: voided, past: [], future: [] })
    for (const action of [
      { type: 'edit', key: 'wo-4', update: (d: WorkOrder) => ({ ...d, labor: [emptyLabor(90)] }), record: true },
      { type: 'undo', key: 'wo-4' }
    ] as EditorsAction[]) {
      expect(editorsReducer(s, action)).toEqual(s)
    }
    expect(isDirty(s.editors[0])).toBe(false)
    // Reloading a work order that isn't open does nothing.
    expect(editorsReducer(s, { type: 'reload', doc: wo(77) })).toEqual(s)
  })
})
