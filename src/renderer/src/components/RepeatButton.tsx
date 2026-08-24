import { Repeat, Repeat1 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { RepeatMode } from '@shared/types'

interface RepeatButtonProps {
  mode: RepeatMode
  onCycle: () => void
  size?: 'sm' | 'md'
  className?: string
}

const LABELS: Record<RepeatMode, string> = {
  off: 'リピートなし',
  all: '全曲リピート',
  one: '1曲リピート'
}

export function RepeatButton({ mode, onCycle, size = 'md', className }: RepeatButtonProps) {
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const active = mode !== 'off'

  return (
    <button
      type="button"
      onClick={onCycle}
      title={LABELS[mode]}
      aria-label={LABELS[mode]}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg p-2 transition',
        active ? 'text-mf-accent' : 'text-mf-muted hover:text-mf-text',
        className
      )}
    >
      {mode === 'one' ? <Repeat1 className={iconClass} /> : <Repeat className={iconClass} />}
      {mode === 'all' ? (
        <span
          className={cn(
            'absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded px-1 font-bold tracking-wide text-mf-accent',
            size === 'sm' ? 'text-[8px]' : 'text-[9px]'
          )}
        >
          ALL
        </span>
      ) : null}
      {mode === 'one' ? (
        <span className="sr-only">1</span>
      ) : null}
    </button>
  )
}
