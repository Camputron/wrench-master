import { toast } from '@heroui/react'
import { useCallback } from 'react'
import { validateWorkOrder } from '../lib/records'
import { useEditors } from './editorsContext'
import { keyFor } from './editorsReducer'

/** Saves an open work order with validation and a toast, optionally closing it. Resolves to whether it saved. */
export function useSaveWorkOrder(): (key: string, thenClose?: boolean) => Promise<boolean> {
  const { editors, save, close } = useEditors()
  return useCallback(
    async (key, thenClose = false) => {
      const editor = editors.find((e) => e.key === key)
      if (!editor) return false
      if (editor.draft.dateVoided) {
        toast.info('This work order is voided. Restore it to make changes.')
        return false
      }
      const problem = validateWorkOrder(editor.draft)
      if (problem) {
        toast.danger(problem)
        return false
      }
      try {
        const stored = await save(key)
        toast.success(`Saved work order #${stored.id}`)
        if (thenClose) close(keyFor(stored.id))
        return true
      } catch (e) {
        toast.danger(`Couldn’t save: ${e instanceof Error ? e.message : String(e)}`)
        return false
      }
    },
    [editors, save, close]
  )
}
