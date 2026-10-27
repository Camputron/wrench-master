import { stateByKey } from '../shared/states'
import { ZOOM_LEVELS, type Settings, type SettingsPatch, type ShopInfo, type Theme } from '../shared/types'
import { JsonFile } from './jsonFile'

export const DEFAULT_SETTINGS: Settings = {
  shop: { company: '', street: '', city: '', state: 'UNKNOWN', zip: '', phone: '', repairShopId: '', invoiceTitle: '' },
  laborRate: 90,
  taxRate: 0.08625,
  theme: 'system',
  zoom: 1,
  confirmExit: false
}

const THEMES: Theme[] = ['light', 'dark', 'system']

/** Applies the valid parts of `patch` (which may come from the renderer) to `base`. */
export function applyPatch(base: Settings, patch: SettingsPatch | undefined): Settings {
  const next: Settings = { ...base, shop: { ...base.shop } }
  if (!patch || typeof patch !== 'object') return next
  if (patch.shop && typeof patch.shop === 'object') {
    for (const key of Object.keys(next.shop) as (keyof ShopInfo)[]) {
      const value = patch.shop[key]
      if (typeof value === 'string') next.shop[key] = value
    }
    if (!stateByKey(next.shop.state)) next.shop.state = 'UNKNOWN'
  }
  const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (isNumber(patch.laborRate) && patch.laborRate >= 0) next.laborRate = patch.laborRate
  if (isNumber(patch.taxRate) && patch.taxRate >= 0 && patch.taxRate < 1) next.taxRate = patch.taxRate
  if (patch.theme && THEMES.includes(patch.theme)) next.theme = patch.theme
  if (isNumber(patch.zoom) && (ZOOM_LEVELS as readonly number[]).includes(patch.zoom)) next.zoom = patch.zoom
  if (typeof patch.confirmExit === 'boolean') next.confirmExit = patch.confirmExit
  return next
}

export class SettingsStore {
  private file: JsonFile<SettingsPatch>
  private current: Settings

  constructor(
    path: string,
    private onChange: (settings: Settings) => void
  ) {
    this.file = new JsonFile(path)
    this.current = applyPatch(DEFAULT_SETTINGS, this.file.read())
  }

  get(): Settings {
    return this.current
  }

  update(patch: SettingsPatch): Settings {
    this.current = applyPatch(this.current, patch)
    this.file.write(this.current)
    this.onChange(this.current)
    return this.current
  }
}
