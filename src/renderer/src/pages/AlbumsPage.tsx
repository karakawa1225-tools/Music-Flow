import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, LayoutGrid, List, Play, Shuffle } from 'lucide-react'
import type { Album, Track } from '@shared/types'
import { TopBar } from '@renderer/components/TopBar'
import { CoverArt } from '@renderer/components/CoverArt'
import { TrackTable } from '@renderer/components/Shared'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { cn, formatDurationLong } from '@renderer/lib/utils'

const FILTERS = ['すべて', 'J-POP', 'ROCK', 'JAZZ', 'CLASSICAL', 'その他'] as const
type SortKey = 'added' | 'title' | 'artist' | 'year'

export function AlbumsPage() {
  const { id } = useParams()
  if (id) return <AlbumDetailPage albumId={Number(id)} />
  return <AlbumListPage />
}

function AlbumListPage() {
  const navigate = useNavigate()
  const [genre, setGenre] = useState<string>('すべて')
  const [sort, setSort] = useState<SortKey>('added')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [albums, setAlbums] = useState<Album[]>([])

  useEffect(() => {
    void window.musicFlow
      .listAlbums({
        genre,
        sort,
        query
      })
      .then(setAlbums)
  }, [genre, sort, query])

  return (
    <div className="page-enter">
      <TopBar title="Albums" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setGenre(f)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-sm',
                genre === f ? 'bg-mf-accent text-white' : 'bg-mf-elevated text-mf-muted hover:text-mf-text'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="アルバムを検索"
            className="w-56 rounded-xl border border-white/5 bg-mf-elevated/80 px-3 py-2 text-sm outline-none focus:border-mf-accent/40"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-white/5 bg-mf-elevated px-3 py-2 text-sm outline-none"
          >
            <option value="added">追加日</option>
            <option value="title">アルバム名</option>
            <option value="artist">アーティスト</option>
            <option value="year">発売年</option>
          </select>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={cn('rounded-lg p-2', view === 'grid' ? 'bg-mf-accent/20 text-mf-accent' : 'text-mf-muted')}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn('rounded-lg p-2', view === 'list' ? 'bg-mf-accent/20 text-mf-accent' : 'text-mf-muted')}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              className="text-left"
              onClick={() => navigate(`/albums/${album.id}`)}
            >
              <CoverArt coverPath={album.coverPath} className="!aspect-square !h-auto !w-full" />
              <div className="mt-3 truncate text-sm font-semibold">{album.title}</div>
              <div className="truncate text-xs text-mf-muted">{album.artistName}</div>
              <div className="text-xs text-mf-muted">
                {album.year ? `${album.year} · ` : ''}
                {album.trackCount ?? 0} tracks
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {albums.map((album) => (
            <button
              key={album.id}
              type="button"
              onClick={() => navigate(`/albums/${album.id}`)}
              className="flex w-full items-center gap-4 rounded-xl px-3 py-2 text-left hover:bg-white/5"
            >
              <CoverArt coverPath={album.coverPath} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{album.title}</div>
                <div className="truncate text-sm text-mf-muted">{album.artistName}</div>
              </div>
              <div className="text-sm text-mf-muted">{album.year ?? '—'}</div>
              <div className="w-20 text-right text-sm text-mf-muted">{album.trackCount ?? 0} 曲</div>
            </button>
          ))}
        </div>
      )}

      {!albums.length ? (
        <div className="py-16 text-center text-mf-muted">アルバムがありません</div>
      ) : null}
    </div>
  )
}

function AlbumDetailPage({ albumId }: { albumId: number }) {
  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const playTracks = usePlayerStore((s) => s.playTracks)
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite)

  useEffect(() => {
    void Promise.all([
      window.musicFlow.getAlbum(albumId),
      window.musicFlow.getAlbumTracks(albumId)
    ]).then(([a, t]) => {
      setAlbum(a)
      setTracks(t)
    })
  }, [albumId])

  const anyFavorite = useMemo(() => tracks.some((t) => t.isFavorite), [tracks])

  if (!album) return <div className="text-mf-muted">読み込み中...</div>

  return (
    <div className="page-enter">
      <div className="mb-4 text-sm text-mf-muted">
        <Link to="/albums" className="hover:text-mf-text">
          Albums
        </Link>
        <span className="mx-2">/</span>
        <span>{album.title}</span>
      </div>

      <div className="mb-8 flex flex-wrap items-end gap-6">
        <CoverArt coverPath={album.coverPath} size="xl" />
        <div>
          <div className="text-xs uppercase tracking-wider text-mf-muted">Album</div>
          <h1 className="mt-1 font-display text-4xl font-semibold">{album.title}</h1>
          <p className="mt-2 text-lg text-mf-muted">{album.artistName}</p>
          <p className="mt-2 text-sm text-mf-muted">
            {album.year ? `${album.year} · ` : ''}
            {album.trackCount ?? tracks.length} 曲 · {formatDurationLong(album.totalDuration)}
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void playTracks(tracks, 0)}
              className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Play className="h-4 w-4" />
              再生
            </button>
            <button
              type="button"
              onClick={() => {
                const shuffled = [...tracks].sort(() => Math.random() - 0.5)
                void playTracks(shuffled, 0)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
            >
              <Shuffle className="h-4 w-4" />
              シャッフル
            </button>
            <button
              type="button"
              onClick={() => {
                if (tracks[0]) void toggleFavorite(tracks[0].id)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm"
            >
              <Heart className={cn('h-4 w-4', anyFavorite && 'fill-mf-accent text-mf-accent')} />
              お気に入り
            </button>
          </div>
        </div>
      </div>

      <TrackTable tracks={tracks} showAlbum={false} />
    </div>
  )
}
