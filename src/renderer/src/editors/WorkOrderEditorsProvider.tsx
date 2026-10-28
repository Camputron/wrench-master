import { useMemo, type ReactNode } from 'react'
import { todayIso } from '../lib/format'
import { keys } from '../lib/queryClient'
import { emptyWorkOrder, toWorkOrderVehicle } from '../lib/records'
import { EditorsContext, type EditorsApi } from './editorsContext'
import { workOrderEditors } from './editorsReducer'
import { useDocumentEditors } from './useDocumentEditors'

interface Props {
  /** Tax rate for new work orders, from settings. */
  defaultTaxRate: number
  /** Called when an editor should be shown, so the app can switch to the Work Orders page. */
  onShow: () => void
  children: ReactNode
}

/** Open work order editors for the whole app (see useDocumentEditors). */
export default function WorkOrderEditorsProvider({ defaultTaxRate, onShow, children }: Props): React.ReactElement {
  const editors = useDocumentEditors({
    kind: 'workOrder',
    noun: 'work order',
    editors: workOrderEditors,
    get: (id) => window.api.workOrders.get(id),
    getByIds: (ids) => window.api.workOrders.getByIds(ids),
    store: (wo) => window.api.workOrders.save(wo),
    openIds: () => window.api.session.openWorkOrderIds(),
    setOpenIds: (ids) => window.api.session.setOpenWorkOrderIds(ids),
    // Lists, customer pages, and the dashboard all show work orders.
    queryKey: keys.workOrders,
    onShow
  })

  const api = useMemo<EditorsApi>(
    () => ({
      ...editors,
      openWorkOrder: editors.open,
      newWorkOrder: (prefill) => {
        const draft = emptyWorkOrder(defaultTaxRate, todayIso())
        if (prefill?.customer) draft.customer = prefill.customer
        if (prefill?.vehicle) draft.vehicle = toWorkOrderVehicle(prefill.vehicle)
        editors.openNew(draft)
      }
    }),
    [editors, defaultTaxRate]
  )

  return <EditorsContext value={api}>{children}</EditorsContext>
}
