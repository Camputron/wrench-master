import { Toast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
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

function App(): React.ReactElement {
  useColorScheme()
  const settings = useSettings()
  const queryClient = useQueryClient()
  const [page, setPage] = useState<Page>('dashboard')
  const [modal, setModal] = useState<AvatarMenuAction | null>(null)
  /** Bumped each time Preferences opens so the form starts from the saved settings. */
  const [preferencesKey, setPreferencesKey] = useState(0)
  /** Bumped when the database is replaced so pages start over (selection, scroll, cached data). */
  const [dataVersion, setDataVersion] = useState(0)
  /** Bumped by File > New Customer. */
  const [newCustomerRequest, setNewCustomerRequest] = useState(0)

  const open = (which: AvatarMenuAction): void => {
    if (which === 'preferences') setPreferencesKey((k) => k + 1)
    setModal(which)
  }
  const onOpenChange = (isOpen: boolean): void => {
    if (!isOpen) setModal(null)
  }

  useAppEvent('menu', (action) => {
    switch (action.type) {
      case 'navigate':
        setPage(action.page)
        break
      case 'newCustomer':
        setPage('customers')
        setNewCustomerRequest((n) => n + 1)
        break
      default:
        open(action.type)
    }
  })
  useAppEvent('data-changed', () => {
    queryClient.clear()
    setDataVersion((v) => v + 1)
  })

  return (
    <div className="flex h-full flex-col">
      <AppBar page={page} onPageChange={setPage} shop={settings?.shop} onMenuAction={open} />
      <main key={dataVersion} className="min-h-0 flex-1 overflow-auto">
        {page === 'dashboard' && <DashboardPage />}
        {page === 'customers' && <CustomersPage newCustomerRequest={newCustomerRequest} />}
        {page === 'workOrders' && <WorkOrdersPage />}
      </main>
      {settings && <PreferencesModal key={preferencesKey} isOpen={modal === 'preferences'} onOpenChange={onOpenChange} settings={settings} />}
      <AboutModal isOpen={modal === 'about'} onOpenChange={onOpenChange} />
      <Toast.Provider placement="bottom end" />
    </div>
  )
}

export default App
