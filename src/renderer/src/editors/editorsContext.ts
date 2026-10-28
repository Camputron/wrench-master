import { createContext, use } from 'react'
import type { Customer, Estimate, Vehicle, WorkOrder } from '../../../shared/types'
import type { DocumentEditorsApi } from './useDocumentEditors'

/** A customer and vehicle to start a new work order or estimate with. */
export interface Prefill {
  customer?: Customer
  vehicle?: Vehicle
}

export interface EditorsApi extends DocumentEditorsApi<WorkOrder> {
  /** Opens a saved work order (or switches to it if already open) and shows the Work Orders page. */
  openWorkOrder: (id: number) => Promise<void>
  /** Starts a new work order, optionally for a customer and vehicle, and shows the Work Orders page. */
  newWorkOrder: (prefill?: Prefill) => void
}

export interface EstimateEditorsApi extends DocumentEditorsApi<Estimate> {
  /** Opens a saved estimate (or switches to it if already open) and shows the Estimates page. */
  openEstimate: (id: number) => Promise<void>
  /** Starts a new estimate, optionally for a customer and vehicle, and shows the Estimates page. */
  newEstimate: (prefill?: Prefill) => void
}

export const EditorsContext = createContext<EditorsApi | null>(null)
export const EstimateEditorsContext = createContext<EstimateEditorsApi | null>(null)

/** Work order editors. */
export function useEditors(): EditorsApi {
  const api = use(EditorsContext)
  if (!api) throw new Error('useEditors must be used inside <WorkOrderEditorsProvider>')
  return api
}

export function useEstimateEditors(): EstimateEditorsApi {
  const api = use(EstimateEditorsContext)
  if (!api) throw new Error('useEstimateEditors must be used inside <EstimateEditorsProvider>')
  return api
}
