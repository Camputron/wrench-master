import { Bug, CircleInfo, Gear } from '@gravity-ui/icons'
import { Avatar, Dropdown, Label, Separator } from '@heroui/react'
import type { ShopInfo } from '../../../shared/types'

const ISSUES_URL = 'https://github.com/Camposm97/Autoshop-Invoice-Manager/issues'

export type AvatarMenuAction = 'preferences' | 'about'

interface Props {
  shop: ShopInfo | undefined
  onAction: (action: AvatarMenuAction) => void
}

/** Up to two initials from the shop's name, e.g. "Joe's Auto Body" -> "JA". */
function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, '').charAt(0))
    .filter(Boolean)
  return letters.slice(0, 2).join('').toUpperCase()
}

/** The shop's avatar in the app bar, with app-level actions. */
const AvatarDropdownMenu = ({ shop, onAction }: Props): React.ReactElement => {
  const company = shop?.company.trim() ?? ''
  return (
    <Dropdown>
      <Dropdown.Trigger className="rounded-full" aria-label="Shop menu">
        <Avatar size="sm">
          <Avatar.Fallback>{initials(company) || <Gear className="size-4" />}</Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <div className="px-3 pt-3 pb-1">
          <p className="text-sm font-medium">{company || 'Your shop'}</p>
          <p className="text-xs text-muted">{company ? [shop?.city, shop?.phone].filter(Boolean).join(' · ') : 'Add your shop details in Preferences'}</p>
        </div>
        <Dropdown.Menu
          onAction={(key) => {
            if (key === 'help') window.open(ISSUES_URL)
            else onAction(key as AvatarMenuAction)
          }}
        >
          <Dropdown.Item id="preferences" textValue="Preferences">
            <Gear className="size-4 shrink-0 text-muted" />
            <Label>Preferences</Label>
          </Dropdown.Item>
          <Separator />
          <Dropdown.Item id="help" textValue="Help and feedback">
            <Bug className="size-4 shrink-0 text-muted" />
            <Label>Help &amp; Feedback</Label>
          </Dropdown.Item>
          <Dropdown.Item id="about" textValue="About">
            <CircleInfo className="size-4 shrink-0 text-muted" />
            <Label>About</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}

export default AvatarDropdownMenu
