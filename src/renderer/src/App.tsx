import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { MiniPlayer } from './components/MiniPlayer'
import { PlayerOverlay } from './components/PlayerOverlay'
import {
  DropZoneOverlay,
  ScanOverlay,
  WelcomeModal,
  useGlobalDrop
} from './components/Shared'
import { HomePage } from './pages/HomePage'
import { PlaylistsPage } from './pages/PlaylistsPage'
import { AlbumsPage } from './pages/AlbumsPage'
import { EqPage } from './pages/EqPage'
import { SettingsPage } from './pages/SettingsPage'
import { useLibraryStore } from './stores/libraryStore'
import { usePlayerStore } from './stores/playerStore'
import { useUiStore } from './stores/uiStore'
import { cn } from './lib/utils'

export default function App() {
  const init = useLibraryStore((s) => s.init)
  const ready = useLibraryStore((s) => s.ready)
  const setSettings = useLibraryStore((s) => s.setSettings)
  const initPlayer = usePlayerStore((s) => s.initPlayer)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const toggleFavoriteCurrent = usePlayerStore((s) => s.toggleFavoriteCurrent)
  const openPlayer = useUiStore((s) => s.openPlayer)
  const closePlayer = useUiStore((s) => s.closePlayer)
  const togglePlayer = useUiStore((s) => s.togglePlayer)
  const location = useLocation()
  const navigate = useNavigate()
  const dropping = useGlobalDrop()

  useEffect(() => {
    void (async () => {
      await init()
      await initPlayer()
    })()
  }, [init, initPlayer])

  useEffect(() => {
    void setSettings({ lastRoute: location.pathname })
  }, [location.pathname, setSettings])

  // Legacy /player route → open slide player
  useEffect(() => {
    if (location.pathname.startsWith('/player')) {
      openPlayer()
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate, openPlayer])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (e.code === 'Space' && !typing) {
        e.preventDefault()
        void togglePlay()
      }
      if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault()
        void next()
      }
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        void previous()
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        closePlayer()
        navigate('/playlists')
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        closePlayer()
        navigate('/eq')
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        void toggleFavoriteCurrent()
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('header input')
        input?.focus()
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        togglePlayer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    closePlayer,
    navigate,
    next,
    previous,
    toggleFavoriteCurrent,
    togglePlay,
    togglePlayer
  ])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-mf-bg">
        <div className="text-center">
          <div className="font-display text-2xl font-semibold">MUSIC FLOW</div>
          <div className="mt-2 text-sm text-mf-muted">ライブラリを準備しています...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(ellipse_at_top,_rgba(124,77,255,0.08),_transparent_45%),linear-gradient(180deg,#0D0D12_0%,#101018_100%)]">
      <div
        className={cn(
          'flex h-9 shrink-0 items-center px-4 text-xs text-mf-muted',
          import.meta.env.VITE_APP_TARGET === 'web' ? '' : 'drag-region'
        )}
      >
        <span className="font-display tracking-wide">
          MUSIC FLOW{import.meta.env.VITE_APP_TARGET === 'web' ? ' Web' : ''}
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <main className="no-drag min-h-0 flex-1 overflow-auto px-8 py-6">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlists/:id" element={<PlaylistsPage />} />
              <Route path="/albums" element={<AlbumsPage />} />
              <Route path="/albums/:id" element={<AlbumsPage />} />
              <Route path="/eq" element={<EqPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/player" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <MiniPlayer />
          <PlayerOverlay />
        </div>
      </div>

      <ScanOverlay />
      <WelcomeModal />
      <DropZoneOverlay active={dropping} />
    </div>
  )
}
