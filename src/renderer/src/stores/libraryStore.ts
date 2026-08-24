import { create } from 'zustand'
import type {
  Album,
  AppSettings,
  LibraryFolder,
  LibraryStats,
  Playlist,
  ScanProgress,
  Track
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'

interface LibraryState {
  ready: boolean
  tracks: Track[]
  albums: Album[]
  playlists: Playlist[]
  folders: LibraryFolder[]
  stats: LibraryStats | null
  recentlyPlayed: Track[]
  recentlyAdded: Track[]
  recentAlbums: Album[]
  settings: AppSettings
  scanProgress: ScanProgress
  welcomeOpen: boolean
  error: string | null
  init: () => Promise<void>
  refreshLibrary: () => Promise<void>
  refreshPlaylists: () => Promise<void>
  setSettings: (partial: Partial<AppSettings>) => Promise<void>
  addFolder: (path?: string) => Promise<void>
  removeFolder: (id: number) => Promise<void>
  scanLibrary: () => Promise<void>
  importFiles: (paths: string[]) => Promise<void>
  importBrowserFiles: (files: File[], options?: { albumTitle?: string }) => Promise<void>
  toggleFavorite: (trackId: number) => Promise<void>
  createPlaylist: (name: string, description?: string, coverPath?: string | null) => Promise<Playlist | null>
  updatePlaylist: (
    id: number,
    input: { name?: string; description?: string | null; coverPath?: string | null }
  ) => Promise<Playlist | null>
  deletePlaylist: (id: number) => Promise<boolean>
  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>
  removeTrackFromPlaylist: (playlistId: number, trackId: number) => Promise<void>
  setWelcomeOpen: (open: boolean) => void
}

const idleScan: ScanProgress = {
  phase: 'idle',
  current: 0,
  total: 0,
  message: ''
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  ready: false,
  tracks: [],
  albums: [],
  playlists: [],
  folders: [],
  stats: null,
  recentlyPlayed: [],
  recentlyAdded: [],
  recentAlbums: [],
  settings: DEFAULT_SETTINGS,
  scanProgress: idleScan,
  welcomeOpen: false,
  error: null,

  init: async () => {
    try {
      if (!window.musicFlow) {
        set({
          error: 'アプリの内部接続に失敗しました。MUSIC FLOWを再起動してください。',
          ready: true
        })
        return
      }
      const settings = await window.musicFlow.getSettings()
      window.musicFlow.onScanProgress((progress) => {
        set({ scanProgress: progress })
      })
      set({
        settings,
        welcomeOpen: settings.showWelcome,
        ready: false,
        error: null
      })
      await get().refreshLibrary()
      set({ ready: true })
    } catch (error) {
      console.error(error)
      set({
        error: 'ライブラリの初期化に失敗しました。アプリを再起動してください。',
        ready: true
      })
    }
  },

  refreshLibrary: async () => {
    try {
      const [tracks, albums, playlists, folders, stats, recentlyPlayed, recentlyAdded, recentAlbums] =
        await Promise.all([
          window.musicFlow.listTracks(),
          window.musicFlow.listAlbums({ sort: 'added' }),
          window.musicFlow.listPlaylists(),
          window.musicFlow.listFolders(),
          window.musicFlow.getStats(),
          window.musicFlow.getRecentlyPlayed(24),
          window.musicFlow.getRecentlyAdded(24),
          window.musicFlow.getRecentAlbums(12)
        ])
      set({
        tracks,
        albums,
        playlists,
        folders,
        stats,
        recentlyPlayed,
        recentlyAdded,
        recentAlbums,
        error: null
      })
    } catch (error) {
      console.error(error)
      set({ error: 'ライブラリの読み込みに失敗しました' })
    }
  },

  refreshPlaylists: async () => {
    const playlists = await window.musicFlow.listPlaylists()
    set({ playlists })
  },

  setSettings: async (partial) => {
    const settings = await window.musicFlow.updateSettings(partial)
    set({ settings, welcomeOpen: settings.showWelcome })
  },

  addFolder: async (path) => {
    const folderPath = path ?? (await window.musicFlow.selectMusicFolder())
    if (!folderPath) return
    set({
      scanProgress: {
        phase: 'scanning',
        current: 0,
        total: 0,
        message: '音楽フォルダを追加しています...'
      }
    })
    try {
      await window.musicFlow.addFolder(folderPath)
      await get().setSettings({ showWelcome: false })
      await get().refreshLibrary()
    } catch (error) {
      console.error(error)
      set({ error: 'フォルダの追加に失敗しました' })
    } finally {
      set({ scanProgress: idleScan })
    }
  },

  removeFolder: async (id) => {
    await window.musicFlow.removeFolder(id)
    await get().refreshLibrary()
  },

  scanLibrary: async () => {
    set({
      scanProgress: {
        phase: 'scanning',
        current: 0,
        total: 0,
        message: 'ライブラリをスキャンしています...'
      }
    })
    try {
      await window.musicFlow.scanLibrary()
      await get().refreshLibrary()
    } catch (error) {
      console.error(error)
      set({ error: 'スキャンに失敗しました' })
    } finally {
      setTimeout(() => set({ scanProgress: idleScan }), 1200)
    }
  },

  importFiles: async (paths) => {
    if (!paths.length) return
    set({
      scanProgress: {
        phase: 'parsing',
        current: 0,
        total: paths.length,
        message: 'MP3を追加しています...'
      }
    })
    try {
      await window.musicFlow.importFiles(paths)
      await get().setSettings({ showWelcome: false })
      await get().refreshLibrary()
    } catch (error) {
      console.error(error)
      set({ error: 'ファイルの追加に失敗しました' })
    } finally {
      setTimeout(() => set({ scanProgress: idleScan }), 1000)
    }
  },

  importBrowserFiles: async (files, options) => {
    if (!files.length) return
    set({
      scanProgress: {
        phase: 'parsing',
        current: 0,
        total: files.length,
        message: 'クラウドにアップロードしています...'
      },
      error: null
    })
    try {
      await window.musicFlow.importBrowserFiles(files, options)
      await get().setSettings({ showWelcome: false })
      await get().refreshLibrary()
    } catch (error) {
      console.error(error)
      set({
        error: error instanceof Error ? error.message : 'アップロードに失敗しました'
      })
    } finally {
      setTimeout(() => set({ scanProgress: idleScan }), 1000)
    }
  },

  toggleFavorite: async (trackId) => {
    const updated = await window.musicFlow.toggleFavorite(trackId)
    if (!updated) return
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? updated : t)),
      recentlyPlayed: state.recentlyPlayed.map((t) => (t.id === trackId ? updated : t)),
      recentlyAdded: state.recentlyAdded.map((t) => (t.id === trackId ? updated : t))
    }))
    await get().refreshPlaylists()
  },

  createPlaylist: async (name, description, coverPath) => {
    const playlist = await window.musicFlow.createPlaylist({
      name,
      description,
      coverPath
    })
    await get().refreshPlaylists()
    return playlist
  },

  updatePlaylist: async (id, input) => {
    const playlist = await window.musicFlow.updatePlaylist(id, input)
    await get().refreshPlaylists()
    return playlist
  },

  deletePlaylist: async (id) => {
    const ok = await window.musicFlow.deletePlaylist(id)
    if (ok) await get().refreshPlaylists()
    return Boolean(ok)
  },

  addTracksToPlaylist: async (playlistId, trackIds) => {
    await window.musicFlow.addToPlaylist(playlistId, trackIds)
    await get().refreshPlaylists()
  },

  removeTrackFromPlaylist: async (playlistId, trackId) => {
    await window.musicFlow.removeFromPlaylist(playlistId, trackId)
    await get().refreshPlaylists()
  },

  setWelcomeOpen: (open) => set({ welcomeOpen: open })
}))
