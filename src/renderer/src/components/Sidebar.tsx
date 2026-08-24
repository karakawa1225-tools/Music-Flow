import { NavLink } from 'react-router-dom'
import {
  Disc3,
  Folder,
  Heart,
  History,
  Home,
  ListMusic,
  Settings,
  SlidersHorizontal,
  AudioLines
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useUiStore } from '@renderer/stores/uiStore'

const beforePlayer = [
  { to: '/', label: 'HOME', icon: Home },
  { to: '/playlists', label: 'プレイリスト', icon: ListMusic },
  { to: '/albums', label: 'アルバム', icon: Disc3 }
]

const afterPlayer = [
  { to: '/eq', label: 'EQ', icon: SlidersHorizontal },
  { to: '/settings', label: '設定', icon: Settings }
]

const shortcuts = [
  { to: '/playlists?filter=favorites', label: 'お気に入り', icon: Heart },
  { to: '/playlists?filter=recent', label: '最近再生した曲', icon: History },
  { to: '/settings?tab=library', label: 'ローカルファイル', icon: Folder }
]

export function Sidebar() {
  const playerExpanded = useUiStore((s) => s.playerExpanded)
  const togglePlayer = useUiStore((s) => s.togglePlayer)
  const closePlayer = useUiStore((s) => s.closePlayer)

  return (
    <aside className="no-drag glass flex w-[220px] shrink-0 flex-col border-r border-white/5 px-3 py-4">
      <div className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-mf-accent/20 text-mf-accent">
          <AudioLines className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold tracking-wide">MUSIC FLOW</div>
          <div className="text-[10px] text-mf-muted">Your Flow</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {beforePlayer.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => closePlayer()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-mf-muted transition-colors',
                isActive && !playerExpanded
                  ? 'bg-mf-accent text-white shadow-soft'
                  : 'hover:bg-white/5 hover:text-mf-text'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={togglePlayer}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
            playerExpanded
              ? 'bg-mf-accent text-white shadow-soft'
              : 'text-mf-muted hover:bg-white/5 hover:text-mf-text'
          )}
        >
          <AudioLines className="h-4 w-4" />
          <span>プレイヤー</span>
        </button>

        {afterPlayer.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => closePlayer()}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-mf-muted transition-colors',
                isActive && !playerExpanded
                  ? 'bg-mf-accent text-white shadow-soft'
                  : 'hover:bg-white/5 hover:text-mf-text'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/5 pt-4">
        <div className="mb-2 px-3 text-[11px] uppercase tracking-wider text-mf-muted">Library</div>
        <div className="flex flex-col gap-1">
          {shortcuts.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => closePlayer()}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-mf-muted transition-colors hover:bg-white/5 hover:text-mf-text"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  )
}
