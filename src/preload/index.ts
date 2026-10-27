import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { API_METHODS, EVENT_CHANNEL_PREFIX, type Api, type Events } from '../shared/api'

// Build `window.api`: each method invokes the main-process handler on channel `<namespace>.<method>`.
const api = Object.fromEntries(
  Object.entries(API_METHODS).map(([namespace, methods]) => [namespace, Object.fromEntries(Object.keys(methods).map((method) => [method, (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(`${namespace}.${method}`, ...args)]))])
) as unknown as Api

const events: Events = {
  on(name, listener) {
    const channel = EVENT_CHANNEL_PREFIX + name
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown): void => listener(payload as Parameters<typeof listener>[0])
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('events', events)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.events = events
}
