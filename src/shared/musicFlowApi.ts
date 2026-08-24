import type {
  Album,
  AppSettings,
  CreatePlaylistInput,
  LibraryFolder,
  LibraryStats,
  PlaybackSnapshot,
  Playlist,
  ScanProgress,
  SearchResults,
  Track,
  UpdatePlaylistInput
} from './types'

export type ResolveTrackResult =
  | { ok: true; url: string; track: Track }
  | { ok: false; error: string; track?: Track | null }

export interface MusicFlowApi {
  getAppPaths: () => Promise<unknown>
  selectMusicFolder: () => Promise<string | null>
  selectCoverImage: () => Promise<string | null>
  selectMp3Files: () => Promise<string[]>
  openPath: (targetPath: string) => Promise<unknown>

  listFolders: () => Promise<LibraryFolder[]>
  addFolder: (folderPath: string) => Promise<unknown>
  removeFolder: (id: number) => Promise<unknown>
  scanLibrary: () => Promise<unknown>
  importFiles: (filePaths: string[]) => Promise<unknown>
  /** Browser / drag-drop uploads (Web). Desktop maps Files → paths. */
  importBrowserFiles: (files: File[]) => Promise<unknown>
  getStats: () => Promise<LibraryStats>
  onScanProgress: (callback: (progress: ScanProgress) => void) => () => void

  listTracks: (limit?: number, offset?: number) => Promise<Track[]>
  getTrack: (id: number) => Promise<Track | null>
  getRecentlyPlayed: (limit?: number) => Promise<Track[]>
  getRecentlyAdded: (limit?: number) => Promise<Track[]>
  toggleFavorite: (trackId: number) => Promise<Track | null>
  recordPlay: (trackId: number, position?: number) => Promise<unknown>
  savePosition: (trackId: number, position: number) => Promise<unknown>
  resolveTrackUrl: (trackId: number) => Promise<ResolveTrackResult>
  checkTrackExists: (trackId: number) => Promise<boolean>

  listAlbums: (options?: {
    genre?: string | null
    sort?: 'added' | 'title' | 'artist' | 'year'
    query?: string
  }) => Promise<Album[]>
  getAlbum: (id: number) => Promise<Album | null>
  getAlbumTracks: (id: number) => Promise<Track[]>
  getRecentAlbums: (limit?: number) => Promise<Album[]>

  listPlaylists: () => Promise<Playlist[]>
  getPlaylist: (id: number) => Promise<Playlist | null>
  getPlaylistTracks: (id: number) => Promise<Track[]>
  createPlaylist: (input: CreatePlaylistInput) => Promise<Playlist | null>
  updatePlaylist: (id: number, input: UpdatePlaylistInput) => Promise<Playlist | null>
  deletePlaylist: (id: number) => Promise<boolean>
  addToPlaylist: (playlistId: number, trackIds: number[]) => Promise<unknown>
  removeFromPlaylist: (playlistId: number, trackId: number) => Promise<unknown>
  reorderPlaylist: (playlistId: number, trackIds: number[]) => Promise<unknown>

  search: (query: string) => Promise<SearchResults>
  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  getPlaybackSnapshot: () => Promise<PlaybackSnapshot | null>
  savePlaybackSnapshot: (snapshot: PlaybackSnapshot) => Promise<unknown>
  getCoverUrl: (coverPath: string | null) => Promise<string | null>

  getPathForFile: (file: File) => string

  /** Web-only helpers (optional on desktop). */
  signOut?: () => Promise<void>
  getAuthEmail?: () => Promise<string | null>
}
