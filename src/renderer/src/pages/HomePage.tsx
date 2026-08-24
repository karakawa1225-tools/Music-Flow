import { useNavigate } from 'react-router-dom'
import { Disc3, FolderPlus, Upload } from 'lucide-react'
import { TopBar } from '@renderer/components/TopBar'
import { MediaCard, TrackTable } from '@renderer/components/Shared'
import { useLibraryStore } from '@renderer/stores/libraryStore'
import { usePlayerStore } from '@renderer/stores/playerStore'
import { formatDuration } from '@renderer/lib/utils'
import { isWebRuntime } from '@shared/platform'

async function refreshAfterUpload() {
  await useLibraryStore.getState().refreshLibrary()
}

function HomeUploadActions({
  web,
  onAddFolder
}: {
  web: boolean
  onAddFolder: () => void
}) {
  const scanProgress = useLibraryStore((s) => s.scanProgress)
  const busy = scanProgress.phase !== 'idle'

  if (web) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void window.musicFlow.selectMp3Files().then(() => refreshAfterUpload())}
            className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-mf-accent-hover disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            MP3をアップロード
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void window.musicFlow.selectAlbumFolder().then(() => refreshAfterUpload())
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-mf-text hover:bg-white/10 disabled:opacity-60"
          >
            <Disc3 className="h-4 w-4" />
            アルバムをアップロード
          </button>
        </div>
        {busy ? (
          <p className="text-xs text-mf-muted">
            {scanProgress.message}
            {scanProgress.total > 0
              ? ` (${scanProgress.current.toLocaleString()} / ${scanProgress.total.toLocaleString()})`
              : ''}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onAddFolder}
      className="inline-flex items-center gap-2 rounded-xl bg-mf-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-mf-accent-hover"
    >
      <FolderPlus className="h-4 w-4" />
      音楽フォルダを追加
    </button>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const {
    tracks,
    recentlyPlayed,
    recentAlbums,
    playlists,
    addFolder,
    stats,
    error
  } = useLibraryStore()
  const playTracks = usePlayerStore((s) => s.playTracks)
  const web = isWebRuntime()

  if (!tracks.length) {
    return (
      <div className="page-enter flex h-full flex-col">
        <TopBar />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h2 className="font-display text-3xl font-semibold">音楽ライブラリを始めましょう</h2>
          <p className="mt-3 max-w-md text-mf-muted">
            {web
              ? 'MP3ファイル、またはアルバムフォルダをアップロードするとストリーミング再生できます。'
              : 'MP3ファイルまたは音楽フォルダを追加してください。'}
          </p>
          {error ? <p className="mt-3 text-sm text-mf-danger">{error}</p> : null}
          <div className="mt-8">
            <HomeUploadActions web={web} onAddFolder={() => void addFolder()} />
          </div>
        </div>
      </div>
    )
  }

  const userPlaylists = playlists.filter((p) => !p.isSystem)

  return (
    <div className="page-enter">
      <TopBar />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-display text-3xl font-semibold">こんにちは！</div>
          <div className="mt-1 text-mf-muted">あなたの音楽ライブラリ</div>
          {stats ? (
            <div className="mt-3 text-xs text-mf-muted">
              {stats.trackCount.toLocaleString()} 曲 · {stats.albumCount.toLocaleString()} アルバム ·{' '}
              {stats.artistCount.toLocaleString()} アーティスト
            </div>
          ) : null}
          {error ? <p className="mt-2 text-sm text-mf-danger">{error}</p> : null}
        </div>
        <HomeUploadActions web={web} onAddFolder={() => void addFolder()} />
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">最近再生した曲</h2>
        </div>
        {recentlyPlayed.length ? (
          <div className="horizontal-scroll">
            {recentlyPlayed.map((track, index) => (
              <MediaCard
                key={track.id}
                title={track.title}
                subtitle={track.artistName}
                meta={formatDuration(track.duration)}
                coverPath={track.coverPath}
                onClick={() => void playTracks(recentlyPlayed, index)}
                onPlay={() => void playTracks(recentlyPlayed, index)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-mf-muted">まだ再生履歴がありません。下の曲一覧から再生できます。</p>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">すべての曲</h2>
          <span className="text-xs text-mf-muted">{tracks.length.toLocaleString()} 曲</span>
        </div>
        <TrackTable tracks={tracks.slice(0, 200)} />
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">おすすめプレイリスト</h2>
          <button
            type="button"
            className="text-sm text-mf-muted hover:text-mf-text"
            onClick={() => navigate('/playlists')}
          >
            すべて表示
          </button>
        </div>
        {userPlaylists.length || playlists.length ? (
          <div className="horizontal-scroll">
            {(userPlaylists.length ? userPlaylists : playlists).slice(0, 12).map((playlist) => (
              <MediaCard
                key={playlist.id}
                title={playlist.name}
                subtitle={`${playlist.trackCount ?? 0} 曲`}
                coverPath={playlist.coverPath}
                onClick={() => navigate(`/playlists/${playlist.id}`)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-mf-muted">プレイリストを作成してみましょう</p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">最近追加したアルバム</h2>
          <button
            type="button"
            className="text-sm text-mf-muted hover:text-mf-text"
            onClick={() => navigate('/albums')}
          >
            すべて表示
          </button>
        </div>
        <div className="horizontal-scroll">
          {recentAlbums.map((album) => (
            <MediaCard
              key={album.id}
              title={album.title}
              subtitle={album.artistName}
              meta={album.year ? String(album.year) : undefined}
              coverPath={album.coverPath}
              onClick={() => navigate(`/albums/${album.id}`)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
