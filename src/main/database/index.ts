import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, unlinkSync } from 'fs'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { app } from 'electron'
import { getAppPaths } from '../paths'
import type { AppSettings, PlaybackSnapshot } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

const require = createRequire(import.meta.url)

export class Stmt {
  constructor(
    private db: SqlJsDatabase,
    private sql: string
  ) {}

  run(...params: unknown[]): { lastInsertRowid: number; changes: number } {
    this.db.run(this.sql, params as never[])
    const changes = this.db.getRowsModified()
    const idRow = this.db.exec('SELECT last_insert_rowid() as id')
    const lastInsertRowid = Number(idRow[0]?.values?.[0]?.[0] ?? 0)
    schedulePersist()
    return { lastInsertRowid, changes }
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const stmt = this.db.prepare(this.sql)
    try {
      stmt.bind(params as never[])
      if (stmt.step()) {
        return stmt.getAsObject() as Record<string, unknown>
      }
      return undefined
    } finally {
      stmt.free()
    }
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const stmt = this.db.prepare(this.sql)
    const rows: Record<string, unknown>[] = []
    try {
      stmt.bind(params as never[])
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as Record<string, unknown>)
      }
      return rows
    } finally {
      stmt.free()
    }
  }
}

export class AppDatabase {
  constructor(private db: SqlJsDatabase) {}

  exec(sql: string): void {
    this.db.exec(sql)
    schedulePersist()
  }

  prepare(sql: string): Stmt {
    return new Stmt(this.db, sql)
  }

  pragma(_sql: string): void {
    // no-op for sql.js compatibility shim
  }

  transaction<T extends unknown[]>(fn: (args: T) => void): (args: T) => void {
    return (args: T) => {
      this.db.exec('BEGIN')
      try {
        fn(args)
        this.db.exec('COMMIT')
        schedulePersist()
      } catch (error) {
        this.db.exec('ROLLBACK')
        throw error
      }
    }
  }

  export(): Uint8Array {
    return this.db.export()
  }

  close(): void {
    persistNow()
    this.db.close()
  }
}

let db: AppDatabase | null = null
let persistTimer: NodeJS.Timeout | null = null
let dbFilePath = ''

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => persistNow(), 250)
}

function persistNow(): void {
  if (!db || !dbFilePath) return
  try {
    const data = db.export()
    writeFileSync(dbFilePath, Buffer.from(data))
  } catch (error) {
    console.error('Failed to persist database', error)
  }
}

export function getDb(): AppDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function initDatabase(): Promise<AppDatabase> {
  const { databaseFile, database } = getAppPaths()
  dbFilePath = databaseFile
  if (!existsSync(database)) mkdirSync(database, { recursive: true })

  const sqlJsEntry = require.resolve('sql.js')
  const wasmPath = join(dirname(sqlJsEntry), 'sql-wasm.wasm')

  const SQL = await initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? wasmPath : join(dirname(sqlJsEntry), file))
  })

  let native: SqlJsDatabase
  if (existsSync(databaseFile)) {
    const fileBuffer = readFileSync(databaseFile)
    native = new SQL.Database(fileBuffer)
  } else {
    native = new SQL.Database()
  }

  db = new AppDatabase(native)
  migrate(db)
  seedSystemPlaylists(db)
  ensureSystemPlaylistCovers(db)
  ensureSettings(db)
  persistNow()
  return db
}

function migrate(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
      year INTEGER,
      genre TEXT,
      cover_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(title, artist_id)
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL,
      album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
      genre TEXT,
      year INTEGER,
      track_number INTEGER,
      disc_number INTEGER,
      duration REAL NOT NULL DEFAULT 0,
      bitrate INTEGER,
      sample_rate INTEGER,
      cover_path TEXT,
      file_size INTEGER,
      file_mtime INTEGER,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played_at TEXT,
      last_position REAL NOT NULL DEFAULT 0,
      missing INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_path TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      system_key TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE(playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      position REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS library_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_scanned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playback_snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at);
    CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at);
  `)

  ensureColumn(database, 'tracks', 'source_type', `TEXT NOT NULL DEFAULT 'local'`)
  removeAiMusicData(database)
}

function ensureColumn(
  database: AppDatabase,
  table: string,
  column: string,
  definition: string
): void {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (rows.some((r) => r.name === column)) return
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

/** One-time cleanup: remove Version 3 AI MUSIC demo tracks/files and tables. */
function removeAiMusicData(database: AppDatabase): void {
  try {
    const rows = database
      .prepare(
        `SELECT id, path FROM tracks
         WHERE COALESCE(source_type, 'local') = 'ai_generated'
            OR path LIKE '%ai-generated%'
            OR path LIKE '%\\generated\\%'
            OR path LIKE '%/generated/%'`
      )
      .all() as Array<{ id: number; path: string }>

    for (const row of rows) {
      database.prepare(`DELETE FROM playlist_tracks WHERE track_id = ?`).run(row.id)
      database.prepare(`DELETE FROM play_history WHERE track_id = ?`).run(row.id)
      database.prepare(`DELETE FROM favorites WHERE track_id = ?`).run(row.id)
      database.prepare(`DELETE FROM tracks WHERE id = ?`).run(row.id)
      if (row.path && existsSync(row.path)) {
        try {
          unlinkSync(row.path)
        } catch {
          /* ignore */
        }
      }
    }

    database.exec(`DROP TABLE IF EXISTS ai_music_plan_versions`)
    database.exec(`DROP TABLE IF EXISTS ai_music_projects`)

    const paths = getAppPaths()
    for (const dir of [
      join(paths.music, 'ai-generated'),
      join(paths.root, 'generated'),
      join(paths.root, 'config'),
      join(paths.root, 'secure')
    ]) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    console.warn('[cleanup] AI MUSIC removal skipped:', error)
  }
}

function seedSystemPlaylists(database: AppDatabase): void {
  database
    .prepare(
      `INSERT OR IGNORE INTO playlists (name, description, is_system, system_key)
       VALUES (?, ?, 1, ?)`
    )
    .run('お気に入り', 'お気に入りに登録した曲', 'favorites')
  database
    .prepare(
      `INSERT OR IGNORE INTO playlists (name, description, is_system, system_key)
       VALUES (?, ?, 1, ?)`
    )
    .run('最近再生した曲', '最近再生した曲', 'recent')
}

function resolveSystemCoverSource(filename: string): string | null {
  const candidates = [
    join(process.cwd(), 'resources', 'system-covers', filename),
    join(app.getAppPath(), 'resources', 'system-covers', filename),
    join(process.resourcesPath || '', 'system-covers', filename)
  ]
  return candidates.find((p) => p && existsSync(p)) ?? null
}

function ensureSystemPlaylistCovers(database: AppDatabase): void {
  const { covers } = getAppPaths()
  if (!existsSync(covers)) mkdirSync(covers, { recursive: true })

  const items = [
    { key: 'favorites', file: 'favorites.png' },
    { key: 'recent', file: 'recent.png' }
  ] as const

  for (const item of items) {
    const src = resolveSystemCoverSource(item.file)
    if (!src) continue
    const dest = join(covers, `system-${item.key}.png`)
    try {
      copyFileSync(src, dest)
      database
        .prepare(`UPDATE playlists SET cover_path = ? WHERE system_key = ?`)
        .run(dest, item.key)
    } catch (error) {
      console.error('Failed to set system playlist cover', item.key, error)
    }
  }
}

function ensureSettings(database: AppDatabase): void {
  const existing = database.prepare('SELECT key FROM settings WHERE key = ?').get('app')
  if (!existing) {
    database
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
      .run('app', JSON.stringify(DEFAULT_SETTINGS))
  }
}

export function getSettings(): AppSettings {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get('app') as
    | { value: string }
    | undefined
  if (!row) return { ...DEFAULT_SETTINGS }
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...partial }
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('app', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(JSON.stringify(next))
  return next
}

export function getPlaybackSnapshot(): PlaybackSnapshot | null {
  const row = getDb().prepare('SELECT data FROM playback_snapshot WHERE id = 1').get() as
    | { data: string }
    | undefined
  if (!row) return null
  try {
    return JSON.parse(row.data) as PlaybackSnapshot
  } catch {
    return null
  }
}

export function savePlaybackSnapshot(snapshot: PlaybackSnapshot): void {
  getDb()
    .prepare(
      `INSERT INTO playback_snapshot (id, data) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`
    )
    .run(JSON.stringify(snapshot))
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
