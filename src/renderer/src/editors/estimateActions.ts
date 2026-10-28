import { toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { estimateNumber } from '../../../shared/estimates'
import type { Estimate } from '../../../shared/types'
import { keys } from '../lib/queryClient'
import { validateEstimate } from '../lib/records'
import { useEditors, useEstimateEditors } from './editorsContext'
import { isDirty } from './editorsReducer'

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Saves an estimate's draft with feedback. Resolves to the stored estimate, or null if it couldn't be saved. */
export function useSaveEstimate(): (key: string, thenClose?: boolean) => Promise<Estimate | null> {
  const { editors, save, close, keyFor } = useEstimateEditors()
  return async (key, thenClose = false) => {
    const editor = editors.find((e) => e.key === key)
    if (!editor) return null
    if (editor.draft.status !== 'open') {
      toast.info(`This estimate is ${editor.draft.status} and can’t be changed.`)
      return null
    }
    const problem = validateEstimate(editor.draft)
    if (problem) {
      toast.danger(problem)
      return null
    }
    try {
      const stored = await save(key)
      toast.success(`Saved estimate ${estimateNumber(stored.id)}`)
      if (thenClose) close(keyFor(stored.id))
      return stored
    } catch (e) {
      toast.danger(`Couldn’t save: ${message(e)}`)
      return null
    }
  }
}

/** Accepting (turning into a work order), declining, and reopening estimates. */
export function useEstimateActions(): {
  /** Saves the estimate if needed, turns it into a work order, and opens the work order. */
  accept: (key: string) => Promise<void>
  /** Saves the estimate if needed, then marks it declined. */
  decline: (key: string) => Promise<void>
  reopen: (estimate: Estimate) => Promise<void>
} {
  const estimates = useEstimateEditors()
  const { openWorkOrder } = useEditors()
  const saveEstimate = useSaveEstimate()
  const queryClient = useQueryClient()
  const refresh = (): Promise<unknown> => Promise.all([queryClient.invalidateQueries({ queryKey: keys.estimates }), queryClient.invalidateQueries({ queryKey: keys.workOrders })])

  /** The saved estimate behind an editor, saving it first if it's new or has changes. */
  const savedId = async (key: string): Promise<number | null> => {
    const editor = estimates.editors.find((e) => e.key === key)
    if (!editor) return null
    if (editor.draft.id > 0 && !isDirty(editor)) return editor.draft.id
    return (await saveEstimate(key))?.id ?? null
  }

  return {
    accept: async (key) => {
      const id = await savedId(key)
      if (id === null) return
      try {
        const workOrder = await window.api.estimates.convert(id)
        const stored = await window.api.estimates.get(id)
        if (stored) estimates.reload(stored)
        await refresh()
        toast.success(`Accepted estimate ${estimateNumber(id)} and created work order #${workOrder.id}`)
        await openWorkOrder(workOrder.id)
      } catch (e) {
        toast.danger(`Couldn’t accept the estimate: ${message(e)}`)
      }
    },
    decline: async (key) => {
      const id = await savedId(key)
      if (id === null) return
      const stored = await window.api.estimates.setStatus(id, 'declined')
      if (stored) estimates.reload(stored)
      await refresh()
      toast.success(`Marked estimate ${estimateNumber(id)} declined`)
    },
    reopen: async (estimate) => {
      const stored = await window.api.estimates.setStatus(estimate.id, 'open')
      if (stored) estimates.reload(stored)
      await refresh()
      toast.success(`Reopened estimate ${estimateNumber(estimate.id)}`)
    }
  }
}
