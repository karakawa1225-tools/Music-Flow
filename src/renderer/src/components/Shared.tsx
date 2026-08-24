import { useEffect, useState } from 'react'
import type { Track } from '@shared/types'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { formatDuration, cn } from '@renderer/lib/utils'
import { CoverArt } from './CoverArt'
import { Heart, ListPlus, Play, Trash2 } from 'lucide-react'
import { AddToPlaylistModal } from './AddToPlaylistModal'

export function TrackTable({
  tracks,
  onPlay,
  showAlbum = true,
  onRemove,
  enableAddToPlaylist = true
}: {
  tracks: Track[]
  onPlay?: (track: Track, index: number) => void
  showAlbum?: boolean
  onRemove?: (track: Track) => void
  enableAddToPlaylist?: boolean
}) {
  const playTracks = usePlayerStore((s) => s.playTracks)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)
  const [addTrackIds, setAddTrackIds] = useState<number[] | null>(null)

  const actionCols = 1 + (enableAddToPlaylist ? 1 : 0) + (onRemove ? 1 : 0)
  const gridTemplate = showAlbum
    ? `48px 1.4fr 1fr 1fr 80px${' 40px'.repeat(actionCols)}`
    : `48px 2fr 1fr 80px${' 40px'.repeat(actionCols)}`

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-mf-surface/40">
        <div
          className="grid gap-3 border-b border-white/5 px-4 py-3 text-xs uppercase tracking-wider text-mf-muted"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <span>#</span>
          <span>タイトル</span>
          <span>アーティスト</span>
          {showAlbum ? <span>アルバム</span> : null}
          <span>時間</span>
          <span />
          {enableAddToPlaylist ? <span /> : null}
          {onRemove ? <span /> : null}
        </div>
        <div className="max-h-[52vh] overflow-auto">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => (onPlay ? onPlay(track, index) : void playTracks(tracks, index))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (onPlay) onPlay(track, index)
                  else void playTracks(tracks, index)
                }
              }}
              className={cn(
                'grid w-full cursor-pointer items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 text-left text-sm transition hover:bg-white/[0.04]',
                currentTrack?.id === track.id && 'bg-mf-accent-soft'
              )}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <span className="text-mf-muted">{track.trackNumber ?? index + 1}</span>
              <span className="flex min-w-0 items-center gap-3">
                <CoverArt coverPath={track.coverPath} className="!h-10 !w-10" size="sm" />
                <span className="min-w-0">
                  <span className="truncate font-medium">{track.title}</span>
                </span>
              </span>
              <span className="truncate text-mf-muted">{track.artistName}</span>
              {showAlbum ? <span className="truncate text-mf-muted">{track.albumTitle}</span> : null}
              <span className="text-mf-muted">{formatDuration(track.duration)}</span>
              <button
                type="button"
                title="お気に入り"
                onClick={(e) => {
                  e.stopPropagation()
                  void toggleFavorite(track.id)
                }}
                className="inline-flex justify-center text-mf-muted hover:text-mf-accent"
              >
                <Heart className={cn('h-4 w-4', track.isFavorite && 'fill-mf-accent text-mf-accent')} />
              </button>
              {enableAddToPlaylist ? (
                <button
                  type="button"
                  title="プレイリストに追加"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddTrackIds([track.id])
                  }}
                  className="inline-flex justify-center text-mf-muted hover:text-mf-accent"
                >
                  <ListPlus className="h-4 w-4" />
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  title="プレイリストから削除"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(track)
                  }}
                  className="inline-flex justify-center text-mf-muted hover:text-mf-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          {!tracks.length ? (
            <div className="px-4 py-10 text-center text-sm text-mf-muted">曲がありません</div>
          ) : null}
        </div>
      </div>
      {addTrackIds ? (
        <AddToPlaylistModal trackIds={addTrackIds} onClose={() => setAddTrackIds(null)} />
      ) : null}
    </>
  )
}

export function MediaCard({
  title,
  subtitle,
  meta,
  coverPath,
  onClick,
  onPlay
}: {
  title: string
  subtitle?: string
  meta?: string
  coverPath?: string | null
  onClick?: () => void
  onPlay?: () => void
}) {
  return (
    <div className="group w-[180px]">
      <div className="relative">
        <button type="button" onClick={onClick} className="block w-full text-left">
          <CoverArt coverPath={coverPath} size="lg" className="!h-[180px] !w-[180px]" />
        </button>
        {onPlay ? (
          <button
            type="button"
            onClick={onPlay}
            className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-mf-accent text-white opacity-0 shadow-soft transition group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Play className="h-4 w-4 pl-0.5" />
          </button>
        ) : null}
      </div>
      <button type="button" onClick={onClick} className="mt-3 block w-full text-left">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle ? <div className="truncate text-xs text-mf-muted">{subtitle}</div> : null}
        {meta ? <div className="truncate text-xs text-mf-muted">{meta}</div> : null}
      </button>
    </div>
  )
}

export function ScanOverlay() {
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  if (scanProgress.phase === 'idle' || scanProgress.phase === 'done') return null

  return (
    <div className="pointer-events-none fixed bottom-28 right-6 z-50 rounded-2xl border border-white/10 bg-mf-surface/95 px-4 py-3 shadow-glass backdrop-blur-xl">
      <div className="text-sm font-medium">{scanProgress.message || '処理中...'}</div>
      <div className="mt-1 text-xs text-mf-muted">
        {scanProgress.total > 0
          ? `${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()}`
          : '準備中...'}
      </div>
      <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-mf-accent transition-all"
          style={{
            width:
              scanProgress.total > 0
                ? `${Math.min(100, (scanProgress.current / scanProgress.total) * 100)}%`
                : '20%'
          }}
        />
      </div>
    </div>
  )
}

export function WelcomeModal() {
  const welcomeOpen = useLibraryStore((s) => s.welcomeOpen)
  const setWelcomeOpen = useLibraryStore((s) => s.setWelcomeOpen)
  const addFolder = useLibraryStore((s) => s.addFolder)
  const setSettings = useLibraryStore((s) => s.setSettings)

  if (!welcomeOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-mf-surface p-8 shadow-glass">
        <div className="font-display text-3xl font-semibold">MUSIC FLOWへようこそ</div>
        <p className="mt-3 text-mf-muted">
          音楽フォルダを追加して
          <br />
          あなたの音楽ライブラリを作りましょう。
        </p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => void addFolder()}
            className="rounded-xl bg-mf-accent px-5 py-3 text-sm font-semibold text-white hover:bg-mf-accent-hover"
          >
            音楽フォルダを追加
          </button>
          <button
            type="button"
            onClick={() => {
              setWelcomeOpen(false)
              void setSettings({ showWelcome: false })
            }}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm text-mf-muted hover:bg-white/5"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  )
}

export function DropZoneOverlay({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center bg-mf-accent/10 backdrop-blur-[2px]">
      <div className="rounded-3xl border border-dashed border-mf-accent bg-mf-surface/90 px-10 py-8 text-center shadow-glass">
        <div className="font-display text-2xl font-semibold">音楽を追加</div>
        <p className="mt-2 text-sm text-mf-muted">MP3ファイルまたは音楽フォルダをドロップ</p>
      </div>
    </div>
  )
}

export function useGlobalDrop() {
  const importFiles = useLibraryStore((s) => s.importFiles)
  const importBrowserFiles = useLibraryStore((s) => s.importBrowserFiles)
  const addFolder = useLibraryStore((s) => s.addFolder)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      setActive(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setActive(false)
    }
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setActive(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!files.length) return

      if (import.meta.env.VITE_APP_TARGET === 'web') {
        await importBrowserFiles(files)
        return
      }

      const paths = files.map((file) => window.musicFlow.getPathForFile(file)).filter(Boolean)
      const mp3s = paths.filter((p) => p.toLowerCase().endsWith('.mp3'))
      const maybeFolders = paths.filter((p) => !p.toLowerCase().endsWith('.mp3'))

      if (mp3s.length) await importFiles(mp3s)
      for (const folder of maybeFolders) {
        await addFolder(folder)
      }
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFolder, importBrowserFiles, importFiles])

  return active
}
