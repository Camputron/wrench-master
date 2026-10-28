import { estimateNumber } from '../../../shared/estimates'
import type { Estimate } from '../../../shared/types'
import EditorTabsPage from '../components/EditorTabsPage'
import EstimateEditor from '../components/estimates/EstimateEditor'
import EstimateList from '../components/estimates/EstimateList'
import { useEstimateEditors } from '../editors/editorsContext'
import type { Editor } from '../editors/editorsReducer'

function editorLabel(e: Editor<Estimate>): string {
  const c = e.draft.customer
  const who = c.lastName || c.firstName || c.company
  const number = e.draft.id > 0 ? estimateNumber(e.draft.id) : 'New'
  return who ? `${number} · ${who}` : number
}

/** The estimate list, plus a tab for each open estimate. */
export default function EstimatesPage({ printRequest, closeRequest }: { printRequest: number; closeRequest: number }): React.ReactElement {
  const editors = useEstimateEditors()
  return (
    <EditorTabsPage
      editors={editors}
      listLabel="All estimates"
      tabsLabel="Open estimates"
      editorLabel={editorLabel}
      discardTitle={(e) => (e.draft.id > 0 ? `Discard changes to estimate ${estimateNumber(e.draft.id)}?` : 'Discard this new estimate?')}
      list={<EstimateList />}
      renderEditor={(active) => <EstimateEditor key={active.key} editor={active} printRequest={printRequest} closeRequest={closeRequest} />}
    />
  )
}
