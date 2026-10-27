import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { API_METHODS, type Api } from '../shared/api'

// Build `window.api`: each method invokes the main-process handler on channel `<namespace>.<method>`.
const api = Object.fromEntries(
  Object.entries(API_METHODS).map(([namespace, methods]) => [namespace, Object.fromEntries(Object.keys(methods).map((method) => [method, (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(`${namespace}.${method}`, ...args)]))])
) as unknown as Api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
