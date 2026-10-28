import type { Estimate, WorkOrder } from '../../../shared/types'

/** A document with an editor: a work order or an estimate. Saved ones have an id above 0. */
export interface Doc {
  id: number
}

/** One open editor. */
export interface Editor<D extends Doc = WorkOrder> {
  /** `<prefix>-<id>` for saved documents (e.g. `wo-12`), `<new prefix>-<n>` for ones not saved yet. */
  key: string
  /** What's stored (or the blank starting point for a new one); used to tell if there are unsaved changes. */
  baseline: D
  draft: D
  /** Earlier drafts, for undo. Only line changes (parts, labor, payments) are recorded. */
  past: D[]
  future: D[]
}

export interface EditorsState<D extends Doc = WorkOrder> {
  editors: Editor<D>[]
  /** The editor being shown, or null for the list. */
  active: string | null
  nextNew: number
}

export type EditorsAction<D extends Doc = WorkOrder> =
  /** Opens a saved document, or switches to it if it's already open. */
  | { type: 'open'; doc: D; activate: boolean }
  | { type: 'openNew'; draft: D }
  | { type: 'close'; key: string }
  | { type: 'activate'; key: string | null }
  /** `record` adds an undo step; leave it off for typing in fields. */
  | { type: 'edit'; key: string; update: (draft: D) => D; record: boolean }
  | { type: 'undo'; key: string }
  | { type: 'redo'; key: string }
  | { type: 'saved'; key: string; doc: D }
  /** Replaces an open document with the stored one (e.g. after voiding it), clearing its undo history. */
  | { type: 'reload'; doc: D }

export interface EditorsConfig<D extends Doc> {
  /** Key prefix for saved documents, e.g. 'wo' for `wo-12`. */
  prefix: string
  /** Key prefix for new ones, e.g. 'new' for `new-1`. */
  newPrefix: string
  /** Read-only documents (a voided work order, an accepted estimate) ignore edits, undo, and redo. */
  isLocked: (doc: D) => boolean
}

const MAX_HISTORY = 100

export const isDirty = <D extends Doc>(e: Editor<D>): boolean => JSON.stringify(e.draft) !== JSON.stringify(e.baseline)

export const initialEditorsState: EditorsState<never> = { editors: [], active: null, nextNew: 1 }

/** The reducer for one kind of document's editors, and how its saved documents are keyed. */
export function createEditorsReducer<D extends Doc>({
  prefix,
  newPrefix,
  isLocked
}: EditorsConfig<D>): {
  reducer: (state: EditorsState<D>, action: EditorsAction<D>) => EditorsState<D>
  keyFor: (id: number) => string
  isSavedKey: (key: string) => boolean
} {
  const keyFor = (id: number): string => `${prefix}-${id}`
  const isSavedKey = (key: string): boolean => key.startsWith(`${prefix}-`) && /^\d+$/.test(key.slice(prefix.length + 1))

  function updateEditor(state: EditorsState<D>, key: string, update: (e: Editor<D>) => Editor<D>): EditorsState<D> {
    return { ...state, editors: state.editors.map((e) => (e.key === key ? update(e) : e)) }
  }
  /** Like updateEditor, but leaves locked documents alone: they're read-only until unlocked. */
  function changeDraft(state: EditorsState<D>, key: string, update: (e: Editor<D>) => Editor<D>): EditorsState<D> {
    return updateEditor(state, key, (e) => (isLocked(e.draft) ? e : update(e)))
  }

  function reducer(state: EditorsState<D>, action: EditorsAction<D>): EditorsState<D> {
    switch (action.type) {
      case 'open': {
        const key = keyFor(action.doc.id)
        if (state.editors.some((e) => e.key === key)) return action.activate ? { ...state, active: key } : state
        const editor: Editor<D> = { key, baseline: action.doc, draft: action.doc, past: [], future: [] }
        return { ...state, editors: [...state.editors, editor], active: action.activate ? key : state.active }
      }
      case 'openNew': {
        const key = `${newPrefix}-${state.nextNew}`
        const editor: Editor<D> = { key, baseline: action.draft, draft: action.draft, past: [], future: [] }
        return { editors: [...state.editors, editor], active: key, nextNew: state.nextNew + 1 }
      }
      case 'close': {
        const index = state.editors.findIndex((e) => e.key === action.key)
        if (index < 0) return state
        const editors = state.editors.filter((e) => e.key !== action.key)
        // Closing the shown editor shows its neighbor, or the list if it was the last one.
        const active = state.active === action.key ? editors[Math.min(index, editors.length - 1)]?.key ?? null : state.active
        return { ...state, editors, active }
      }
      case 'activate':
        return { ...state, active: action.key }
      case 'edit':
        return changeDraft(state, action.key, (e) => {
          const draft = action.update(e.draft)
          if (draft === e.draft) return e
          return action.record ? { ...e, draft, past: [...e.past, e.draft].slice(-MAX_HISTORY), future: [] } : { ...e, draft }
        })
      case 'undo':
        return changeDraft(state, action.key, (e) => (e.past.length ? { ...e, draft: e.past[e.past.length - 1], past: e.past.slice(0, -1), future: [e.draft, ...e.future] } : e))
      case 'redo':
        return changeDraft(state, action.key, (e) => (e.future.length ? { ...e, draft: e.future[0], past: [...e.past, e.draft], future: e.future.slice(1) } : e))
      case 'saved': {
        const key = keyFor(action.doc.id)
        // A new document gets its real key once saved. If it's somehow already open under that key, keep one.
        const editors = state.editors.filter((e) => e.key === action.key || e.key !== key).map((e) => (e.key === action.key ? { ...e, key, baseline: action.doc, draft: action.doc } : e))
        return { ...state, editors, active: state.active === action.key ? key : state.active }
      }
      case 'reload':
        return updateEditor(state, keyFor(action.doc.id), (e) => ({ ...e, baseline: action.doc, draft: action.doc, past: [], future: [] }))
    }
  }

  return { reducer, keyFor, isSavedKey }
}

/** Work order editors: `wo-12` / `new-1`, read-only while voided. */
export const workOrderEditors = createEditorsReducer<WorkOrder>({ prefix: 'wo', newPrefix: 'new', isLocked: (wo) => !!wo.dateVoided })
export const editorsReducer = workOrderEditors.reducer
export const keyFor = workOrderEditors.keyFor

/** Estimate editors: `est-12` / `est-new-1`, read-only once accepted or declined. */
export const estimateEditors = createEditorsReducer<Estimate>({ prefix: 'est', newPrefix: 'est-new', isLocked: (e) => e.status !== 'open' })
