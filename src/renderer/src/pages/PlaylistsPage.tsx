import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ListPlus, MoreHorizontal, Pencil, Plus, Shuffle, Play, Trash2 } from 'lucide-react'
import type { Playlist, Track } from '@shared/types'
import { TopBar } from '@renderer/components/TopBar'
import { CoverArt } from '@renderer/components/CoverArt'
import { TrackTable } from '@renderer/components/Shared'
import { AddTracksToPlaylistModal } from '@renderer/components/AddToPlaylistModal'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { cn, formatDurationLong } from '@renderer/lib/utils'

export function PlaylistsPage() {
  const { id } = useParams()
  if (id) return <PlaylistDetailPage playlistId={Number(id)} />
  return <PlaylistListPage />
}

type EditorMode = 'create' | 'edit'

function PlaylistEditorModal({
  mode,
  initial,
  onClose,
  onSubmit
}: {
  mode: EditorMode
  initial?: { name: string; description: string; coverPath: string | null }
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    coverPath: string | null
  }) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [coverPath, setCoverPath] = useState<string | null>(initial?.coverPath ?? null)
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-mf-surface p-6 shadow-glass">
        <h3 className="font-display text-xl font-semibold">
          {mode === 'create' ? '新しいプレイリスト' : 'プレイリストを編集'}
        </h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-4">
            <CoverArt coverPath={coverPath} className="!h-20 !w-20" size="md" />
            <button
              type="button"
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-mf-muted hover:bg-white/5"
              onClick={async () => {
                const selected = await window.musicFlow.selectCoverImage()
                if (selected) setCoverPath(selected)
              }}
            >
              {coverPath ? 'カバーを変更' : 'カバー画像を選択'}
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="プレイリスト名"
            className="w-full rounded-xl border border-white/10 bg-mf-elevated px-3 py-2.5 text-sm outline-none"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="説明"
            className="min-h-[80px] w-full rounded-xl border border-white/10 bg-mf-elevated px-3 py-2.5 text-sm outline-none"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-mf-muted hover:bg-white/5"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSubmit({
                  name: name.trim() || 'Untitled Playlist',
                  description,
                  coverPath
                })
              } finally {
                setSaving(false)
              }
            }}
            className="rounded-xl bg-mf-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mode === 'create' ? '作成' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlaylistListPage() {
  const playlists = useLibraryStore((s) => s.playlists)
  const createPlaylist = useLibraryStore((s) => s.createPlaylist)
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist)
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Playlist | null>(null)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Playlist | null>(null)

  const filter = searchParams.get('filter')

  const filtered = useMemo(() => {
    let list = playlists
    if (filter === 'favorites') list = list.filter((p) => p.systemKey === 'favorites')
    if (filter === 'recent') list = list.filter((p) => p.systemKey === 'recent')
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [playlists, filter, query])

  const categories = [
    { key: 'all', label: `All Playlists (${playlists.length})` },
    {
      key: 'favorites',
      label: `Favorites (${playlists.find((p) => p.systemKey === 'favorites')?.trackCount ?? 0})`
    },
    { key: 'user', label: 'Recently Added' }
  ]

  const [category, setCategory] = useState('all')

  const visible = useMemo(() => {
    if (category === 'favorites') return playlists.filter((p) => p.systemKey === 'favorites')
    if (category === 'user') return playlists.filter((p) => !p.isSystem)
    return filtered
  }, [category, filtered, playlists])

  useEffect(() => {
    const close = () => setMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  return (
    <div className="page-enter">
      <TopBar
        title="Playlists"
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-mf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            新しいプレイリスト
          </button>
        }
      />

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="プレイリストを検索"
          className="w-full max-w-sm rounded-xl border border-white/5 bg-mf-elevated/80 px-4 py-2.5 text-sm outline-none focus:border-mf-accent/40"
        />
      </div>

      <div className="flex gap-6">
        <aside className="w-56 shrink-0 space-y-1">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                'w-full rounded-xl px-3 py-2.5 text-left text-sm',
                category === c.key
                  ? 'bg-mf-accent-soft text-mf-text'
                  : 'text-mf-muted hover:bg-white/5'
              )}
            >
              {c.label}
            </button>
          ))}
        </aside>

        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex aspect-square flex-col items-center justify-center rounded-mf border border-dashed border-white/15 bg-mf-elevated/40 text-mf-muted transition hover:border-mf-accent hover:text-mf-text"
          >
            <Plus className="mb-2 h-8 w-8" />
            <span className="text-sm">新規作成</span>
          </button>
          {visible.map((playlist) => (
            <div key={playlist.id} className="group relative text-left">
              <button
                type="button"
                onClick={() => navigate(`/playlists/${playlist.id}`)}
                className="w-full text-left"
              >
                <CoverArt
                  coverPath={playlist.coverPath}
                  className="!aspect-square !h-auto !w-full"
                />
                <div className="mt-3 truncate pr-8 text-sm font-semibold">{playlist.name}</div>
                <div className="text-xs text-mf-muted">{playlist.trackCount ?? 0} 曲</div>
              </button>

              {!playlist.isSystem ? (
                <div className="absolute right-1 top-1">
                  <button
                    type="button"
                    className="rounded-lg bg-black/50 p-1.5 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuId(menuId === playlist.id ? null : playlist.id)
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuId === playlist.id ? (
                    <div
                      className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-mf-surface shadow-glass"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-white/5"
                        onClick={() => {
                          setMenuId(null)
                          setEditing(playlist)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        編集
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-mf-danger hover:bg-white/5"
                        onClick={() => {
                          setMenuId(null)
                          setDeleting(playlist)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        削除
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {creating ? (
        <PlaylistEditorModal
          mode="create"
          onClose={() => setCreating(false)}
          onSubmit={async (data) => {
            const playlist = await createPlaylist(data.name, data.description, data.coverPath)
            setCreating(false)
            if (playlist) navigate(`/playlists/${playlist.id}`)
          }}
        />
      ) : null}

      {editing ? (
        <PlaylistEditorModal
          mode="edit"
          initial={{
            name: editing.name,
            description: editing.description ?? '',
            coverPath: editing.coverPath
          }}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await updatePlaylist(editing.id, data)
            setEditing(null)
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteModal
          name={deleting.name}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deletePlaylist(deleting.id)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ConfirmDeleteModal({
  name,
  onClose,
  onConfirm
}: {
  name: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-mf-surface p-6 shadow-glass">
        <h3 className="font-display text-xl font-semibold">プレイリストを削除</h3>
        <p className="mt-3 text-sm text-mf-muted">
          「{name}」を削除しますか？この操作は取り消せません。音楽ファイル自体は削除されません。
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-mf-muted hover:bg-white/5"
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
            className="rounded-xl bg-mf-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  )
}

function PlaylistDetailPage({ playlistId }: { playlistId: number }) {
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const playTracks = usePlayerStore((s) => s.playTracks)
  const removeTrackFromPlaylist = useLibraryStore((s) => s.removeTrackFromPlaylist)
  const updatePlaylist = useLibraryStore((s) => s.updatePlaylist)
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist)

  const load = async () => {
    const [p, t] = await Promise.all([
      window.musicFlow.getPlaylist(playlistId),
      window.musicFlow.getPlaylistTracks(playlistId)
    ])
    setPlaylist(p)
    setTracks(t)
  }

  useEffect(() => {
    void load()
  }, [playlistId])

  if (!playlist) {
    return <div className="text-mf-muted">読み込み中...</div>
  }

  const canEditTracks = !playlist.isSystem

  return (
    <div className="page-enter">
      <div className="mb-4 text-sm text-mf-muted">
        <Link to="/playlists" className="hover:text-mf-text">
          Playlists
        </Link>
        <span className="mx-2">/</span>
        <span>{playlist.name}</span>
      </div>

      <div className="mb-8 flex flex-wrap items-end gap-6">
        <CoverArt coverPath={playlist.coverPath} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-mf-muted">Playlist</div>
          <h1 className="mt-1 font-display text-4xl font-semibold">{playlist.name}</h1>
          {playlist.description ? <p className="mt-2 text-mf-muted">{playlist.description}</p> : null}
          <p className="mt-2 text-sm text-mf-muted">
            {tracks.length} 曲 · {formatDurationLong(playlist.totalDuration)}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!tracks.length}
              onClick={() => void playTracks(tracks, 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              再生
            </button>
            <button
              type="button"
              disabled={!tracks.length}
              onClick={() => {
                const shuffled = [...tracks].sort(() => Math.random() - 0.5)
                void playTracks(shuffled, 0)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              <Shuffle className="h-4 w-4" />
              シャッフル
            </button>
            {canEditTracks ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5"
                  onClick={() => setPickerOpen(true)}
                >
                  <ListPlus className="h-4 w-4" />
                  曲を追加
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-mf-muted hover:bg-white/5"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                  編集
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-mf-danger hover:bg-white/5"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  削除
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {canEditTracks && !tracks.length ? (
        <div className="mb-6 rounded-2xl border border-dashed border-white/15 bg-mf-surface/30 px-6 py-10 text-center">
          <p className="text-sm text-mf-muted">まだ曲がありません</p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ListPlus className="h-4 w-4" />
            曲を追加する
          </button>
        </div>
      ) : null}

      <TrackTable
        tracks={tracks}
        enableAddToPlaylist={!canEditTracks}
        onRemove={
          canEditTracks
            ? async (track) => {
                const ok = window.confirm(`「${track.title}」をこのプレイリストから削除しますか？`)
                if (!ok) return
                await removeTrackFromPlaylist(playlist.id, track.id)
                await load()
              }
            : undefined
        }
      />

      {pickerOpen ? (
        <AddTracksToPlaylistModal
          playlistId={playlist.id}
          existingTrackIds={tracks.map((t) => t.id)}
          onClose={() => setPickerOpen(false)}
          onChanged={load}
        />
      ) : null}

      {editing ? (
        <PlaylistEditorModal
          mode="edit"
          initial={{
            name: playlist.name,
            description: playlist.description ?? '',
            coverPath: playlist.coverPath
          }}
          onClose={() => setEditing(false)}
          onSubmit={async (data) => {
            const updated = await updatePlaylist(playlist.id, data)
            setEditing(false)
            if (updated) setPlaylist(updated)
            else await load()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteModal
          name={playlist.name}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            const ok = await deletePlaylist(playlist.id)
            if (ok) navigate('/playlists')
          }}
        />
      ) : null}
    </div>
  )
}
