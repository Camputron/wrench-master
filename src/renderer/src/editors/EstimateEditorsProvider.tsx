import { useMemo, type ReactNode } from 'react'
import { todayIso } from '../lib/format'
import { keys } from '../lib/queryClient'
import { emptyEstimate, toWorkOrderVehicle } from '../lib/records'
import { EstimateEditorsContext, type EstimateEditorsApi } from './editorsContext'
import { estimateEditors } from './editorsReducer'
import { useDocumentEditors } from './useDocumentEditors'

interface Props {
  /** Tax rate for new estimates, from settings. */
  defaultTaxRate: number
  /** Called when an editor should be shown, so the app can switch to the Estimates page. */
  onShow: () => void
  children: ReactNode
}

/** Open estimate editors for the whole app (see useDocumentEditors). */
export default function EstimateEditorsProvider({ defaultTaxRate, onShow, children }: Props): React.ReactElement {
  const editors = useDocumentEditors({
    kind: 'estimate',
    noun: 'estimate',
    editors: estimateEditors,
    get: (id) => window.api.estimates.get(id),
    getByIds: (ids) => window.api.estimates.getByIds(ids),
    store: (e) => window.api.estimates.save(e),
    openIds: () => window.api.session.openEstimateIds(),
    setOpenIds: (ids) => window.api.session.setOpenEstimateIds(ids),
    queryKey: keys.estimates,
    onShow
  })

  const api = useMemo<EstimateEditorsApi>(
    () => ({
      ...editors,
      openEstimate: editors.open,
      newEstimate: (prefill) => {
        const draft = emptyEstimate(defaultTaxRate, todayIso())
        if (prefill?.customer) draft.customer = prefill.customer
        if (prefill?.vehicle) draft.vehicle = toWorkOrderVehicle(prefill.vehicle)
        editors.openNew(draft)
      }
    }),
    [editors, defaultTaxRate]
  )

  return <EstimateEditorsContext value={api}>{children}</EstimateEditorsContext>
}
