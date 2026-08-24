import { useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  GripVertical,
  Heart,
  LayoutTemplate,
  Mic2,
  Pause,
  Play,
  Scan,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Volume2
} from 'lucide-react'
import { CoverArt } from '@renderer/components/CoverArt'
import { RepeatButton } from '@renderer/components/RepeatButton'
import { SeekSlider } from '@renderer/components/SeekSlider'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { useUiStore, type PlayerLayoutStyle } from '@renderer/stores/uiStore'
import { cn, formatDuration } from '@renderer/lib/utils'
import type { Track } from '@shared/types'

const LAYOUTS: { id: PlayerLayoutStyle; label: string; hint: string }[] = [
  { id: 'classic', label: 'Classic', hint: 'ジャケット中心' },
  { id: 'studio', label: 'Studio', hint: 'ビジュアライザ' }
]

function SortableQueueItem({
  track,
  index,
  active,
  onPlay,
  dense = false
}: {
  track: Track
  index: number
  active: boolean
  onPlay: () => void
  dense?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: String(track.id) + '-' + index
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-xl px-2',
        dense ? 'py-1.5' : 'py-2',
        active ? 'bg-mf-accent-soft' : 'hover:bg-white/5'
      )}
    >
      <button type="button" className="cursor-grab text-mf-muted" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onPlay}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="w-5 text-xs text-mf-muted">{index + 1}</span>
        <CoverArt coverPath={track.coverPath} className="!h-10 !w-10" size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{track.title}</div>
          <div className="truncate text-xs text-mf-muted">{track.artistName}</div>
        </div>
        <span className="shrink-0 text-xs text-mf-muted">{formatDuration(track.duration)}</span>
      </button>
    </div>
  )
}

function TransportControls({
  shuffle,
  repeatMode,
  isPlaying,
  onShuffle,
  onPrev,
  onToggle,
  onNext,
  onRepeat,
  onFavorite,
  isFavorite,
  showFavorite = true
}: {
  shuffle: boolean
  repeatMode: 'off' | 'all' | 'one'
  isPlaying: boolean
  onShuffle: () => void
  onPrev: () => void
  onToggle: () => void
  onNext: () => void
  onRepeat: () => void
  onFavorite?: () => void
  isFavorite?: boolean
  showFavorite?: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-5" data-no-swipe>
      <button
        type="button"
        onClick={onShuffle}
        className={cn(
          'rounded-lg p-2 hover:bg-white/5',
          shuffle ? 'text-mf-accent' : 'text-mf-muted'
        )}
        title={shuffle ? 'シャッフルオン' : 'シャッフルオフ'}
        aria-pressed={shuffle}
      >
        <Shuffle className="h-5 w-5" />
      </button>
      <button type="button" onClick={onPrev} className="rounded-lg p-2 hover:bg-white/5">
        <SkipBack className="h-7 w-7" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-mf-accent text-white shadow-soft hover:bg-mf-accent-hover"
      >
        {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 pl-1" />}
      </button>
      <button type="button" onClick={onNext} className="rounded-lg p-2 hover:bg-white/5">
        <SkipForward className="h-7 w-7" />
      </button>
      <RepeatButton mode={repeatMode} onCycle={onRepeat} />
      {showFavorite && onFavorite ? (
        <button
          type="button"
          onClick={onFavorite}
          className="rounded-lg p-2 text-mf-muted hover:text-mf-accent"
        >
          <Heart className={cn('h-5 w-5', isFavorite && 'fill-mf-accent text-mf-accent')} />
        </button>
      ) : null}
    </div>
  )
}

function SeekBar({
  currentTime,
  duration,
  onSeek
}: {
  currentTime: number
  duration: number
  onSeek: (t: number) => void
}) {
  return <SeekSlider currentTime={currentTime} duration={duration} onSeek={onSeek} />
}

function QueuePanel({
  queue,
  queueIndex,
  title = 'Queue',
  subtitle,
  onPlayAt,
  onDragEnd,
  table = false
}: {
  queue: Track[]
  queueIndex: number
  title?: string
  subtitle?: string
  onPlayAt: (index: number) => void
  onDragEnd: (event: DragEndEvent) => void
  table?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  return (
    <div className="flex h-full min-h-0 flex-col" data-no-swipe>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-mf-muted">
            {subtitle ?? `${queue.length} 曲 · ドラッグで並び替え`}
          </p>
        </div>
      </div>
      <div className="glass min-h-0 flex-1 overflow-auto rounded-2xl p-3">
        {table ? (
          <div className="mb-2 grid grid-cols-[40px_minmax(0,1fr)_120px_56px] gap-2 px-2 text-[10px] uppercase tracking-[0.16em] text-mf-muted">
            <span>#</span>
            <span>Title</span>
            <span>Artist</span>
            <span className="text-right">Time</span>
          </div>
        ) : null}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={queue.map((t, i) => String(t.id) + '-' + i)}
            strategy={verticalListSortingStrategy}
          >
            {queue.map((track, index) =>
              table ? (
                <SortableQueueTableRow
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  active={index === queueIndex}
                  onPlay={() => onPlayAt(index)}
                />
              ) : (
                <SortableQueueItem
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  active={index === queueIndex}
                  onPlay={() => onPlayAt(index)}
                />
              )
            )}
          </SortableContext>
        </DndContext>
        {!queue.length ? (
          <div className="py-16 text-center text-sm text-mf-muted">キューは空です</div>
        ) : null}
      </div>
    </div>
  )
}

function SortableQueueTableRow({
  track,
  index,
  active,
  onPlay
}: {
  track: Track
  index: number
  active: boolean
  onPlay: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: String(track.id) + '-' + index
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[40px_minmax(0,1fr)_120px_56px] items-center gap-2 rounded-xl px-2 py-2',
        active ? 'bg-mf-accent-soft' : 'hover:bg-white/5'
      )}
    >
      <button type="button" className="cursor-grab text-mf-muted" {...attributes} {...listeners}>
        <span className="text-xs">{index + 1}</span>
      </button>
      <button type="button" onClick={onPlay} className="min-w-0 truncate text-left text-sm">
        {track.title}
      </button>
      <button type="button" onClick={onPlay} className="truncate text-left text-xs text-mf-muted">
        {track.artistName}
      </button>
      <span className="text-right text-xs text-mf-muted">{formatDuration(track.duration)}</span>
    </div>
  )
}

/** Style A: ジャケット中心 + 棒ビジュアライザ + 右キュー */
function ClassicPlayerLayout({
  track,
  bars,
  isPlaying,
  currentTime,
  duration,
  shuffle,
  repeatMode,
  queue,
  queueIndex,
  seek,
  togglePlay,
  next,
  previous,
  toggleShuffle,
  cycleRepeat,
  toggleFavoriteCurrent,
  playAtQueueIndex,
  onDragEnd
}: {
  track: Track
  bars: number[]
  isPlaying: boolean
  currentTime: number
  duration: number
  shuffle: boolean
  repeatMode: 'off' | 'all' | 'one'
  queue: Track[]
  queueIndex: number
  seek: (t: number) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleFavoriteCurrent: () => void
  playAtQueueIndex: (i: number) => void
  onDragEnd: (e: DragEndEvent) => void
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_320px]">
      <section className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
        <div className="flex items-center justify-center">
          <CoverArt coverPath={track.coverPath} size="hero" className="shadow-glass" />
        </div>
        <div className="flex min-w-0 flex-col justify-center">
          <div className="text-xs uppercase tracking-[0.2em] text-mf-muted">Now Playing</div>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight xl:text-5xl">
            {track.title}
          </h1>
          <p className="mt-3 text-xl text-mf-muted">{track.artistName}</p>
          <p className="mt-1 text-sm text-mf-muted">
            {track.albumTitle}
            {track.year ? ` · ${track.year}` : ''}
            {track.genre ? ` · ${track.genre}` : ''}
          </p>

          <div className="mt-10 flex h-24 items-end gap-1">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-gradient-to-t from-mf-accent/40 to-mf-accent"
                style={{ height: `${h}px`, opacity: isPlaying ? 1 : 0.45 }}
              />
            ))}
          </div>

          <div className="mt-6">
            <SeekBar
              currentTime={currentTime}
              duration={duration > 0 ? duration : track.duration || 0}
              onSeek={seek}
            />
          </div>
          <div className="mt-8">
            <TransportControls
              shuffle={shuffle}
              repeatMode={repeatMode}
              isPlaying={isPlaying}
              onShuffle={toggleShuffle}
              onPrev={() => void previous()}
              onToggle={() => void togglePlay()}
              onNext={() => void next()}
              onRepeat={cycleRepeat}
              onFavorite={() => void toggleFavoriteCurrent()}
              isFavorite={track.isFavorite}
            />
          </div>
        </div>
      </section>

      <QueuePanel
        queue={queue}
        queueIndex={queueIndex}
        onPlayAt={(i) => void playAtQueueIndex(i)}
        onDragEnd={onDragEnd}
      />
    </div>
  )
}

/** Style B: 情報カラム + 円形ビジュアライザ + 詳細キュー */
function StudioPlayerLayout({
  track,
  ringBars,
  isPlaying,
  currentTime,
  duration,
  volume,
  shuffle,
  repeatMode,
  queue,
  queueIndex,
  seek,
  setVolume,
  togglePlay,
  next,
  previous,
  toggleShuffle,
  cycleRepeat,
  playAtQueueIndex,
  onDragEnd
}: {
  track: Track
  ringBars: number[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeatMode: 'off' | 'all' | 'one'
  queue: Track[]
  queueIndex: number
  seek: (t: number) => void
  setVolume: (v: number) => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  playAtQueueIndex: (i: number) => void
  onDragEnd: (e: DragEndEvent) => void
}) {
  const bitrate = track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '—'
  const sampleRate = track.sampleRate ? `${(track.sampleRate / 1000).toFixed(1)} kHz` : '—'

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
      <aside className="glass flex min-h-0 flex-col gap-4 overflow-auto rounded-2xl p-4">
        <CoverArt coverPath={track.coverPath} size="lg" className="mx-auto !h-44 !w-44 shadow-glass" />
        <div>
          <h2 className="font-display text-xl font-semibold leading-snug">{track.title}</h2>
          <p className="mt-1 text-sm text-mf-muted">{track.artistName}</p>
          <p className="mt-1 text-xs text-mf-muted">
            {track.albumTitle}
            {track.year ? ` · ${track.year}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 text-mf-accent">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={cn('h-4 w-4', i < 4 ? 'fill-mf-accent' : 'text-mf-muted')} />
          ))}
        </div>
        <div className="mt-auto grid gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mf-muted"
          >
            <Mic2 className="h-4 w-4" />
            Lyrics
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mf-muted"
          >
            <Scan className="h-4 w-4" />
            Detailed Info
          </button>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col items-center justify-center gap-6 px-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-mf-elevated/60 p-1 text-xs">
          <span className="rounded-xl bg-mf-accent px-3 py-1.5 text-white">Now Playing</span>
          <span className="px-3 py-1.5 text-mf-muted">Lyrics</span>
        </div>

        <div className="relative flex h-[280px] w-[280px] items-center justify-center sm:h-[320px] sm:w-[320px]">
          <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full">
            {ringBars.map((level, i) => {
              const angle = (i / ringBars.length) * Math.PI * 2 - Math.PI / 2
              const inner = 108
              const outer = inner + 18 + level * 42
              const x1 = 160 + Math.cos(angle) * inner
              const y1 = 160 + Math.sin(angle) * inner
              const x2 = 160 + Math.cos(angle) * outer
              const y2 = 160 + Math.sin(angle) * outer
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="url(#mfRing)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity={isPlaying ? 0.95 : 0.45}
                />
              )
            })}
            <defs>
              <linearGradient id="mfRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative z-10 overflow-hidden rounded-full border border-white/10 shadow-glass">
            <CoverArt coverPath={track.coverPath} size="lg" className="!h-40 !w-40 !rounded-full" />
          </div>
        </div>

        <div className="text-center text-xs text-mf-muted">
          MP3 · {bitrate} · {sampleRate} · Stereo
        </div>

        <div className="w-full max-w-lg">
          <SeekBar
            currentTime={currentTime}
            duration={duration > 0 ? duration : track.duration || 0}
            onSeek={seek}
          />
        </div>

        <TransportControls
          shuffle={shuffle}
          repeatMode={repeatMode}
          isPlaying={isPlaying}
          onShuffle={toggleShuffle}
          onPrev={() => void previous()}
          onToggle={() => void togglePlay()}
          onNext={() => void next()}
          onRepeat={cycleRepeat}
          showFavorite={false}
        />

        <div className="flex items-center gap-3 text-mf-muted" data-no-swipe>
          <Volume2 className="h-4 w-4" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="knob-range w-36"
          />
          <Sparkles className="h-4 w-4" />
        </div>
      </section>

      <QueuePanel
        queue={queue}
        queueIndex={queueIndex}
        title="Play Queue"
        subtitle="Current Queue"
        table
        onPlayAt={(i) => void playAtQueueIndex(i)}
        onDragEnd={onDragEnd}
      />
    </div>
  )
}

export function PlayerPage({ embedded = false }: { embedded?: boolean }) {
  const layout = useUiStore((s) => s.playerLayout)
  const setPlayerLayout = useUiStore((s) => s.setPlayerLayout)
  const cyclePlayerLayout = useUiStore((s) => s.cyclePlayerLayout)
  const closePlayer = useUiStore((s) => s.closePlayer)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,
    queue,
    queueIndex,
    analyserData,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    toggleFavoriteCurrent,
    reorderQueue,
    playAtQueueIndex
  } = usePlayerStore()

  const bars = useMemo(() => {
    const count = 40
    const data = analyserData
    if (!data.length) return Array.from({ length: count }, () => 8)
    const step = Math.floor(data.length / count)
    return Array.from({ length: count }, (_, i) => {
      const v = data[i * step] ?? 0
      return Math.max(6, (v / 255) * 88)
    })
  }, [analyserData])

  const ringBars = useMemo(() => {
    const count = 64
    const data = analyserData
    if (!data.length) return Array.from({ length: count }, () => 0.15)
    const step = Math.max(1, Math.floor(data.length / count))
    return Array.from({ length: count }, (_, i) => {
      const v = data[i * step] ?? 0
      return Math.max(0.08, v / 255)
    })
  }, [analyserData])

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = queue.map((t, i) => String(t.id) + '-' + i)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    reorderQueue(oldIndex, newIndex)
  }

  const onSwipeStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-swipe]')) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }

  const onSwipeEnd = (e: React.PointerEvent) => {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy)) return
    cyclePlayerLayout()
  }

  if (!currentTrack) {
    return (
      <div className={cn('flex h-full flex-col', !embedded && 'page-enter')}>
        <PlayerChrome
          layout={layout}
          onLayoutChange={setPlayerLayout}
          onMinimize={closePlayer}
          showMinimize={embedded}
        />
        <div className="flex flex-1 items-center justify-center text-mf-muted">
          再生する曲を選択してください
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', !embedded && 'page-enter')}>
      <PlayerChrome
        layout={layout}
        onLayoutChange={setPlayerLayout}
        onMinimize={closePlayer}
        showMinimize={embedded}
      />

      <div
        className="relative min-h-0 flex-1 overflow-hidden px-2 lg:px-4"
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
      >
        {layout === 'classic' ? (
          <ClassicPlayerLayout
            track={currentTrack}
            bars={bars}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            shuffle={shuffle}
            repeatMode={repeatMode}
            queue={queue}
            queueIndex={queueIndex}
            seek={seek}
            togglePlay={togglePlay}
            next={next}
            previous={previous}
            toggleShuffle={toggleShuffle}
            cycleRepeat={cycleRepeat}
            toggleFavoriteCurrent={toggleFavoriteCurrent}
            playAtQueueIndex={playAtQueueIndex}
            onDragEnd={onDragEnd}
          />
        ) : (
          <StudioPlayerLayout
            track={currentTrack}
            ringBars={ringBars}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            shuffle={shuffle}
            repeatMode={repeatMode}
            queue={queue}
            queueIndex={queueIndex}
            seek={seek}
            setVolume={setVolume}
            togglePlay={togglePlay}
            next={next}
            previous={previous}
            toggleShuffle={toggleShuffle}
            cycleRepeat={cycleRepeat}
            playAtQueueIndex={playAtQueueIndex}
            onDragEnd={onDragEnd}
          />
        )}
      </div>
    </div>
  )
}

function PlayerChrome({
  layout,
  onLayoutChange,
  onMinimize,
  showMinimize
}: {
  layout: PlayerLayoutStyle
  onLayoutChange: (layout: PlayerLayoutStyle) => void
  onMinimize: () => void
  showMinimize: boolean
}) {
  return (
    <div className="mb-4 flex shrink-0 items-center justify-between gap-3 px-2">
      {showMinimize ? (
        <button
          type="button"
          onClick={onMinimize}
          className="rounded-xl p-2 text-mf-muted transition hover:bg-white/5 hover:text-mf-text"
          title="ミニプレイヤーに戻る"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      ) : (
        <div className="flex w-28 items-center gap-2 text-xs text-mf-muted">
          <LayoutTemplate className="h-4 w-4" />
          Layout
        </div>
      )}

      <div className="relative grid grid-cols-2 rounded-2xl border border-white/10 bg-mf-elevated/70 p-1">
        <div
          className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-mf-accent shadow-soft transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transform: layout === 'classic' ? 'translateX(4px)' : 'translateX(calc(100% + 4px))'
          }}
          aria-hidden
        />
        {LAYOUTS.map((item) => {
          const active = layout === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onLayoutChange(item.id)}
              className={cn(
                'relative z-10 inline-flex flex-col items-center justify-center rounded-xl px-5 py-2 transition-colors',
                active ? 'text-white' : 'text-mf-muted hover:text-mf-text'
              )}
            >
              <span className="text-sm font-semibold">{item.label}</span>
              <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-mf-muted')}>
                {item.hint}
              </span>
            </button>
          )
        })}
      </div>

      <div className="w-28 text-right text-[10px] text-mf-muted">左右スワイプでも切替</div>
    </div>
  )
}
