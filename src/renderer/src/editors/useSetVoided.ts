import { toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import type { WorkOrder } from '../../../shared/types'
import { keys } from '../lib/queryClient'
import { useEditors } from './editorsContext'
import { isDirty, keyFor } from './editorsReducer'

/**
 * Voids a work order (kept for the records, but left out of totals) or restores it, updating its editor
 * if it's open. Refuses while it has unsaved changes, which would otherwise be replaced.
 */
export function useSetVoided(): (workOrder: WorkOrder, voided: boolean) => Promise<void> {
  const queryClient = useQueryClient()
  const { editors, reload } = useEditors()
  return async (wo, voided) => {
    const editor = editors.find((e) => e.key === keyFor(wo.id))
    if (editor && isDirty(editor)) {
      toast.warning(`Work order #${wo.id} has unsaved changes. Save or close it first.`)
      return
    }
    try {
      const stored = await window.api.workOrders.setVoided(wo.id, voided)
      if (stored) reload(stored)
      await queryClient.invalidateQueries({ queryKey: keys.workOrders })
      toast.success(voided ? `Voided work order #${wo.id}` : `Restored work order #${wo.id}`)
    } catch (e) {
      toast.danger(`Couldn’t ${voided ? 'void' : 'restore'} work order #${wo.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}
