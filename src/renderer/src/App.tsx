import { useState } from 'react'
import type { Page } from '../../shared/types'
import AppBar from './components/AppBar'
import type { AvatarMenuAction } from './components/AvatarDropdownMenu'
import AboutModal from './components/modals/AboutModal'
import PreferencesModal from './components/modals/PreferencesModal'
import { useAppEvent } from './hooks/useAppEvent'
import { useColorScheme } from './hooks/useColorScheme'
import { useSettings } from './hooks/useSettings'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import WorkOrdersPage from './pages/WorkOrdersPage'

const PAGE_COMPONENTS: Record<Page, () => React.ReactElement> = {
  dashboard: DashboardPage,
  customers: CustomersPage,
  workOrders: WorkOrdersPage
}

function App(): React.ReactElement {
  useColorScheme()
  const settings = useSettings()
  const [page, setPage] = useState<Page>('dashboard')
  const [modal, setModal] = useState<AvatarMenuAction | null>(null)
  /** Bumped each time Preferences opens so the form starts from the saved settings. */
  const [preferencesKey, setPreferencesKey] = useState(0)
  /** Bumped when the database is replaced so pages reload their data. */
  const [dataVersion, setDataVersion] = useState(0)

  const open = (which: AvatarMenuAction): void => {
    if (which === 'preferences') setPreferencesKey((k) => k + 1)
    setModal(which)
  }
  const onOpenChange = (isOpen: boolean): void => {
    if (!isOpen) setModal(null)
  }

  useAppEvent('menu', (action) => {
    if (action.type === 'navigate') setPage(action.page)
    else open(action.type)
  })
  useAppEvent('data-changed', () => setDataVersion((v) => v + 1))

  const Page = PAGE_COMPONENTS[page]

  return (
    <div className="flex h-full flex-col">
      <AppBar page={page} onPageChange={setPage} shop={settings?.shop} onMenuAction={open} />
      <main className="min-h-0 flex-1 overflow-auto">
        <Page key={dataVersion} />
      </main>
      {settings && <PreferencesModal key={preferencesKey} isOpen={modal === 'preferences'} onOpenChange={onOpenChange} settings={settings} />}
      <AboutModal isOpen={modal === 'about'} onOpenChange={onOpenChange} />
    </div>
  )
}

export default App
