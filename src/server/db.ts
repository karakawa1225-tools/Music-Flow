import { createClient, type Client } from '@libsql/client'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'

let client: Client | null = null

function schemaCandidates(): string[] {
  return [
    join(process.cwd(), 'turso', 'schema.sql'),
    join(process.cwd(), 'schema.sql'),
    join(__dirname, '..', '..', 'turso', 'schema.sql')
  ]
}

export function getDb(): Client {
  if (client) return client

  const rawUrl = (process.env.TURSO_DATABASE_URL || '').trim()
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim()
  const looksPlaceholder =
    !rawUrl ||
    rawUrl.includes('YOUR-') ||
    rawUrl.includes('xxxx') ||
    rawUrl === 'libsql://YOUR-DB-NAME-YOUR-ORG.turso.io'

  const url = looksPlaceholder
    ? `file:${resolve(process.cwd(), 'data', 'music-flow.db')}`
    : rawUrl

  if (url.startsWith('file:')) {
    const filePath = url.replace(/^file:/, '')
    mkdirSync(dirname(filePath), { recursive: true })
  }

  client = createClient({
    url,
    ...(!looksPlaceholder && authToken ? { authToken } : {})
  })
  return client
}

export async function migrate(): Promise<void> {
  const db = getDb()
  let sql = ''
  for (const schemaPath of schemaCandidates()) {
    if (existsSync(schemaPath)) {
      sql = readFileSync(schemaPath, 'utf8')
      break
    }
  }
  if (!sql) {
    // Fallback when bundled without filesystem schema
    sql = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist_id INTEGER,
  year INTEGER,
  genre TEXT,
  cover_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  artist_id INTEGER,
  album_id INTEGER,
  genre TEXT,
  year INTEGER,
  track_number INTEGER,
  disc_number INTEGER,
  duration REAL NOT NULL DEFAULT 0,
  bitrate INTEGER,
  sample_rate INTEGER,
  cover_path TEXT,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TEXT,
  last_position REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_path TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  system_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, system_key)
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  track_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (playlist_id, track_id)
);
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS playback_snapshots (
  user_id TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`
  }

  const withoutLineComments = sql
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')

  const statements = withoutLineComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const statement of statements) {
    await db.execute(statement)
  }
}

export type DbRow = Record<string, unknown>

export function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function str(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value)
}

export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === '1'
}
