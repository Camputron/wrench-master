import { ElectronAPI } from '@electron-toolkit/preload'
import type { Api, Events } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
    events: Events
  }
}
