import { useEffect, useRef } from 'react'
import type { AppEvents } from '../../../shared/api'

/** Calls `listener` whenever the main process sends the event. */
export function useAppEvent<K extends keyof AppEvents>(name: K, listener: (payload: AppEvents[K]) => void): void {
  const latest = useRef(listener)
  useEffect(() => {
    latest.current = listener
  })
  useEffect(() => window.events.on(name, (payload) => latest.current(payload)), [name])
}
