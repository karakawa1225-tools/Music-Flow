import { useMemo, useState } from 'react'
import { Check, ListPlus, Search } from 'lucide-react'
import type { Playlist, Track } from '@shared/types'
import { CoverArt } from '@renderer/components/CoverArt'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { cn } from '@renderer/lib/utils'

/** Pick one or more user playlists and add the given tracks. */
export function AddToPlaylistModal({
  trackIds,
  onClose,
  onAdded
}: {
  trackIds: number[]
  onClose: () => void
  onAdded?: () => void
}) {
  const playlists = useLibraryStore((s) => s.playlists)
  const addTracksToPlaylist = useLibraryStore((s) => s.addTracksToPlaylist)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [doneIds, setDoneIds] = useState<number[]>([])

  const userPlaylists = useMemo(() => {
    const q = query.trim().toLowerCase()
    return playlists
      .filter((p) => !p.isSystem)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [playlists, query])

  const addTo = async (playlist: Playlist) => {
    if (busyId != null) return
    setBusyId(playlist.id)
    try {
      await addTracksToPlaylist(playlist.id, trackIds)
      setDoneIds((ids) => [...ids, playlist.id])
      onAdded?.()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-mf-surface p-5 shadow-glass">
        <div className="flex items-center gap-2">
          <ListPlus className="h-5 w-5 text-mf-accent" />
          <h3 className="font-display text-xl font-semibold">プレイリストに追加</h3>
        </div>
        <p className="mt-1 text-xs text-mf-muted">
          {trackIds.length === 1 ? '1曲を追加するプレイリストを選んでください' : `${trackIds.length}曲を追加するプレイリストを選んでください`}
        </p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mf-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="プレイリストを検索"
            className="w-full rounded-xl border border-white/10 bg-mf-elevated py-2.5 pl-9 pr-3 text-sm outline-none"
            autoFocus
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto">
          {userPlaylists.map((playlist) => {
            const done = doneIds.includes(playlist.id)
            return (
              <button
                key={playlist.id}
                type="button"
                disabled={busyId != null}
                onClick={() => void addTo(playlist)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-white/5 disabled:opacity-60',
                  done && 'bg-mf-accent/10'
                )}
              >
                <CoverArt coverPath={playlist.coverPath} className="!h-11 !w-11" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{playlist.name}</div>
                  <div className="text-xs text-mf-muted">{playlist.trackCount ?? 0} 曲</div>
                </div>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-xs text-mf-accent">
                    <Check className="h-3.5 w-3.5" />
                    追加済み
                  </span>
                ) : busyId === playlist.id ? (
                  <span className="text-xs text-mf-muted">追加中…</span>
                ) : null}
              </button>
            )
          })}
          {!userPlaylists.length ? (
            <div className="py-10 text-center text-sm text-mf-muted">
              追加先のプレイリストがありません。
              <br />
              先にプレイリストを作成してください。
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-mf-muted hover:bg-white/5"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

/** Modal to pick library tracks and add them into a fixed playlist. */
export function AddTracksToPlaylistModal({
  playlistId,
  existingTrackIds,
  onClose,
  onChanged
}: {
  playlistId: number
  existingTrackIds: number[]
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const allTracks = useLibraryStore((s) => s.tracks)
  const addTracksToPlaylist = useLibraryStore((s) => s.addTracksToPlaylist)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const candidates = useMemo(() => {
    const existing = new Set(existingTrackIds)
    const q = query.trim().toLowerCase()
    return allTracks
      .filter((t) => !existing.has(t.id))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.artistName ?? '').toLowerCase().includes(q) ||
          (t.albumTitle ?? '').toLowerCase().includes(q)
      )
      .slice(0, 120)
  }, [allTracks, existingTrackIds, query])

  const toggle = (track: Track) => {
    setSelected((ids) =>
      ids.includes(track.id) ? ids.filter((id) => id !== track.id) : [...ids, track.id]
    )
  }

  const submit = async () => {
    if (!selected.length) return
    setBusy(true)
    try {
      await addTracksToPlaylist(playlistId, selected)
      setSelected([])
      await onChanged()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-3xl border border-white/10 bg-mf-surface p-5 shadow-glass">
        <h3 className="font-display text-xl font-semibold">曲を追加</h3>
        <p className="mt-1 text-xs text-mf-muted">追加したい曲にチェックを入れて「追加する」を押してください</p>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mf-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲・アーティスト・アルバムを検索"
            className="w-full rounded-xl border border-white/10 bg-mf-elevated py-2.5 pl-9 pr-3 text-sm outline-none"
            autoFocus
          />
        </div>

        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-auto">
          {candidates.map((track) => {
            const checked = selected.includes(track.id)
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => toggle(track)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5',
                  checked && 'bg-mf-accent/10'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-mf-accent bg-mf-accent text-white' : 'border-white/20'
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <CoverArt coverPath={track.coverPath} className="!h-10 !w-10" size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm">{track.title}</div>
                  <div className="truncate text-xs text-mf-muted">{track.artistName}</div>
                </div>
              </button>
            )
          })}
          {!candidates.length ? (
            <div className="py-8 text-center text-sm text-mf-muted">追加できる曲がありません</div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-mf-muted">{selected.length} 曲選択中</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-mf-muted hover:bg-white/5"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={busy || !selected.length}
              onClick={() => void submit()}
              className="rounded-xl bg-mf-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? '追加中…' : '追加する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
