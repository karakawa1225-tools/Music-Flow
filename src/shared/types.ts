export type RepeatMode = 'off' | 'all' | 'one'

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Artist {
  id: number
  name: string
  createdAt: string
}

export interface Album {
  id: number
  title: string
  artistId: number | null
  artistName?: string
  year: number | null
  genre: string | null
  coverPath: string | null
  trackCount?: number
  totalDuration?: number
  createdAt: string
  addedAt?: string
}

export interface Track {
  id: number
  path: string
  filename: string
  title: string
  artistId: number | null
  artistName?: string
  albumId: number | null
  albumTitle?: string
  genre: string | null
  year: number | null
  trackNumber: number | null
  discNumber: number | null
  duration: number
  bitrate: number | null
  sampleRate: number | null
  coverPath: string | null
  fileSize: number | null
  fileMtime: number | null
  isFavorite: boolean
  playCount: number
  lastPlayedAt: string | null
  lastPosition: number
  missing: boolean
  sourceType: 'local' | 'cloud'
  createdAt: string
  updatedAt: string
}

export interface Playlist {
  id: number
  name: string
  description: string | null
  coverPath: string | null
  isSystem: boolean
  systemKey: string | null
  trackCount?: number
  totalDuration?: number
  createdAt: string
  updatedAt: string
}

export interface PlaylistTrack {
  id: number
  playlistId: number
  trackId: number
  position: number
  track?: Track
}

export interface LibraryFolder {
  id: number
  path: string
  createdAt: string
  lastScannedAt: string | null
}

export interface AppSettings {
  theme: ThemeMode
  language: string
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
  launchAtStartup: boolean
  minimizeToTray: boolean
  restoreLastState: boolean
  enableAnimations: boolean
  hardwareAcceleration: boolean
  eqEnabled: boolean
  eqPreset: string
  eqBands: number[]
  eqBassBoost: number
  eq3d: number
  eqSurround: number
  eqBalance: number
  lastRoute: string
  windowBounds: { x: number; y: number; width: number; height: number } | null
  showWelcome: boolean
  trackNotifications: boolean
  crossfadeSeconds: number
}

export interface PlaybackSnapshot {
  currentTrackId: number | null
  queue: number[]
  queueIndex: number
  currentTime: number
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
}

export interface ScanProgress {
  phase: 'idle' | 'scanning' | 'parsing' | 'done' | 'error'
  current: number
  total: number
  message: string
  folderPath?: string
}

export interface SearchResults {
  tracks: Track[]
  albums: Album[]
  playlists: Playlist[]
  artists: Artist[]
}

export interface LibraryStats {
  trackCount: number
  albumCount: number
  artistCount: number
  playlistCount: number
  totalDuration: number
}

export interface CreatePlaylistInput {
  name: string
  description?: string
  coverPath?: string | null
}

export interface UpdatePlaylistInput {
  name?: string
  description?: string | null
  coverPath?: string | null
}

export interface EqPreset {
  id: string
  name: string
  bands: number[]
  bassBoost?: number
  effect3d?: number
  surround?: number
}

export const EQ_BAND_LABELS = [
  '31Hz',
  '62Hz',
  '125Hz',
  '250Hz',
  '500Hz',
  '1kHz',
  '2kHz',
  '4kHz',
  '8kHz',
  '16kHz'
] as const

export const EQ_PRESETS: Record<string, number[]> = {
  FLAT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  POP: [-1, 2, 4, 3, 0, -1, -1, 1, 2, 3],
  ROCK: [4, 3, 1, 0, -1, 1, 2, 3, 3, 3],
  JAZZ: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  CLASSICAL: [3, 2, 0, 0, 0, 0, -1, -1, 2, 3],
  'BASS BOOST': [6, 5, 4, 2, 0, -1, -2, -2, 0, 1],
  VOCAL: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  CUSTOM: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'ja',
  volume: 0.8,
  shuffle: false,
  repeatMode: 'off',
  launchAtStartup: false,
  minimizeToTray: false,
  restoreLastState: true,
  enableAnimations: true,
  hardwareAcceleration: true,
  eqEnabled: false,
  eqPreset: 'FLAT',
  eqBands: [...EQ_PRESETS.FLAT],
  eqBassBoost: 0,
  eq3d: 0,
  eqSurround: 0,
  eqBalance: 0,
  lastRoute: '/',
  windowBounds: null,
  showWelcome: true,
  trackNotifications: false,
  crossfadeSeconds: 0
}

export const APP_NAME = 'MUSIC FLOW'
export const APP_TAGLINE = 'Your Music. Your Library. Your Flow.'
export const APP_VERSION = '2.0.0'
