import { BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname } from 'path'
import { Readable } from 'stream'
import { IPC } from '../../shared/constants'
import type { AppSettings, CreatePlaylistInput, PlaybackSnapshot, UpdatePlaylistInput } from '../../shared/types'
import {
  getPlaybackSnapshot,
  getSettings,
  savePlaybackSnapshot,
  updateSettings
} from '../database'
import {
  addLibraryFolder,
  addTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  getAlbumById,
  getAlbumTracks,
  getLibraryStats,
  getPlaylistById,
  getPlaylistTracks,
  getRecentAlbums,
  getRecentlyAddedTracks,
  getRecentlyPlayed,
  getTrackById,
  listAlbums,
  listLibraryFolders,
  listPlaylists,
  listTracks,
  markTrackMissing,
  recordPlay,
  removeLibraryFolder,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  saveTrackPosition,
  searchLibrary,
  toggleFavorite,
  updatePlaylist
} from '../database/repositories'
import { getAppPaths } from '../paths'
import { addAndScanFolder, importMp3Files, scanFolders } from '../filesystem/scanner'

function getWin(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function openDialog(
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  const win = getWin()
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function mimeForAudioPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mp3':
      return 'audio/mpeg'
    case '.flac':
      return 'audio/flac'
    case '.m4a':
    case '.mp4':
      return 'audio/mp4'
    case '.ogg':
    case '.oga':
      return 'audio/ogg'
    case '.wav':
      return 'audio/wav'
    case '.aac':
      return 'audio/aac'
    case '.opus':
      return 'audio/opus'
    default:
      return 'application/octet-stream'
  }
}

function resolveMfMediaPath(requestUrl: string): string {
  const raw = requestUrl.replace(/^mf-media:\/\//i, '')
  let resolved = decodeURIComponent(raw).replace(/^\/+/, '')

  if (process.platform === 'win32') {
    // mf-media:///E:/path or mf-media://E:/path → E:/path
    if (/^[A-Za-z]\//.test(resolved)) {
      resolved = `${resolved[0]}:${resolved.slice(1)}`
    }
    resolved = resolved.replace(/\//g, '\\')
  }

  return resolved
}

/** Serve local audio with Accept-Ranges / 206 so HTMLAudioElement seeking works. */
export function registerLocalFileProtocol(): void {
  protocol.handle('mf-media', (request) => {
    try {
      const resolved = resolveMfMediaPath(request.url)

      if (!existsSync(resolved)) {
        console.warn('[mf-media] missing file:', resolved, 'from', request.url)
        return new Response('Not Found', { status: 404 })
      }

      const { size: fileSize } = statSync(resolved)
      const mime = mimeForAudioPath(resolved)
      const rangeHeader = request.headers.get('Range')

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
        if (!match) {
          return new Response('Invalid Range', { status: 416 })
        }

        const start = match[1] ? Number(match[1]) : 0
        let end = match[2] ? Number(match[2]) : fileSize - 1

        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          start >= fileSize ||
          end < start
        ) {
          return new Response(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`
            }
          })
        }

        end = Math.min(end, fileSize - 1)
        const chunkSize = end - start + 1
        const stream = Readable.toWeb(createReadStream(resolved, { start, end }))

        return new Response(stream as BodyInit, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes'
          }
        })
      }

      const stream = Readable.toWeb(createReadStream(resolved))
      return new Response(stream as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes'
        }
      })
    } catch (error) {
      console.error('mf-media protocol error', error)
      return new Response('Error', { status: 500 })
    }
  })
}

export function pathToMediaUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const encoded = normalized
    .split('/')
    .map((segment, index) => {
      // Keep Windows drive letter (E:)
      if (index === 0 && /^[A-Za-z]:$/.test(segment)) return segment
      return encodeURIComponent(segment)
    })
    .join('/')
  return `mf-media:///${encoded}`
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.GET_APP_PATHS, () => getAppPaths())

  ipcMain.handle(IPC.SELECT_MUSIC_FOLDER, async () => {
    const result = await openDialog({
      title: '音楽フォルダを選択',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.SELECT_COVER_IMAGE, async () => {
    const result = await openDialog({
      title: 'カバー画像を選択',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.SELECT_MP3_FILES, async () => {
    const result = await openDialog({
      title: 'MP3ファイルを選択',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'MP3', extensions: ['mp3'] }]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle(IPC.OPEN_PATH, async (_e, targetPath: string) => {
    return shell.openPath(targetPath)
  })

  ipcMain.handle(IPC.LIST_FOLDERS, () => listLibraryFolders())
  ipcMain.handle(IPC.ADD_FOLDER, async (_e, folderPath: string) => {
    addLibraryFolder(folderPath)
    return addAndScanFolder(folderPath, getWin())
  })
  ipcMain.handle(IPC.REMOVE_FOLDER, (_e, id: number) => removeLibraryFolder(id))
  ipcMain.handle(IPC.SCAN_LIBRARY, async () => {
    const folders = listLibraryFolders().map((f) => f.path)
    if (!folders.length) {
      return { imported: 0, failed: 0, missing: 0 }
    }
    return scanFolders(folders, getWin())
  })
  ipcMain.handle(IPC.IMPORT_FILES, async (_e, filePaths: string[]) => {
    return importMp3Files(filePaths, getWin())
  })
  ipcMain.handle(IPC.GET_STATS, () => getLibraryStats())

  ipcMain.handle(IPC.LIST_TRACKS, (_e, limit?: number, offset?: number) =>
    listTracks(limit ?? 5000, offset ?? 0)
  )
  ipcMain.handle(IPC.GET_TRACK, (_e, id: number) => getTrackById(id))
  ipcMain.handle(IPC.GET_RECENTLY_PLAYED, (_e, limit?: number) => getRecentlyPlayed(limit ?? 24))
  ipcMain.handle(IPC.GET_RECENTLY_ADDED, (_e, limit?: number) => getRecentlyAddedTracks(limit ?? 24))
  ipcMain.handle(IPC.TOGGLE_FAVORITE, (_e, trackId: number) => toggleFavorite(trackId))
  ipcMain.handle(IPC.RECORD_PLAY, (_e, trackId: number, position?: number) => {
    recordPlay(trackId, position ?? 0)
  })
  ipcMain.handle(IPC.SAVE_POSITION, (_e, trackId: number, position: number) => {
    saveTrackPosition(trackId, position)
  })
  ipcMain.handle(IPC.RESOLVE_TRACK_URL, (_e, trackId: number) => {
    const track = getTrackById(trackId)
    if (!track) return { ok: false as const, error: 'Track not found' }
    if (!existsSync(track.path)) {
      markTrackMissing(trackId, true)
      return { ok: false as const, error: 'File missing', track: getTrackById(trackId) }
    }
    markTrackMissing(trackId, false)
    return { ok: true as const, url: pathToMediaUrl(track.path), track }
  })
  ipcMain.handle(IPC.CHECK_TRACK_EXISTS, (_e, trackId: number) => {
    const track = getTrackById(trackId)
    if (!track) return false
    const exists = existsSync(track.path)
    if (!exists) markTrackMissing(trackId, true)
    return exists
  })

  ipcMain.handle(
    IPC.LIST_ALBUMS,
    (
      _e,
      options?: { genre?: string | null; sort?: 'added' | 'title' | 'artist' | 'year'; query?: string }
    ) => listAlbums(options)
  )
  ipcMain.handle(IPC.GET_ALBUM, (_e, id: number) => getAlbumById(id))
  ipcMain.handle(IPC.GET_ALBUM_TRACKS, (_e, id: number) => getAlbumTracks(id))
  ipcMain.handle(IPC.GET_RECENT_ALBUMS, (_e, limit?: number) => getRecentAlbums(limit ?? 12))

  ipcMain.handle(IPC.LIST_PLAYLISTS, () => listPlaylists())
  ipcMain.handle(IPC.GET_PLAYLIST, (_e, id: number) => getPlaylistById(id))
  ipcMain.handle(IPC.GET_PLAYLIST_TRACKS, (_e, id: number) => getPlaylistTracks(id))
  ipcMain.handle(IPC.CREATE_PLAYLIST, (_e, input: CreatePlaylistInput) => createPlaylist(input))
  ipcMain.handle(IPC.UPDATE_PLAYLIST, (_e, id: number, input: UpdatePlaylistInput) =>
    updatePlaylist(id, input)
  )
  ipcMain.handle(IPC.DELETE_PLAYLIST, (_e, id: number) => deletePlaylist(id))
  ipcMain.handle(IPC.ADD_TO_PLAYLIST, (_e, playlistId: number, trackIds: number[]) => {
    addTracksToPlaylist(playlistId, trackIds)
  })
  ipcMain.handle(IPC.REMOVE_FROM_PLAYLIST, (_e, playlistId: number, trackId: number) => {
    removeTrackFromPlaylist(playlistId, trackId)
  })
  ipcMain.handle(IPC.REORDER_PLAYLIST, (_e, playlistId: number, trackIds: number[]) => {
    reorderPlaylistTracks(playlistId, trackIds)
  })

  ipcMain.handle(IPC.SEARCH, (_e, query: string) => searchLibrary(query))
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings())
  ipcMain.handle(IPC.UPDATE_SETTINGS, (_e, partial: Partial<AppSettings>) => updateSettings(partial))
  ipcMain.handle(IPC.GET_PLAYBACK_SNAPSHOT, () => getPlaybackSnapshot())
  ipcMain.handle(IPC.SAVE_PLAYBACK_SNAPSHOT, (_e, snapshot: PlaybackSnapshot) => {
    savePlaybackSnapshot(snapshot)
  })

  ipcMain.handle(IPC.GET_COVER_URL, (_e, coverPath: string | null) => {
    if (!coverPath || !existsSync(coverPath)) return null
    return pathToMediaUrl(coverPath)
  })
}
