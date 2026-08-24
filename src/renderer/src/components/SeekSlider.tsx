import { useEffect, useRef, useState } from 'react'
import { cn, formatDuration } from '@renderer/lib/utils'

/** Seek control that won't fight playback RAF while dragging. */
export function SeekSlider({
  currentTime,
  duration,
  onSeek,
  className,
  showTimes = true,
  compact = false
}: {
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  className?: string
  showTimes?: boolean
  compact?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [draft, setDraft] = useState(0)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)

  const max = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeCurrent = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0
  const display = dragging ? draft : Math.min(safeCurrent, max || safeCurrent)

  useEffect(() => {
    if (!draggingRef.current) setDraft(safeCurrent)
  }, [safeCurrent])

  const commit = (value: number) => {
    const next = Math.max(0, max > 0 ? Math.min(value, max) : value)
    setDraft(next)
    onSeek(next)
  }

  const releaseCapture = (el: HTMLInputElement) => {
    const id = pointerIdRef.current
    pointerIdRef.current = null
    if (id == null) return
    try {
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id)
    } catch {
      /* ignore */
    }
  }

  const endDrag = (el: HTMLInputElement) => {
    if (!draggingRef.current) return
    commit(Number(el.value))
    draggingRef.current = false
    setDragging(false)
    releaseCapture(el)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-mf-muted',
        compact ? 'text-[11px]' : 'text-xs gap-3',
        className
      )}
      data-no-swipe
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showTimes ? (
        <span className={cn('tabular-nums', compact ? 'w-10 text-right' : 'w-12')}>
          {formatDuration(display)}
        </span>
      ) : null}
      <input
        type="range"
        min={0}
        max={max > 0 ? max : 1}
        step={0.05}
        disabled={max <= 0}
        value={max > 0 ? Math.min(display, max) : 0}
        onPointerDown={(e) => {
          e.stopPropagation()
          const el = e.currentTarget
          draggingRef.current = true
          pointerIdRef.current = e.pointerId
          setDragging(true)
          setDraft(Number(el.value))
          try {
            el.setPointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          endDrag(e.currentTarget)
        }}
        onPointerCancel={(e) => {
          draggingRef.current = false
          setDragging(false)
          setDraft(safeCurrent)
          releaseCapture(e.currentTarget)
        }}
        onChange={(e) => {
          const v = Number(e.target.value)
          setDraft(v)
          if (draggingRef.current) return
          commit(v)
        }}
        onInput={(e) => {
          const v = Number((e.target as HTMLInputElement).value)
          setDraft(v)
        }}
        className={cn('knob-range seek-range flex-1', compact ? 'h-1' : 'h-1.5')}
        aria-label="再生位置"
      />
      {showTimes ? (
        <span className={cn('tabular-nums', compact ? 'w-10' : 'w-12 text-right')}>
          {formatDuration(max)}
        </span>
      ) : null}
    </div>
  )
}
