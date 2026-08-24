import { useEffect, useMemo, useState } from 'react'
import { Bell, Search, User, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { SearchResults } from '@shared/types'
import { CoverArt } from './CoverArt'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { formatDuration } from '@renderer/lib/utils'

export function TopBar({
  title,
  subtitle,
  actions
}: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const playTracks = usePlayerStore((s) => s.playTracks)

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    const timer = setTimeout(() => {
      void window.musicFlow.search(query).then((res) => {
        setResults(res)
        setOpen(true)
      })
    }, 180)
    return () => clearTimeout(timer)
  }, [query])

  const hasResults = useMemo(() => {
    if (!results) return false
    return (
      results.tracks.length +
        results.albums.length +
        results.playlists.length +
        results.artists.length >
      0
    )
  }, [results])

  return (
    <header className="relative z-20 flex items-start justify-between gap-4 pb-6">
      <div className="min-w-0">
        {title ? <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1> : null}
        {subtitle ? <p className="mt-1 text-sm text-mf-muted">{subtitle}</p> : null}
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mf-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="曲、アーティスト、アルバム、プレイリストを検索"
            className="w-full rounded-xl border border-white/5 bg-mf-elevated/80 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-mf-accent/40"
          />
          {query ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mf-muted"
              onClick={() => {
                setQuery('')
                setResults(null)
                setOpen(false)
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {open && query && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[420px] w-[420px] overflow-auto rounded-2xl border border-white/10 bg-mf-surface/95 p-3 shadow-glass backdrop-blur-xl">
              {!hasResults ? (
                <div className="px-2 py-6 text-center text-sm text-mf-muted">結果がありません</div>
              ) : (
                <div className="space-y-4">
                  {results!.tracks.length > 0 && (
                    <section>
                      <div className="mb-2 px-2 text-xs text-mf-muted">曲</div>
                      {results!.tracks.slice(0, 6).map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                          onClick={() => {
                            void playTracks([track], 0)
                            setOpen(false)
                          }}
                        >
                          <CoverArt coverPath={track.coverPath} size="sm" className="!h-10 !w-10" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{track.title}</div>
                            <div className="truncate text-xs text-mf-muted">{track.artistName}</div>
                          </div>
                          <span className="text-xs text-mf-muted">{formatDuration(track.duration)}</span>
                        </button>
                      ))}
                    </section>
                  )}
                  {results!.albums.length > 0 && (
                    <section>
                      <div className="mb-2 px-2 text-xs text-mf-muted">アルバム</div>
                      {results!.albums.slice(0, 4).map((album) => (
                        <button
                          key={album.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                          onClick={() => {
                            navigate(`/albums/${album.id}`)
                            setOpen(false)
                          }}
                        >
                          <CoverArt coverPath={album.coverPath} size="sm" className="!h-10 !w-10" />
                          <div className="min-w-0">
                            <div className="truncate text-sm">{album.title}</div>
                            <div className="truncate text-xs text-mf-muted">{album.artistName}</div>
                          </div>
                        </button>
                      ))}
                    </section>
                  )}
                  {results!.playlists.length > 0 && (
                    <section>
                      <div className="mb-2 px-2 text-xs text-mf-muted">プレイリスト</div>
                      {results!.playlists.slice(0, 4).map((playlist) => (
                        <button
                          key={playlist.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                          onClick={() => {
                            navigate(`/playlists/${playlist.id}`)
                            setOpen(false)
                          }}
                        >
                          <CoverArt coverPath={playlist.coverPath} size="sm" className="!h-10 !w-10" />
                          <div className="truncate text-sm">{playlist.name}</div>
                        </button>
                      ))}
                    </section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {actions}
        <button type="button" className="rounded-xl bg-mf-elevated p-2.5 text-mf-muted hover:text-mf-text">
          <Bell className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-xl bg-mf-elevated p-2.5 text-mf-muted hover:text-mf-text">
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
