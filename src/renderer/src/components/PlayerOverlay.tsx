import { useEffect, useState } from 'react'
import { PlayerPage } from '@renderer/pages/PlayerPage'
import { useUiStore } from '@renderer/stores/uiStore'
import { cn } from '@renderer/lib/utils'

const SLIDE_MS = 360

export function PlayerOverlay() {
  const playerExpanded = useUiStore((s) => s.playerExpanded)
  const closePlayer = useUiStore((s) => s.closePlayer)
  const setPlayerAnimating = useUiStore((s) => s.setPlayerAnimating)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let openTimer: number | undefined
    let closeTimer: number | undefined

    if (playerExpanded) {
      setMounted(true)
      setPlayerAnimating(true)
      openTimer = window.setTimeout(() => {
        setVisible(true)
        setPlayerAnimating(false)
      }, 16)
    } else if (mounted) {
      setVisible(false)
      setPlayerAnimating(true)
      closeTimer = window.setTimeout(() => {
        setMounted(false)
        setPlayerAnimating(false)
      }, SLIDE_MS)
    }

    return () => {
      if (openTimer) window.clearTimeout(openTimer)
      if (closeTimer) window.clearTimeout(closeTimer)
    }
  }, [playerExpanded, mounted, setPlayerAnimating])

  useEffect(() => {
    if (!playerExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlayer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playerExpanded, closePlayer])

  if (!mounted) return null

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex flex-col bg-[radial-gradient(ellipse_at_top,_rgba(124,77,255,0.12),_transparent_42%),linear-gradient(180deg,#0D0D12_0%,#12121C_100%)] will-change-transform transition-transform duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="min-h-0 flex-1 overflow-hidden px-6 pb-4 pt-2">
        <PlayerPage embedded />
      </div>
    </div>
  )
}
