import { DEFAULT_SETTINGS, type AppSettings, type PlaybackSnapshot, type ScanProgress } from '@shared/types'
import type { MusicFlowApi } from '@shared/musicFlowApi'
import type { Track } from '@shared/types'
import { apiFetch, getApiBase, getToken, setToken } from './apiClient'

function idleScan(message = ''): ScanProgress {
  return { phase: 'idle', current: 0, total: 0, message }
}

function pickAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    const done = (value: number) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0)
    audio.onerror = () => done(0)
    audio.src = url
  })
}

export function createWebMusicFlowApi(): MusicFlowApi {
  const scanListeners = new Set<(progress: ScanProgress) => void>()
  const emitScan = (progress: ScanProgress) => {
    for (const listener of scanListeners) listener(progress)
  }

  const api: MusicFlowApi = {
    getAppPaths: async () => ({ web: true, backend: 'turso' }),
    selectMusicFolder: async () => null,
    selectCoverImage: async () => null,
    openPath: async () => undefined,

    selectMp3Files: async () => {
      const files = await pickFiles({ accept: 'audio/mpeg,audio/mp3,.mp3', multiple: true })
      if (files.length) await api.importBrowserFiles(files)
      return []
    },

    listFolders: async () => [],
    addFolder: async () => {
      throw new Error('Web版ではフォルダ追加はできません。MP3をアップロードしてください。')
    },
    removeFolder: async () => undefined,
    scanLibrary: async () => undefined,
    importFiles: async () => {
      throw new Error('Web版では importBrowserFiles を使ってください')
    },

    importBrowserFiles: async (files) => {
      const mp3s = files.filter((f) => /\.mp3$/i.test(f.name) || f.type === 'audio/mpeg')
      if (!mp3s.length) return

      emitScan({ phase: 'scanning', current: 0, total: mp3s.length, message: 'アップロード準備中...' })
      for (let i = 0; i < mp3s.length; i++) {
        const file = mp3s[i]
        emitScan({
          phase: 'parsing',
          current: i + 1,
          total: mp3s.length,
          message: `${file.name} をアップロード中...`
        })
        const duration = await pickAudioDuration(file)
        const form = new FormData()
        form.append('file', file)
        form.append('duration', String(duration))
        await apiFetch('/api/upload', { method: 'POST', body: form })
      }
      emitScan({ phase: 'done', current: mp3s.length, total: mp3s.length, message: 'アップロード完了' })
      setTimeout(() => emitScan(idleScan()), 800)
    },

    getStats: async () => apiFetch('/api/stats'),
    onScanProgress: (callback) => {
      scanListeners.add(callback)
      return () => scanListeners.delete(callback)
    },

    listTracks: async (limit = 5000, offset = 0) =>
      apiFetch(`/api/tracks?limit=${limit}&offset=${offset}`),
    getTrack: async (id) => apiFetch(`/api/tracks/${id}`),
    getRecentlyPlayed: async (limit = 24) =>
      apiFetch(`/api/tracks/recent/played?limit=${limit}`),
    getRecentlyAdded: async (limit = 24) =>
      apiFetch(`/api/tracks/recent/added?limit=${limit}`),
    toggleFavorite: async (trackId) =>
      apiFetch(`/api/tracks/${trackId}/favorite`, { method: 'POST' }),
    recordPlay: async (trackId, position = 0) =>
      apiFetch(`/api/tracks/${trackId}/play`, {
        method: 'POST',
        body: JSON.stringify({ position })
      }),
    savePosition: async (trackId, position) =>
      apiFetch(`/api/tracks/${trackId}/position`, {
        method: 'POST',
        body: JSON.stringify({ position })
      }),

    resolveTrackUrl: async (trackId) => {
      try {
        const track = await apiFetch<Track>(`/api/tracks/${trackId}`)
        const token = getToken()
        const base = getApiBase()
        const url = `${base}/api/tracks/${trackId}/stream${token ? `?access_token=${encodeURIComponent(token)}` : ''}`
        return { ok: true, url, track }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : '再生できません',
          track: null
        }
      }
    },

    checkTrackExists: async (trackId) => {
      try {
        await apiFetch(`/api/tracks/${trackId}`)
        return true
      } catch {
        return false
      }
    },

    listAlbums: async () => apiFetch('/api/albums'),
    getAlbum: async (id) => apiFetch(`/api/albums/${id}`),
    getAlbumTracks: async (id) => apiFetch(`/api/albums/${id}/tracks`),
    getRecentAlbums: async (limit = 12) => apiFetch(`/api/albums/recent/list?limit=${limit}`),

    listPlaylists: async () => apiFetch('/api/playlists'),
    getPlaylist: async (id) => apiFetch(`/api/playlists/${id}`),
    getPlaylistTracks: async (id) => apiFetch(`/api/playlists/${id}/tracks`),
    createPlaylist: async (input) =>
      apiFetch('/api/playlists', { method: 'POST', body: JSON.stringify(input) }),
    updatePlaylist: async (id, input) =>
      apiFetch(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    deletePlaylist: async (id) => {
      await apiFetch(`/api/playlists/${id}`, { method: 'DELETE' })
      return true
    },
    addToPlaylist: async (playlistId, trackIds) =>
      apiFetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ trackIds })
      }),
    removeFromPlaylist: async (playlistId, trackId) =>
      apiFetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),
    reorderPlaylist: async (playlistId, trackIds) =>
      apiFetch(`/api/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ trackIds })
      }),

    search: async (query) => apiFetch(`/api/search?q=${encodeURIComponent(query)}`),
    getSettings: async () => apiFetch<AppSettings>('/api/settings'),
    updateSettings: async (partial) =>
      apiFetch<AppSettings>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(partial)
      }),
    getPlaybackSnapshot: async () => apiFetch<PlaybackSnapshot | null>('/api/playback-snapshot'),
    savePlaybackSnapshot: async (snapshot) =>
      apiFetch('/api/playback-snapshot', {
        method: 'PUT',
        body: JSON.stringify(snapshot)
      }),
    getCoverUrl: async (coverPath) => coverPath,

    getPathForFile: () => '',

    signOut: async () => {
      setToken(null)
      window.location.reload()
    },

    getAuthEmail: async () => {
      try {
        const me = await apiFetch<{ user: { email: string } }>('/api/auth/me')
        return me.user.email
      } catch {
        return null
      }
    }
  }

  void DEFAULT_SETTINGS
  return api
}

function pickFiles(options: { accept: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = options.accept
    input.multiple = Boolean(options.multiple)
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.click()
  })
}
