import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron'
import { IPC } from '../shared/constants'
import type { MusicFlowApi } from '../shared/musicFlowApi'
import type {
  AppSettings,
  CreatePlaylistInput,
  PlaybackSnapshot,
  ScanProgress,
  UpdatePlaylistInput
} from '../shared/types'

const api: MusicFlowApi = {
  getAppPaths: () => ipcRenderer.invoke(IPC.GET_APP_PATHS),
  selectMusicFolder: () => ipcRenderer.invoke(IPC.SELECT_MUSIC_FOLDER) as Promise<string | null>,
  selectCoverImage: () => ipcRenderer.invoke(IPC.SELECT_COVER_IMAGE) as Promise<string | null>,
  selectMp3Files: () => ipcRenderer.invoke(IPC.SELECT_MP3_FILES) as Promise<string[]>,
  selectAlbumFolder: async () => {
    const folder = await ipcRenderer.invoke(IPC.SELECT_MUSIC_FOLDER) as string | null
    if (folder) await ipcRenderer.invoke(IPC.ADD_FOLDER, folder)
    return folder ? [folder] : []
  },
  openPath: (targetPath: string) => ipcRenderer.invoke(IPC.OPEN_PATH, targetPath),

  listFolders: () => ipcRenderer.invoke(IPC.LIST_FOLDERS),
  addFolder: (folderPath: string) => ipcRenderer.invoke(IPC.ADD_FOLDER, folderPath),
  removeFolder: (id: number) => ipcRenderer.invoke(IPC.REMOVE_FOLDER, id),
  scanLibrary: () => ipcRenderer.invoke(IPC.SCAN_LIBRARY),
  importFiles: (filePaths: string[]) => ipcRenderer.invoke(IPC.IMPORT_FILES, filePaths),
  importBrowserFiles: async (files: File[]) => {
    const paths = files.map((file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch {
        return ''
      }
    }).filter(Boolean)
    const mp3s = paths.filter((p) => p.toLowerCase().endsWith('.mp3'))
    if (mp3s.length) await ipcRenderer.invoke(IPC.IMPORT_FILES, mp3s)
  },
  getStats: () => ipcRenderer.invoke(IPC.GET_STATS),
  onScanProgress: (callback: (progress: ScanProgress) => void) => {
    const listener = (_event: IpcRendererEvent, progress: ScanProgress) => callback(progress)
    ipcRenderer.on(IPC.SCAN_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC.SCAN_PROGRESS, listener)
  },

  listTracks: (limit?: number, offset?: number) =>
    ipcRenderer.invoke(IPC.LIST_TRACKS, limit, offset),
  getTrack: (id: number) => ipcRenderer.invoke(IPC.GET_TRACK, id),
  getRecentlyPlayed: (limit?: number) => ipcRenderer.invoke(IPC.GET_RECENTLY_PLAYED, limit),
  getRecentlyAdded: (limit?: number) => ipcRenderer.invoke(IPC.GET_RECENTLY_ADDED, limit),
  toggleFavorite: (trackId: number) => ipcRenderer.invoke(IPC.TOGGLE_FAVORITE, trackId),
  recordPlay: (trackId: number, position?: number) =>
    ipcRenderer.invoke(IPC.RECORD_PLAY, trackId, position),
  savePosition: (trackId: number, position: number) =>
    ipcRenderer.invoke(IPC.SAVE_POSITION, trackId, position),
  resolveTrackUrl: (trackId: number) => ipcRenderer.invoke(IPC.RESOLVE_TRACK_URL, trackId),
  checkTrackExists: (trackId: number) => ipcRenderer.invoke(IPC.CHECK_TRACK_EXISTS, trackId),

  listAlbums: (options?: {
    genre?: string | null
    sort?: 'added' | 'title' | 'artist' | 'year'
    query?: string
  }) => ipcRenderer.invoke(IPC.LIST_ALBUMS, options),
  getAlbum: (id: number) => ipcRenderer.invoke(IPC.GET_ALBUM, id),
  getAlbumTracks: (id: number) => ipcRenderer.invoke(IPC.GET_ALBUM_TRACKS, id),
  getRecentAlbums: (limit?: number) => ipcRenderer.invoke(IPC.GET_RECENT_ALBUMS, limit),

  listPlaylists: () => ipcRenderer.invoke(IPC.LIST_PLAYLISTS),
  getPlaylist: (id: number) => ipcRenderer.invoke(IPC.GET_PLAYLIST, id),
  getPlaylistTracks: (id: number) => ipcRenderer.invoke(IPC.GET_PLAYLIST_TRACKS, id),
  createPlaylist: (input: CreatePlaylistInput) => ipcRenderer.invoke(IPC.CREATE_PLAYLIST, input),
  updatePlaylist: (id: number, input: UpdatePlaylistInput) =>
    ipcRenderer.invoke(IPC.UPDATE_PLAYLIST, id, input),
  deletePlaylist: (id: number) => ipcRenderer.invoke(IPC.DELETE_PLAYLIST, id),
  addToPlaylist: (playlistId: number, trackIds: number[]) =>
    ipcRenderer.invoke(IPC.ADD_TO_PLAYLIST, playlistId, trackIds),
  removeFromPlaylist: (playlistId: number, trackId: number) =>
    ipcRenderer.invoke(IPC.REMOVE_FROM_PLAYLIST, playlistId, trackId),
  reorderPlaylist: (playlistId: number, trackIds: number[]) =>
    ipcRenderer.invoke(IPC.REORDER_PLAYLIST, playlistId, trackIds),

  search: (query: string) => ipcRenderer.invoke(IPC.SEARCH, query),
  getSettings: () => ipcRenderer.invoke(IPC.GET_SETTINGS) as Promise<AppSettings>,
  updateSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC.UPDATE_SETTINGS, partial) as Promise<AppSettings>,
  getPlaybackSnapshot: () =>
    ipcRenderer.invoke(IPC.GET_PLAYBACK_SNAPSHOT) as Promise<PlaybackSnapshot | null>,
  savePlaybackSnapshot: (snapshot: PlaybackSnapshot) =>
    ipcRenderer.invoke(IPC.SAVE_PLAYBACK_SNAPSHOT, snapshot),
  getCoverUrl: (coverPath: string | null) => ipcRenderer.invoke(IPC.GET_COVER_URL, coverPath),

  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return ''
    }
  }
}

contextBridge.exposeInMainWorld('musicFlow', api)

export type { MusicFlowApi }
