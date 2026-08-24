import {
  Heart,
  ListOrdered,
  Maximize2,
  Pause,
  Play,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2
} from 'lucide-react'
import { CoverArt } from './CoverArt'
import { RepeatButton } from './RepeatButton'
import { SeekSlider } from './SeekSlider'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { cn } from '@renderer/lib/utils'

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleFavoriteCurrent
  } = usePlayerStore()
  const openPlayer = useUiStore((s) => s.openPlayer)

  if (!currentTrack) {
    return (
      <footer className="no-drag glass flex h-[88px] items-center justify-center border-t border-white/5 px-6 text-sm text-mf-muted">
        再生中の曲はありません
      </footer>
    )
  }

  const seekMax =
    duration > 0 ? duration : Number.isFinite(currentTrack.duration) ? currentTrack.duration : 0

  return (
    <footer className="no-drag glass grid h-[88px] grid-cols-[1fr_1.4fr_1fr] items-center gap-4 border-t border-white/5 px-5">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={() => openPlayer()}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-white/[0.03]"
          title="プレイヤー画面を開く"
        >
          <CoverArt coverPath={currentTrack.coverPath} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{currentTrack.title}</div>
            <div className="truncate text-xs text-mf-muted">{currentTrack.artistName}</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => void toggleFavoriteCurrent()}
          className="shrink-0 rounded-lg p-2 text-mf-muted transition hover:bg-white/5 hover:text-mf-accent"
        >
          <Heart
            className={cn('h-4 w-4', currentTrack.isFavorite && 'fill-mf-accent text-mf-accent')}
          />
        </button>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggleShuffle()}
            className={cn(
              'rounded-lg p-1.5 hover:bg-white/5',
              shuffle ? 'text-mf-accent' : 'text-mf-muted hover:text-mf-text'
            )}
            title={shuffle ? 'シャッフルオン' : 'シャッフルオフ'}
            aria-pressed={shuffle}
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void previous()}
            className="rounded-lg p-1.5 hover:bg-white/5"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void togglePlay()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-mf-accent text-white transition hover:bg-mf-accent-hover"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 pl-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => void next()}
            className="rounded-lg p-1.5 hover:bg-white/5"
          >
            <SkipForward className="h-5 w-5" />
          </button>
          <RepeatButton mode={repeatMode} onCycle={cycleRepeat} size="sm" className="!p-1.5" />
        </div>
        <SeekSlider
          currentTime={currentTime}
          duration={seekMax}
          onSeek={seek}
          compact
          className="w-full max-w-md"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-mf-muted" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="knob-range w-24"
          />
        </div>
        <button
          type="button"
          onClick={() => openPlayer('queue')}
          className="rounded-lg p-2 text-mf-muted hover:bg-white/5 hover:text-mf-text"
          title="キューを表示"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => openPlayer('now')}
          className="rounded-lg p-2 text-mf-muted transition hover:bg-white/5 hover:text-mf-accent"
          title="プレイヤー画面"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </footer>
  )
}
