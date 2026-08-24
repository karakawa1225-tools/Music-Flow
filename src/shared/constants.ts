export const IPC = {
  // App paths / dialogs
  GET_APP_PATHS: 'app:get-paths',
  SELECT_MUSIC_FOLDER: 'dialog:select-music-folder',
  SELECT_COVER_IMAGE: 'dialog:select-cover-image',
  SELECT_MP3_FILES: 'dialog:select-mp3-files',
  OPEN_PATH: 'shell:open-path',

  // Library
  LIST_FOLDERS: 'library:list-folders',
  ADD_FOLDER: 'library:add-folder',
  REMOVE_FOLDER: 'library:remove-folder',
  SCAN_LIBRARY: 'library:scan',
  SCAN_PROGRESS: 'library:scan-progress',
  IMPORT_FILES: 'library:import-files',
  GET_STATS: 'library:get-stats',

  // Tracks / albums / artists
  LIST_TRACKS: 'tracks:list',
  GET_TRACK: 'tracks:get',
  GET_RECENTLY_PLAYED: 'tracks:recently-played',
  GET_RECENTLY_ADDED: 'tracks:recently-added',
  TOGGLE_FAVORITE: 'tracks:toggle-favorite',
  RECORD_PLAY: 'tracks:record-play',
  SAVE_POSITION: 'tracks:save-position',
  RESOLVE_TRACK_URL: 'tracks:resolve-url',
  CHECK_TRACK_EXISTS: 'tracks:check-exists',

  LIST_ALBUMS: 'albums:list',
  GET_ALBUM: 'albums:get',
  GET_ALBUM_TRACKS: 'albums:get-tracks',
  GET_RECENT_ALBUMS: 'albums:recent',

  // Playlists
  LIST_PLAYLISTS: 'playlists:list',
  GET_PLAYLIST: 'playlists:get',
  GET_PLAYLIST_TRACKS: 'playlists:get-tracks',
  CREATE_PLAYLIST: 'playlists:create',
  UPDATE_PLAYLIST: 'playlists:update',
  DELETE_PLAYLIST: 'playlists:delete',
  ADD_TO_PLAYLIST: 'playlists:add-tracks',
  REMOVE_FROM_PLAYLIST: 'playlists:remove-track',
  REORDER_PLAYLIST: 'playlists:reorder',

  // Search / settings / playback snapshot
  SEARCH: 'search:query',
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  GET_PLAYBACK_SNAPSHOT: 'playback:get-snapshot',
  SAVE_PLAYBACK_SNAPSHOT: 'playback:save-snapshot',

  // Covers
  GET_COVER_URL: 'covers:get-url'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
