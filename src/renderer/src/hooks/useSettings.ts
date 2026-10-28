import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'

/** The saved settings, kept up to date as they change. `null` until loaded. */
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => {
    let active = true
    window.api.settings.get().then((s) => active && setSettings(s))
    const off = window.events.on('settings-changed', setSettings)
    return () => {
      active = false
      off()
    }
  }, [])
  return settings
}
