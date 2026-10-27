import { useEffect, useRef } from 'react'
import type { AppEvents } from '../../../shared/api'

/** Calls `listener` whenever the main process sends the event. */
export function useAppEvent<K extends keyof AppEvents>(name: K, listener: (payload: AppEvents[K]) => void): void {
  const listenerRef = useRef(listener)
  useEffect(() => {
    listenerRef.current = listener
  })
  useEffect(() => window.events.on(name, (payload) => listenerRef.current(payload)), [name])
}
