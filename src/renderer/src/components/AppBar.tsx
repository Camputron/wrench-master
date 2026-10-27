import { Wrench } from '@gravity-ui/icons'
import { Tabs } from '@heroui/react'
import type { Page, ShopInfo } from '../../../shared/types'
import AvatarDropdownMenu, { type AvatarMenuAction } from './AvatarDropdownMenu'

const PAGES: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'workOrders', label: 'Work Orders' }
]

interface Props {
  page: Page
  onPageChange: (page: Page) => void
  shop: ShopInfo | undefined
  onMenuAction: (action: AvatarMenuAction) => void
}

/**
 * Top bar with the page tabs. The page itself is rendered by the caller, outside `<Tabs>`:
 * react-aria renders a Tabs subtree twice to collect its items, which would mount pages and
 * open dialogs twice.
 */
export default function AppBar({ page, onPageChange, shop, onMenuAction }: Props): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-6 border-b border-separator bg-background/80 px-4 backdrop-blur-lg">
      <div className="flex items-center gap-2">
        <Wrench className="size-5 text-accent" />
        <p className="font-bold">Wrench Master</p>
      </div>
      <Tabs selectedKey={page} onSelectionChange={(key) => onPageChange(key as Page)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Pages">
            {PAGES.map(({ id, label }) => (
              <Tabs.Tab key={id} id={id} className="whitespace-nowrap">
                {label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <div className="ml-auto">
        <AvatarDropdownMenu shop={shop} onAction={onMenuAction} />
      </div>
    </header>
  )
}
