import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import type { Vehicle, WorkOrderVehicle } from '../../../shared/types'
import { todayIso } from '../lib/format'
import { keys } from '../lib/queryClient'
import { emptyWorkOrder } from '../lib/records'
import { EditorsContext, type EditorsApi } from './editorsContext'
import { editorsReducer, initialEditorsState, isDirty, keyFor } from './editorsReducer'

const toWorkOrderVehicle = ({ vin, year, make, model, licensePlate, color, engine, transmission }: Vehicle): WorkOrderVehicle => ({
  vin,
  year,
  make,
  model,
  licensePlate,
  color,
  engine,
  transmission,
  mileageIn: '',
  mileageOut: ''
})

interface Props {
  /** Tax rate for new work orders, from settings. */
  defaultTaxRate: number
  /** Called when an editor should be shown, so the app can switch to the Work Orders page. */
  onShow: () => void
  children: ReactNode
}

/**
 * Keeps open work order editors (and their unsaved drafts) for the whole app, so switching pages doesn't
 * lose work. Reopens the work orders that were open last time, and keeps the main process informed about
 * unsaved changes so quitting can warn.
 */
export default function WorkOrderEditorsProvider({ defaultTaxRate, onShow, children }: Props): React.ReactElement {
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(editorsReducer, initialEditorsState)
  const editorsRef = useRef(state.editors)
  useEffect(() => {
    editorsRef.current = state.editors
  })

  // Reopen the work orders that were open when the app was last closed.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    void (async () => {
      const ids = await window.api.session.openWorkOrderIds()
      const workOrders = ids.length ? await window.api.workOrders.getByIds(ids) : []
      for (const workOrder of workOrders) dispatch({ type: 'open', workOrder, activate: false })
    })()
  }, [])

  // Remember which saved work orders are open.
  const openIds = state.editors.filter((e) => e.key.startsWith('wo-')).map((e) => e.draft.id)
  const openIdsKey = openIds.join(',')
  useEffect(() => {
    if (restoredRef.current) void window.api.session.setOpenWorkOrderIds(openIdsKey ? openIdsKey.split(',').map(Number) : [])
  }, [openIdsKey])

  const dirtyCount = state.editors.filter(isDirty).length
  useEffect(() => {
    void window.api.app.setUnsavedChanges(dirtyCount)
  }, [dirtyCount])

  const openWorkOrder = useCallback(
    async (id: number) => {
      onShow()
      if (editorsRef.current.some((e) => e.key === keyFor(id))) {
        dispatch({ type: 'activate', key: keyFor(id) })
        return
      }
      const workOrder = await window.api.workOrders.get(id)
      if (workOrder) dispatch({ type: 'open', workOrder, activate: true })
    },
    [onShow]
  )

  const save = useCallback(
    async (key: string) => {
      const editor = editorsRef.current.find((e) => e.key === key)
      if (!editor) throw new Error('This work order is no longer open.')
      const stored = await window.api.workOrders.save(editor.draft)
      dispatch({ type: 'saved', key, workOrder: stored })
      // Lists, customer pages, and the dashboard all show work orders.
      await queryClient.invalidateQueries({ queryKey: keys.workOrders })
      return stored
    },
    [queryClient]
  )

  const api = useMemo<EditorsApi>(
    () => ({
      editors: state.editors,
      active: state.editors.find((e) => e.key === state.active) ?? null,
      showList: () => dispatch({ type: 'activate', key: null }),
      show: (key) => dispatch({ type: 'activate', key }),
      openWorkOrder,
      newWorkOrder: (prefill) => {
        const draft = emptyWorkOrder(defaultTaxRate, todayIso())
        if (prefill?.customer) draft.customer = prefill.customer
        if (prefill?.vehicle) draft.vehicle = toWorkOrderVehicle(prefill.vehicle)
        dispatch({ type: 'openNew', draft })
        onShow()
      },
      edit: (key, update, record = false) => dispatch({ type: 'edit', key, update, record }),
      undo: (key) => dispatch({ type: 'undo', key }),
      redo: (key) => dispatch({ type: 'redo', key }),
      save,
      close: (key) => dispatch({ type: 'close', key })
    }),
    [state, openWorkOrder, save, defaultTaxRate, onShow]
  )

  return <EditorsContext value={api}>{children}</EditorsContext>
}
