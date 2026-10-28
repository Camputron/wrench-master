import { createContext, use } from 'react'
import type { Customer, Vehicle, WorkOrder } from '../../../shared/types'
import type { Editor } from './editorsReducer'

export interface EditorsApi {
  editors: Editor[]
  /** The editor being shown, or null for the work order list. */
  active: Editor | null
  /** Shows the work order list. */
  showList: () => void
  /** Shows an open editor. */
  show: (key: string) => void
  /** Opens a saved work order (or switches to it if already open) and shows the Work Orders page. */
  openWorkOrder: (id: number) => Promise<void>
  /** Starts a new work order, optionally for a customer and vehicle, and shows the Work Orders page. */
  newWorkOrder: (prefill?: { customer?: Customer; vehicle?: Vehicle }) => void
  /** Changes the draft. Pass `record` for changes that should be undoable (lines added, edited, removed). */
  edit: (key: string, update: (draft: WorkOrder) => WorkOrder, record?: boolean) => void
  undo: (key: string) => void
  redo: (key: string) => void
  /** Saves the draft. Resolves to the stored work order. */
  save: (key: string) => Promise<WorkOrder>
  /** Replaces the work order in its editor, if open, with the stored one (e.g. after voiding it). */
  reload: (workOrder: WorkOrder) => void
  /** Closes without asking; callers confirm discarding unsaved changes first. */
  close: (key: string) => void
}

export const EditorsContext = createContext<EditorsApi | null>(null)

export function useEditors(): EditorsApi {
  const api = use(EditorsContext)
  if (!api) throw new Error('useEditors must be used inside <WorkOrderEditorsProvider>')
  return api
}
