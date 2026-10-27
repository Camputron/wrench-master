import { ListUl, Xmark } from '@gravity-ui/icons'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import WorkOrderEditor from '../components/workOrders/WorkOrderEditor'
import WorkOrderList from '../components/workOrders/WorkOrderList'
import { useEditors } from '../editors/editorsContext'
import { isDirty, type Editor } from '../editors/editorsReducer'

function editorLabel(e: Editor): string {
  const c = e.draft.customer
  const who = c.lastName || c.firstName || c.company
  const number = e.draft.id > 0 ? `#${e.draft.id}` : 'New'
  return who ? `${number} · ${who}` : number
}

const tabClass = (active: boolean): string => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${active ? 'bg-default font-medium text-foreground' : 'text-muted hover:bg-default/60 hover:text-foreground'}`

/** The work order list, plus a tab for each open work order. */
export default function WorkOrdersPage({ printRequest }: { printRequest: number }): React.ReactElement {
  const { editors, active, showList, show, close } = useEditors()
  const [closing, setClosing] = useState<Editor | null>(null)

  const requestClose = (e: Editor): void => {
    if (isDirty(e)) setClosing(e)
    else close(e.key)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav aria-label="Open work orders" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-separator px-4 py-2">
        <button type="button" className={tabClass(active === null)} aria-current={active === null ? 'page' : undefined} onClick={showList}>
          <ListUl className="size-4" />
          All work orders
        </button>
        {editors.map((e) => {
          const isActive = active?.key === e.key
          const dirty = isDirty(e)
          return (
            <div key={e.key} className={`${tabClass(isActive)} pr-1`}>
              <button type="button" className="flex items-center gap-1.5" aria-current={isActive ? 'page' : undefined} onClick={() => show(e.key)}>
                {editorLabel(e)}
                {dirty && (
                  <span className="size-1.5 rounded-full bg-warning" aria-label="Unsaved changes" role="img">
                    <span className="sr-only">Unsaved changes</span>
                  </span>
                )}
              </button>
              <button type="button" className="rounded p-0.5 text-muted hover:bg-default hover:text-foreground" aria-label={`Close ${editorLabel(e)}`} onClick={() => requestClose(e)}>
                <Xmark className="size-3.5" />
              </button>
            </div>
          )
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">{active ? <WorkOrderEditor key={active.key} editor={active} printRequest={printRequest} /> : <WorkOrderList />}</div>

      {closing && (
        <ConfirmDialog
          isOpen
          onOpenChange={(open) => !open && setClosing(null)}
          title={closing.draft.id > 0 ? `Discard changes to work order #${closing.draft.id}?` : 'Discard this new work order?'}
          confirmLabel="Discard changes"
          onConfirm={async () => close(closing.key)}
        >
          <p>Your unsaved changes will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
