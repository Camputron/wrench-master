import { Toast, toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState, type ReactNode } from 'react'
import type { DocumentKind, Page } from '../../shared/types'
import AppBar from './components/AppBar'
import type { AvatarMenuAction } from './components/AvatarDropdownMenu'
import AboutModal from './components/modals/AboutModal'
import PreferencesModal from './components/modals/PreferencesModal'
import { useEditors, useEstimateEditors } from './editors/editorsContext'
import { isDirty } from './editors/editorsReducer'
import EstimateEditorsProvider from './editors/EstimateEditorsProvider'
import { useSaveEstimate } from './editors/estimateActions'
import { useSaveWorkOrder } from './editors/useSaveWorkOrder'
import WorkOrderEditorsProvider from './editors/WorkOrderEditorsProvider'
import { useAppEvent } from './hooks/useAppEvent'
import { useColorScheme } from './hooks/useColorScheme'
import { useSettings } from './hooks/useSettings'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import EstimatesPage from './pages/EstimatesPage'
import WorkOrdersPage from './pages/WorkOrdersPage'

const isMac = navigator.userAgent.includes('Mac')

/** Focuses a search field once it's on screen (after the page or list it's on has been shown). */
function focusSearch(label: string): void {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
    input?.focus()
    input?.select()
  })
}

/** True when keyboard focus is in a text field, where Undo/Redo should edit the text. */
function isEditingText(): boolean {
  const el = document.activeElement
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(el.type)) || (el instanceof HTMLElement && el.isContentEditable)
}

/**
 * Mounts a page the first time it's shown, then only hides it, so switching back is instant and the
 * page keeps its search, selection, and scroll position.
 */
function KeepAlive({ active, children }: { active: boolean; children: ReactNode }): React.ReactElement | null {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!visited && !active) return null
  return (
    <div className="h-full" hidden={!active}>
      {children}
    </div>
  )
}

/** The editor on screen, as the menu commands see it. */
interface ShownEditor {
  kind: DocumentKind
  dirty: boolean
  save: () => Promise<unknown>
  close: () => void
  undo: () => void
  redo: () => void
}

interface ShellProps {
  page: Page
  setPage: (page: Page) => void
}

function Shell({ page, setPage }: ShellProps): React.ReactElement {
  const settings = useSettings()
  const queryClient = useQueryClient()
  const editors = useEditors()
  const estimates = useEstimateEditors()
  const saveWorkOrder = useSaveWorkOrder()
  const saveEstimate = useSaveEstimate()
  const [modal, setModal] = useState<AvatarMenuAction | null>(null)
  /** Bumped each time Preferences opens so the form starts from the saved settings. */
  const [preferencesKey, setPreferencesKey] = useState(0)
  /** Bumped when the database is replaced so pages start over (selection, scroll, cached data). */
  const [dataVersion, setDataVersion] = useState(0)
  /** Bumped by File > New Customer. */
  const [newCustomerRequest, setNewCustomerRequest] = useState(0)
  /**
   * Bumped by File > Print, and by File > Close Tab when the document has unsaved changes (so its editor asks
   * first). Kept per kind: both pages stay mounted, and only the editor on screen should respond.
   */
  const [printRequest, setPrintRequest] = useState({ workOrder: 0, estimate: 0 })
  const [closeRequest, setCloseRequest] = useState({ workOrder: 0, estimate: 0 })
  const bump = (kind: DocumentKind) => (r: Record<DocumentKind, number>) => ({ ...r, [kind]: r[kind] + 1 })

  const open = (which: AvatarMenuAction): void => {
    if (which === 'preferences') setPreferencesKey((k) => k + 1)
    setModal(which)
  }
  const onOpenChange = (isOpen: boolean): void => {
    if (!isOpen) setModal(null)
  }
  /** The work order or estimate editor on screen, if any, and what the menu can do with it. */
  const shownWorkOrder = page === 'workOrders' ? editors.active : null
  const shownEstimate = page === 'estimates' ? estimates.active : null
  const shown: ShownEditor | null = shownWorkOrder
    ? { kind: 'workOrder', dirty: isDirty(shownWorkOrder), save: () => saveWorkOrder(shownWorkOrder.key), close: () => editors.close(shownWorkOrder.key), undo: () => editors.undo(shownWorkOrder.key), redo: () => editors.redo(shownWorkOrder.key) }
    : shownEstimate
      ? { kind: 'estimate', dirty: isDirty(shownEstimate), save: () => saveEstimate(shownEstimate.key), close: () => estimates.close(shownEstimate.key), undo: () => estimates.undo(shownEstimate.key), redo: () => estimates.redo(shownEstimate.key) }
      : null

  useAppEvent('menu', (action) => {
    switch (action.type) {
      case 'navigate':
        setPage(action.page)
        break
      case 'newCustomer':
        setPage('customers')
        setNewCustomerRequest((n) => n + 1)
        break
      case 'newWorkOrder':
        editors.newWorkOrder()
        break
      case 'newEstimate':
        estimates.newEstimate()
        break
      case 'save':
        if (shown) void shown.save()
        break
      case 'print':
        if (shown) setPrintRequest(bump(shown.kind))
        else toast.info('Open a work order or estimate to print it.')
        break
      case 'closeTab':
        // Cmd+W closes the window on macOS when there's nothing to close, as it does in other apps.
        if (shown?.dirty) setCloseRequest(bump(shown.kind))
        else if (shown) shown.close()
        else if (isMac) window.close()
        break
      case 'find':
        if (page === 'customers') focusSearch('Search customers')
        else if (page === 'estimates') {
          estimates.showList()
          focusSearch('Search estimates')
        } else {
          setPage('workOrders')
          editors.showList()
          focusSearch('Search work orders')
        }
        break
      case 'undo':
      case 'redo':
        if (isEditingText() || !shown) document.execCommand(action.type)
        else shown[action.type]()
        break
      default:
        open(action.type)
    }
  })
  useAppEvent('notice', ({ kind, message, path }) => {
    const options = path ? { actionProps: { children: 'Show in folder', onPress: () => void window.api.app.showItemInFolder(path) } } : undefined
    if (kind === 'success') toast.success(message, options)
    else toast.danger(message, options)
  })
  useAppEvent('data-changed', () => {
    // Open editors refer to work orders and estimates from the old database.
    for (const e of editors.editors) editors.close(e.key)
    for (const e of estimates.editors) estimates.close(e.key)
    queryClient.clear()
    setDataVersion((v) => v + 1)
  })

  return (
    <div className="flex h-full flex-col">
      <AppBar page={page} onPageChange={setPage} shop={settings?.shop} onMenuAction={open} />
      <main className="min-h-0 flex-1 overflow-auto">
        {/* Keyed wrapper, not <main> itself: re-keying the <main> landmark left the old page in the DOM. */}
        <div key={dataVersion} className="contents">
          <KeepAlive active={page === 'dashboard'}>
            <DashboardPage />
          </KeepAlive>
          <KeepAlive active={page === 'customers'}>
            <CustomersPage newCustomerRequest={newCustomerRequest} />
          </KeepAlive>
          <KeepAlive active={page === 'workOrders'}>
            <WorkOrdersPage printRequest={printRequest.workOrder} closeRequest={closeRequest.workOrder} />
          </KeepAlive>
          <KeepAlive active={page === 'estimates'}>
            <EstimatesPage printRequest={printRequest.estimate} closeRequest={closeRequest.estimate} />
          </KeepAlive>
        </div>
      </main>
      {settings && <PreferencesModal key={preferencesKey} isOpen={modal === 'preferences'} onOpenChange={onOpenChange} settings={settings} />}
      <AboutModal isOpen={modal === 'about'} onOpenChange={onOpenChange} />
      <Toast.Provider placement="bottom end" />
    </div>
  )
}

function App(): React.ReactElement {
  useColorScheme()
  const settings = useSettings()
  const [page, setPage] = useState<Page>('dashboard')
  const showWorkOrders = useCallback(() => setPage('workOrders'), [])
  const showEstimates = useCallback(() => setPage('estimates'), [])

  return (
    <WorkOrderEditorsProvider defaultTaxRate={settings?.taxRate ?? 0} onShow={showWorkOrders}>
      <EstimateEditorsProvider defaultTaxRate={settings?.taxRate ?? 0} onShow={showEstimates}>
        <Shell page={page} setPage={setPage} />
      </EstimateEditorsProvider>
    </WorkOrderEditorsProvider>
  )
}

export default App
