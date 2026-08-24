import { create } from 'zustand'

export type PlayerInnerView = 'now' | 'queue'
/** classic = ジャケット重視 / studio = 円形ビジュアライザ重視 */
export type PlayerLayoutStyle = 'classic' | 'studio'

interface UiState {
  playerExpanded: boolean
  playerAnimating: boolean
  playerView: PlayerInnerView
  playerLayout: PlayerLayoutStyle
  openPlayer: (view?: PlayerInnerView) => void
  closePlayer: () => void
  togglePlayer: () => void
  setPlayerView: (view: PlayerInnerView) => void
  setPlayerLayout: (layout: PlayerLayoutStyle) => void
  cyclePlayerLayout: () => void
  setPlayerAnimating: (v: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  playerExpanded: false,
  playerAnimating: false,
  playerView: 'now',
  playerLayout: 'classic',
  openPlayer: (view = 'now') => set({ playerExpanded: true, playerView: view }),
  closePlayer: () => set({ playerExpanded: false }),
  togglePlayer: () => {
    const expanded = get().playerExpanded
    set({ playerExpanded: !expanded })
  },
  setPlayerView: (view) => set({ playerView: view }),
  setPlayerLayout: (layout) => set({ playerLayout: layout }),
  cyclePlayerLayout: () =>
    set({ playerLayout: get().playerLayout === 'classic' ? 'studio' : 'classic' }),
  setPlayerAnimating: (v) => set({ playerAnimating: v })
}))
