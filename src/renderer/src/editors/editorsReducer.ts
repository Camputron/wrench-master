import type { WorkOrder } from '../../../shared/types'

/** One open work order editor. */
export interface Editor {
  /** `wo-<id>` for saved work orders, `new-<n>` for ones not saved yet. */
  key: string
  /** What's stored (or the blank starting point for a new work order); used to tell if there are unsaved changes. */
  baseline: WorkOrder
  draft: WorkOrder
  /** Earlier drafts, for undo. Only line changes (parts, labor, payments) are recorded. */
  past: WorkOrder[]
  future: WorkOrder[]
}

export interface EditorsState {
  editors: Editor[]
  /** The editor being shown, or null for the work order list. */
  active: string | null
  nextNew: number
}

export type EditorsAction =
  /** Opens a saved work order, or switches to it if it's already open. */
  | { type: 'open'; workOrder: WorkOrder; activate: boolean }
  | { type: 'openNew'; draft: WorkOrder }
  | { type: 'close'; key: string }
  | { type: 'activate'; key: string | null }
  /** `record` adds an undo step; leave it off for typing in fields. */
  | { type: 'edit'; key: string; update: (draft: WorkOrder) => WorkOrder; record: boolean }
  | { type: 'undo'; key: string }
  | { type: 'redo'; key: string }
  | { type: 'saved'; key: string; workOrder: WorkOrder }

const MAX_HISTORY = 100

export const keyFor = (id: number): string => `wo-${id}`

export const isDirty = (e: Editor): boolean => JSON.stringify(e.draft) !== JSON.stringify(e.baseline)

export const initialEditorsState: EditorsState = { editors: [], active: null, nextNew: 1 }

function updateEditor(state: EditorsState, key: string, update: (e: Editor) => Editor): EditorsState {
  return { ...state, editors: state.editors.map((e) => (e.key === key ? update(e) : e)) }
}

export function editorsReducer(state: EditorsState, action: EditorsAction): EditorsState {
  switch (action.type) {
    case 'open': {
      const key = keyFor(action.workOrder.id)
      if (state.editors.some((e) => e.key === key)) return action.activate ? { ...state, active: key } : state
      const editor: Editor = { key, baseline: action.workOrder, draft: action.workOrder, past: [], future: [] }
      return { ...state, editors: [...state.editors, editor], active: action.activate ? key : state.active }
    }
    case 'openNew': {
      const key = `new-${state.nextNew}`
      const editor: Editor = { key, baseline: action.draft, draft: action.draft, past: [], future: [] }
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
      return updateEditor(state, action.key, (e) => {
        const draft = action.update(e.draft)
        if (draft === e.draft) return e
        return action.record ? { ...e, draft, past: [...e.past, e.draft].slice(-MAX_HISTORY), future: [] } : { ...e, draft }
      })
    case 'undo':
      return updateEditor(state, action.key, (e) => (e.past.length ? { ...e, draft: e.past[e.past.length - 1], past: e.past.slice(0, -1), future: [e.draft, ...e.future] } : e))
    case 'redo':
      return updateEditor(state, action.key, (e) => (e.future.length ? { ...e, draft: e.future[0], past: [...e.past, e.draft], future: e.future.slice(1) } : e))
    case 'saved': {
      const key = keyFor(action.workOrder.id)
      // A new work order gets its real key once saved. If it's somehow already open under that key, keep one.
      const editors = state.editors.filter((e) => e.key === action.key || e.key !== key).map((e) => (e.key === action.key ? { ...e, key, baseline: action.workOrder, draft: action.workOrder } : e))
      return { ...state, editors, active: state.active === action.key ? key : state.active }
    }
  }
}
