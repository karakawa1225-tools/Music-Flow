import type { Album, Playlist, Track } from '../shared/types'
import { bool, num, str, type DbRow } from './db'

export function mapTrack(row: DbRow): Track {
  return {
    id: num(row.id),
    path: str(row.storage_path),
    filename: str(row.filename),
    title: str(row.title),
    artistId: row.artist_id == null ? null : num(row.artist_id),
    artistName: str(row.artist_name, 'Unknown Artist'),
    albumId: row.album_id == null ? null : num(row.album_id),
    albumTitle: str(row.album_title, 'Unknown Album'),
    genre: row.genre == null ? null : str(row.genre),
    year: row.year == null ? null : num(row.year),
    trackNumber: row.track_number == null ? null : num(row.track_number),
    discNumber: row.disc_number == null ? null : num(row.disc_number),
    duration: num(row.duration),
    bitrate: row.bitrate == null ? null : num(row.bitrate),
    sampleRate: row.sample_rate == null ? null : num(row.sample_rate),
    coverPath: row.cover_path == null ? null : str(row.cover_path),
    fileSize: row.file_size == null ? null : num(row.file_size),
    fileMtime: null,
    isFavorite: bool(row.is_favorite),
    playCount: num(row.play_count),
    lastPlayedAt: row.last_played_at == null ? null : str(row.last_played_at),
    lastPosition: num(row.last_position),
    missing: false,
    sourceType: 'cloud',
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at)
  }
}

export function mapAlbum(row: DbRow): Album {
  return {
    id: num(row.id),
    title: str(row.title),
    artistId: row.artist_id == null ? null : num(row.artist_id),
    artistName: str(row.artist_name, 'Unknown Artist'),
    year: row.year == null ? null : num(row.year),
    genre: row.genre == null ? null : str(row.genre),
    coverPath: row.cover_path == null ? null : str(row.cover_path),
    trackCount: row.track_count == null ? undefined : num(row.track_count),
    totalDuration: row.total_duration == null ? undefined : num(row.total_duration),
    createdAt: str(row.created_at),
    addedAt: str(row.created_at)
  }
}

export function mapPlaylist(row: DbRow): Playlist {
  return {
    id: num(row.id),
    name: str(row.name),
    description: row.description == null ? null : str(row.description),
    coverPath: row.cover_path == null ? null : str(row.cover_path),
    isSystem: bool(row.is_system),
    systemKey: row.system_key == null ? null : str(row.system_key),
    trackCount: row.track_count == null ? undefined : num(row.track_count),
    totalDuration: row.total_duration == null ? undefined : num(row.total_duration),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at)
  }
}

export const TRACK_JOIN = `
  SELECT t.*,
    a.name AS artist_name,
    al.title AS album_title
  FROM tracks t
  LEFT JOIN artists a ON a.id = t.artist_id
  LEFT JOIN albums al ON al.id = t.album_id
`
