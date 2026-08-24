import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { parseFile } from 'music-metadata'
import { getDb } from '../database'
import { getAppPaths } from '../paths'
import type { Album, Artist, LibraryStats, Playlist, SearchResults, Track } from '../../shared/types'

type TrackRow = {
  id: number
  path: string
  filename: string
  title: string
  artist_id: number | null
  artist_name: string | null
  album_id: number | null
  album_title: string | null
  genre: string | null
  year: number | null
  track_number: number | null
  disc_number: number | null
  duration: number
  bitrate: number | null
  sample_rate: number | null
  cover_path: string | null
  file_size: number | null
  file_mtime: number | null
  is_favorite: number
  play_count: number
  last_played_at: string | null
  last_position: number
  missing: number
  source_type: string | null
  created_at: string
  updated_at: string
}

const TRACK_SELECT = `
  SELECT
    t.id, t.path, t.filename, t.title,
    t.artist_id, a.name AS artist_name,
    t.album_id, al.title AS album_title,
    t.genre, t.year, t.track_number, t.disc_number,
    t.duration, t.bitrate, t.sample_rate, t.cover_path,
    t.file_size, t.file_mtime, t.is_favorite, t.play_count,
    t.last_played_at, t.last_position, t.missing,
    COALESCE(t.source_type, 'local') AS source_type,
    t.created_at, t.updated_at
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
`

export function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    path: row.path,
    filename: row.filename,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name ?? 'Unknown Artist',
    albumId: row.album_id,
    albumTitle: row.album_title ?? 'Unknown Album',
    genre: row.genre,
    year: row.year,
    trackNumber: row.track_number,
    discNumber: row.disc_number,
    duration: row.duration,
    bitrate: row.bitrate,
    sampleRate: row.sample_rate,
    coverPath: row.cover_path,
    fileSize: row.file_size,
    fileMtime: row.file_mtime,
    isFavorite: Boolean(row.is_favorite),
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
    lastPosition: row.last_position,
    missing: Boolean(row.missing),
    sourceType: 'local',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function getOrCreateArtist(name: string): number {
  const clean = name.trim() || 'Unknown Artist'
  const existing = getDb().prepare('SELECT id FROM artists WHERE name = ?').get(clean) as
    | { id: number }
    | undefined
  if (existing) return existing.id
  const result = getDb().prepare('INSERT INTO artists (name) VALUES (?)').run(clean)
  return Number(result.lastInsertRowid)
}

export function getOrCreateAlbum(
  title: string,
  artistId: number | null,
  year: number | null,
  genre: string | null,
  coverPath: string | null
): number {
  const clean = title.trim() || 'Unknown Album'
  const existing = getDb()
    .prepare('SELECT id, cover_path FROM albums WHERE title = ? AND ((artist_id IS ? ) OR (artist_id = ?))')
    .get(clean, artistId, artistId) as { id: number; cover_path: string | null } | undefined

  if (existing) {
    if (!existing.cover_path && coverPath) {
      getDb()
        .prepare('UPDATE albums SET cover_path = ?, year = COALESCE(?, year), genre = COALESCE(?, genre) WHERE id = ?')
        .run(coverPath, year, genre, existing.id)
    }
    return existing.id
  }

  const result = getDb()
    .prepare(
      'INSERT INTO albums (title, artist_id, year, genre, cover_path) VALUES (?, ?, ?, ?, ?)'
    )
    .run(clean, artistId, year, genre, coverPath)
  return Number(result.lastInsertRowid)
}

export async function saveCoverArt(
  pictureData: Buffer,
  format: string | undefined,
  key: string
): Promise<string | null> {
  try {
    const { covers } = getAppPaths()
    if (!existsSync(covers)) mkdirSync(covers, { recursive: true })
    const ext = format?.includes('png') ? '.png' : format?.includes('webp') ? '.webp' : '.jpg'
    const hash = createHash('md5').update(key).digest('hex')
    const coverPath = join(covers, `${hash}${ext}`)
    if (!existsSync(coverPath)) {
      writeFileSync(coverPath, pictureData)
    }
    return coverPath
  } catch {
    return null
  }
}

export async function upsertTrackFromFile(
  filePath: string,
  stats: { size: number; mtimeMs: number }
): Promise<Track | null> {
  try {
    const metadata = await parseFile(filePath, { duration: true })
    const common = metadata.common
    const title =
      common.title?.trim() || basename(filePath, extname(filePath)) || 'Unknown Title'
    const artistName = common.artist?.trim() || common.albumartist?.trim() || 'Unknown Artist'
    const albumTitle = common.album?.trim() || 'Unknown Album'
    const genre = common.genre?.[0] ?? null
    const year = common.year ?? null
    const trackNumber = common.track?.no ?? null
    const discNumber = common.disk?.no ?? null
    const duration = metadata.format.duration ?? 0
    const bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate) : null
    const sampleRate = metadata.format.sampleRate ?? null

    let coverPath: string | null = null
    const picture = common.picture?.[0]
    if (picture?.data) {
      coverPath = await saveCoverArt(
        Buffer.from(picture.data),
        picture.format,
        `${artistName}-${albumTitle}-${title}`
      )
    }

    const artistId = getOrCreateArtist(artistName)
    const albumId = getOrCreateAlbum(albumTitle, artistId, year, genre, coverPath)

    const existing = getDb().prepare('SELECT id, is_favorite, play_count, last_played_at, last_position FROM tracks WHERE path = ?').get(filePath) as
      | {
          id: number
          is_favorite: number
          play_count: number
          last_played_at: string | null
          last_position: number
        }
      | undefined

    if (existing) {
      getDb()
        .prepare(
          `UPDATE tracks SET
            filename = ?, title = ?, artist_id = ?, album_id = ?, genre = ?, year = ?,
            track_number = ?, disc_number = ?, duration = ?, bitrate = ?, sample_rate = ?,
            cover_path = COALESCE(?, cover_path), file_size = ?, file_mtime = ?,
            missing = 0, updated_at = datetime('now')
          WHERE id = ?`
        )
        .run(
          basename(filePath),
          title,
          artistId,
          albumId,
          genre,
          year,
          trackNumber,
          discNumber,
          duration,
          bitrate,
          sampleRate,
          coverPath,
          stats.size,
          Math.floor(stats.mtimeMs),
          existing.id
        )
      return getTrackById(existing.id)
    }

    const result = getDb()
      .prepare(
        `INSERT INTO tracks (
          path, filename, title, artist_id, album_id, genre, year,
          track_number, disc_number, duration, bitrate, sample_rate,
          cover_path, file_size, file_mtime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        filePath,
        basename(filePath),
        title,
        artistId,
        albumId,
        genre,
        year,
        trackNumber,
        discNumber,
        duration,
        bitrate,
        sampleRate,
        coverPath,
        stats.size,
        Math.floor(stats.mtimeMs)
      )

    return getTrackById(Number(result.lastInsertRowid))
  } catch (error) {
    console.error('Failed to parse track:', filePath, error)
    return null
  }
}

export function getTrackById(id: number): Track | null {
  const row = getDb().prepare(`${TRACK_SELECT} WHERE t.id = ?`).get(id) as TrackRow | undefined
  return row ? mapTrack(row) : null
}

export function getTrackByPath(path: string): Track | null {
  const row = getDb().prepare(`${TRACK_SELECT} WHERE t.path = ?`).get(path) as TrackRow | undefined
  return row ? mapTrack(row) : null
}

export function listTracks(limit = 5000, offset = 0): Track[] {
  const rows = getDb()
    .prepare(`${TRACK_SELECT} WHERE t.missing = 0 ORDER BY t.title COLLATE NOCASE LIMIT ? OFFSET ?`)
    .all(limit, offset) as TrackRow[]
  return rows.map(mapTrack)
}

export function getRecentlyPlayed(limit = 24): Track[] {
  const rows = getDb()
    .prepare(
      `${TRACK_SELECT} WHERE t.missing = 0 AND t.last_played_at IS NOT NULL
       ORDER BY t.last_played_at DESC LIMIT ?`
    )
    .all(limit) as TrackRow[]
  return rows.map(mapTrack)
}

export function getRecentlyAddedTracks(limit = 24): Track[] {
  const rows = getDb()
    .prepare(
      `${TRACK_SELECT} WHERE t.missing = 0 ORDER BY t.created_at DESC LIMIT ?`
    )
    .all(limit) as TrackRow[]
  return rows.map(mapTrack)
}

export function toggleFavorite(trackId: number): Track | null {
  const track = getTrackById(trackId)
  if (!track) return null
  const next = track.isFavorite ? 0 : 1
  getDb().prepare('UPDATE tracks SET is_favorite = ?, updated_at = datetime(\'now\') WHERE id = ?').run(next, trackId)
  if (next) {
    getDb().prepare('INSERT OR IGNORE INTO favorites (track_id) VALUES (?)').run(trackId)
  } else {
    getDb().prepare('DELETE FROM favorites WHERE track_id = ?').run(trackId)
  }
  return getTrackById(trackId)
}

export function recordPlay(trackId: number, position = 0): void {
  getDb()
    .prepare(
      `UPDATE tracks SET
        play_count = play_count + 1,
        last_played_at = datetime('now'),
        last_position = ?,
        updated_at = datetime('now')
      WHERE id = ?`
    )
    .run(position, trackId)
  getDb()
    .prepare('INSERT INTO play_history (track_id, position) VALUES (?, ?)')
    .run(trackId, position)
}

export function saveTrackPosition(trackId: number, position: number): void {
  getDb()
    .prepare('UPDATE tracks SET last_position = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(position, trackId)
}

export function markTrackMissing(trackId: number, missing = true): void {
  getDb()
    .prepare('UPDATE tracks SET missing = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(missing ? 1 : 0, trackId)
}

export function listAlbums(options?: {
  genre?: string | null
  sort?: 'added' | 'title' | 'artist' | 'year'
  query?: string
}): Album[] {
  const sort = options?.sort ?? 'added'
  const params: unknown[] = []
  let where = 'WHERE 1=1'

  if (options?.genre && options.genre !== 'すべて' && options.genre !== 'All') {
    if (options.genre === 'その他' || options.genre === 'Others') {
      where += ` AND (
        al.genre IS NULL OR (
          lower(al.genre) NOT LIKE '%j-pop%' AND
          lower(al.genre) NOT LIKE '%jpop%' AND
          lower(al.genre) NOT LIKE '%rock%' AND
          lower(al.genre) NOT LIKE '%jazz%' AND
          lower(al.genre) NOT LIKE '%classic%' AND
          lower(al.genre) NOT LIKE '%anime%' AND
          lower(al.genre) NOT LIKE '%western%'
        )
      )`
    } else {
      where += ' AND lower(COALESCE(al.genre, \'\')) LIKE ?'
      params.push(`%${options.genre.toLowerCase()}%`)
    }
  }

  if (options?.query?.trim()) {
    where += ' AND (al.title LIKE ? OR a.name LIKE ?)'
    const q = `%${options.query.trim()}%`
    params.push(q, q)
  }

  const orderBy =
    sort === 'title'
      ? 'al.title COLLATE NOCASE'
      : sort === 'artist'
        ? 'a.name COLLATE NOCASE, al.title COLLATE NOCASE'
          : sort === 'year'
          ? 'CASE WHEN al.year IS NULL THEN 1 ELSE 0 END, al.year DESC, al.title COLLATE NOCASE'
          : 'al.created_at DESC'

  const rows = getDb()
    .prepare(
      `SELECT
        al.id, al.title, al.artist_id, a.name AS artist_name,
        al.year, al.genre, al.cover_path, al.created_at,
        COUNT(t.id) AS track_count,
        COALESCE(SUM(t.duration), 0) AS total_duration
      FROM albums al
      LEFT JOIN artists a ON a.id = al.artist_id
      LEFT JOIN tracks t ON t.album_id = al.id AND t.missing = 0
      ${where}
      GROUP BY al.id
      HAVING track_count > 0
      ORDER BY ${orderBy}`
    )
    .all(...params) as Array<{
    id: number
    title: string
    artist_id: number | null
    artist_name: string | null
    year: number | null
    genre: string | null
    cover_path: string | null
    created_at: string
    track_count: number
    total_duration: number
  }>

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name ?? 'Unknown Artist',
    year: row.year,
    genre: row.genre,
    coverPath: row.cover_path,
    trackCount: row.track_count,
    totalDuration: row.total_duration,
    createdAt: row.created_at,
    addedAt: row.created_at
  }))
}

export function getAlbumById(id: number): Album | null {
  const albums = listAlbums()
  return albums.find((a) => a.id === id) ?? null
}

export function getAlbumTracks(albumId: number): Track[] {
  const rows = getDb()
    .prepare(
      `${TRACK_SELECT} WHERE t.album_id = ? AND t.missing = 0
       ORDER BY COALESCE(t.disc_number, 1), COALESCE(t.track_number, 999999), t.title COLLATE NOCASE`
    )
    .all(albumId) as TrackRow[]
  return rows.map(mapTrack)
}

export function getRecentAlbums(limit = 12): Album[] {
  return listAlbums({ sort: 'added' }).slice(0, limit)
}

export function listPlaylists(): Playlist[] {
  const rows = getDb()
    .prepare(
      `SELECT
        p.id, p.name, p.description, p.cover_path, p.is_system, p.system_key,
        p.created_at, p.updated_at,
        CASE
          WHEN p.system_key = 'favorites' THEN (SELECT COUNT(*) FROM tracks WHERE is_favorite = 1 AND missing = 0)
          WHEN p.system_key = 'recent' THEN (SELECT COUNT(*) FROM tracks WHERE last_played_at IS NOT NULL AND missing = 0)
          ELSE (SELECT COUNT(*) FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id AND t.missing = 0)
        END AS track_count,
        CASE
          WHEN p.system_key = 'favorites' THEN (SELECT COALESCE(SUM(duration),0) FROM tracks WHERE is_favorite = 1 AND missing = 0)
          WHEN p.system_key = 'recent' THEN (SELECT COALESCE(SUM(duration),0) FROM tracks WHERE last_played_at IS NOT NULL AND missing = 0)
          ELSE (SELECT COALESCE(SUM(t.duration),0) FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id WHERE pt.playlist_id = p.id AND t.missing = 0)
        END AS total_duration
      FROM playlists p
      ORDER BY p.is_system DESC, p.updated_at DESC`
    )
    .all() as Array<{
    id: number
    name: string
    description: string | null
    cover_path: string | null
    is_system: number
    system_key: string | null
    created_at: string
    updated_at: string
    track_count: number
    total_duration: number
  }>

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    coverPath: row.cover_path,
    isSystem: Boolean(row.is_system),
    systemKey: row.system_key,
    trackCount: row.track_count,
    totalDuration: row.total_duration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export function getPlaylistById(id: number): Playlist | null {
  return listPlaylists().find((p) => p.id === id) ?? null
}

export function getPlaylistTracks(playlistId: number): Track[] {
  const playlist = getPlaylistById(playlistId)
  if (!playlist) return []

  if (playlist.systemKey === 'favorites') {
    const rows = getDb()
      .prepare(`${TRACK_SELECT} WHERE t.is_favorite = 1 AND t.missing = 0 ORDER BY t.updated_at DESC`)
      .all() as TrackRow[]
    return rows.map(mapTrack)
  }

  if (playlist.systemKey === 'recent') {
    return getRecentlyPlayed(100)
  }

  const rows = getDb()
    .prepare(
      `${TRACK_SELECT}
       INNER JOIN playlist_tracks pt ON pt.track_id = t.id
       WHERE pt.playlist_id = ? AND t.missing = 0
       ORDER BY pt.position ASC, pt.id ASC`
    )
    .all(playlistId) as TrackRow[]
  return rows.map(mapTrack)
}

export function createPlaylist(input: {
  name: string
  description?: string
  coverPath?: string | null
}): Playlist {
  let coverPath = input.coverPath ?? null
  if (coverPath && existsSync(coverPath)) {
    const { playlists } = getAppPaths()
    const dest = join(playlists, `${Date.now()}${extname(coverPath)}`)
    copyFileSync(coverPath, dest)
    coverPath = dest
  }

  const result = getDb()
    .prepare(
      `INSERT INTO playlists (name, description, cover_path) VALUES (?, ?, ?)`
    )
    .run(input.name.trim() || 'Untitled Playlist', input.description ?? null, coverPath)

  const playlist = getPlaylistById(Number(result.lastInsertRowid))
  if (!playlist) throw new Error('Failed to create playlist')
  return playlist
}

export function updatePlaylist(
  id: number,
  input: { name?: string; description?: string | null; coverPath?: string | null }
): Playlist | null {
  const current = getPlaylistById(id)
  if (!current || current.isSystem) return current

  let coverPath = input.coverPath === undefined ? current.coverPath : input.coverPath
  if (coverPath && existsSync(coverPath) && coverPath !== current.coverPath) {
    const { playlists } = getAppPaths()
    const dest = join(playlists, `${Date.now()}${extname(coverPath)}`)
    copyFileSync(coverPath, dest)
    coverPath = dest
  }

  getDb()
    .prepare(
      `UPDATE playlists SET
        name = ?,
        description = ?,
        cover_path = ?,
        updated_at = datetime('now')
      WHERE id = ?`
    )
    .run(
      input.name?.trim() || current.name,
      input.description === undefined ? current.description : input.description,
      coverPath,
      id
    )

  return getPlaylistById(id)
}

export function deletePlaylist(id: number): boolean {
  const playlist = getPlaylistById(id)
  if (!playlist || playlist.isSystem) return false
  getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id)
  return true
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): void {
  const playlist = getPlaylistById(playlistId)
  if (!playlist || playlist.isSystem) return

  const maxPos = getDb()
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlistId) as { maxPos: number }

  const insert = getDb().prepare(
    `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)`
  )

  const tx = getDb().transaction((ids: number[]) => {
    let pos = maxPos.maxPos + 1
    for (const trackId of ids) {
      const info = insert.run(playlistId, trackId, pos)
      if (info.changes > 0) pos += 1
    }
    getDb()
      .prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`)
      .run(playlistId)
  })
  tx(trackIds)
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): void {
  const playlist = getPlaylistById(playlistId)
  if (!playlist || playlist.isSystem) return
  getDb()
    .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .run(playlistId, trackId)
}

export function reorderPlaylistTracks(playlistId: number, trackIds: number[]): void {
  const playlist = getPlaylistById(playlistId)
  if (!playlist || playlist.isSystem) return
  const update = getDb().prepare(
    'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
  )
  const tx = getDb().transaction((ids: number[]) => {
    ids.forEach((trackId, index) => update.run(index, playlistId, trackId))
    getDb()
      .prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`)
      .run(playlistId)
  })
  tx(trackIds)
}

export function searchLibrary(query: string): SearchResults {
  const q = query.trim()
  if (!q) {
    return { tracks: [], albums: [], playlists: [], artists: [] }
  }
  const like = `%${q}%`

  const tracks = (
    getDb()
      .prepare(
        `${TRACK_SELECT} WHERE t.missing = 0 AND (
          t.title LIKE ? OR a.name LIKE ? OR al.title LIKE ? OR t.filename LIKE ?
        ) ORDER BY t.title COLLATE NOCASE LIMIT 40`
      )
      .all(like, like, like, like) as TrackRow[]
  ).map(mapTrack)

  const albums = listAlbums({ query: q }).slice(0, 20)

  const playlists = (
    getDb()
      .prepare(
        `SELECT id FROM playlists WHERE name LIKE ? OR COALESCE(description,'') LIKE ? LIMIT 20`
      )
      .all(like, like) as Array<{ id: number }>
  )
    .map((row) => getPlaylistById(row.id))
    .filter(Boolean) as Playlist[]

  const artists = (
    getDb()
      .prepare(`SELECT id, name, created_at FROM artists WHERE name LIKE ? ORDER BY name LIMIT 20`)
      .all(like) as Array<{ id: number; name: string; created_at: string }>
  ).map(
    (row): Artist => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at
    })
  )

  return { tracks, albums, playlists, artists }
}

export function getLibraryStats(): LibraryStats {
  const row = getDb()
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM tracks WHERE missing = 0) AS trackCount,
        (SELECT COUNT(*) FROM albums) AS albumCount,
        (SELECT COUNT(*) FROM artists) AS artistCount,
        (SELECT COUNT(*) FROM playlists) AS playlistCount,
        (SELECT COALESCE(SUM(duration), 0) FROM tracks WHERE missing = 0) AS totalDuration`
    )
    .get() as LibraryStats
  return row
}

export function listLibraryFolders() {
  return getDb()
    .prepare(
      `SELECT id, path, created_at AS createdAt, last_scanned_at AS lastScannedAt
       FROM library_folders ORDER BY created_at ASC`
    )
    .all() as Array<{
    id: number
    path: string
    createdAt: string
    lastScannedAt: string | null
  }>
}

export function addLibraryFolder(folderPath: string) {
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO library_folders (path) VALUES (?)`
    )
    .run(folderPath)
  return listLibraryFolders().find((f) => f.path === folderPath) ?? null
}

export function removeLibraryFolder(id: number): boolean {
  const info = getDb().prepare('DELETE FROM library_folders WHERE id = ?').run(id)
  return info.changes > 0
}

export function touchLibraryFolder(id: number): void {
  getDb()
    .prepare(`UPDATE library_folders SET last_scanned_at = datetime('now') WHERE id = ?`)
    .run(id)
}
