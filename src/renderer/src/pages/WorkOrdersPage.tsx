import EditorTabsPage from '../components/EditorTabsPage'
import WorkOrderEditor from '../components/workOrders/WorkOrderEditor'
import WorkOrderList from '../components/workOrders/WorkOrderList'
import { useEditors } from '../editors/editorsContext'
import type { Editor } from '../editors/editorsReducer'

function editorLabel(e: Editor): string {
  const c = e.draft.customer
  const who = c.lastName || c.firstName || c.company
  const number = e.draft.id > 0 ? `#${e.draft.id}` : 'New'
  return who ? `${number} · ${who}` : number
}

/** The work order list, plus a tab for each open work order. */
export default function WorkOrdersPage({ printRequest, closeRequest }: { printRequest: number; closeRequest: number }): React.ReactElement {
  const editors = useEditors()
  return (
    <EditorTabsPage
      editors={editors}
      listLabel="All work orders"
      tabsLabel="Open work orders"
      editorLabel={editorLabel}
      discardTitle={(e) => (e.draft.id > 0 ? `Discard changes to work order #${e.draft.id}?` : 'Discard this new work order?')}
      list={<WorkOrderList />}
      renderEditor={(active) => <WorkOrderEditor key={active.key} editor={active} printRequest={printRequest} closeRequest={closeRequest} />}
    />
  )
}
