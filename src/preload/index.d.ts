import type { MusicFlowApi } from '../shared/musicFlowApi'

declare global {
  interface Window {
    musicFlow: MusicFlowApi
  }
}

export {}
