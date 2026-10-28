import { ListUl, Xmark } from '@gravity-ui/icons'
import { useState, type ReactNode } from 'react'
import { isDirty, type Doc, type Editor } from '../editors/editorsReducer'
import type { DocumentEditorsApi } from '../editors/useDocumentEditors'
import ConfirmDialog from './ConfirmDialog'

interface Props<D extends Doc> {
  editors: DocumentEditorsApi<D>
  /** e.g. "All work orders". */
  listLabel: string
  /** e.g. "Open work orders", for the tab strip's landmark. */
  tabsLabel: string
  /** The tab label for an editor, e.g. "#12 · Doe". */
  editorLabel: (e: Editor<D>) => string
  /** Title for "discard changes?" when closing a tab with unsaved changes. */
  discardTitle: (e: Editor<D>) => string
  list: ReactNode
  /** The editor for the active document (keyed by the caller). */
  renderEditor: (active: Editor<D>) => ReactNode
}

const tabClass = (active: boolean): string => `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${active ? 'bg-default font-medium text-foreground' : 'text-muted hover:bg-default/60 hover:text-foreground'}`

/** A list plus a tab for each open document, as on the Work Orders and Estimates pages. */
export default function EditorTabsPage<D extends Doc>({ editors: api, listLabel, tabsLabel, editorLabel, discardTitle, list, renderEditor }: Props<D>): React.ReactElement {
  const { editors, active, showList, show, close } = api
  const [closing, setClosing] = useState<Editor<D> | null>(null)

  const requestClose = (e: Editor<D>): void => {
    if (isDirty(e)) setClosing(e)
    else close(e.key)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav aria-label={tabsLabel} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-separator px-4 py-2">
        <button type="button" className={tabClass(active === null)} aria-current={active === null ? 'page' : undefined} onClick={showList}>
          <ListUl className="size-4" />
          {listLabel}
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
      {/* The list stays mounted while an editor is shown, so its search, filters, and scroll position survive. */}
      <div className="min-h-0 flex-1 overflow-auto" hidden={active !== null}>
        {list}
      </div>
      {active && <div className="min-h-0 flex-1 overflow-auto">{renderEditor(active)}</div>}

      {closing && (
        <ConfirmDialog isOpen onOpenChange={(open) => !open && setClosing(null)} title={discardTitle(closing)} confirmLabel="Discard changes" onConfirm={async () => close(closing.key)}>
          <p>Your unsaved changes will be lost.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
