import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { randomUUID } from 'crypto'
import { DEFAULT_SETTINGS, type AppSettings, type PlaybackSnapshot } from '../shared/types'
import { authMiddleware, createUser, findUserByEmail, signToken, verifyPassword } from './auth'
import { getDb, migrate, num } from './db'
import { TRACK_JOIN, mapAlbum, mapPlaylist, mapTrack } from './mappers'
import {
  ensureLocalAudioDir,
  resolveLocalCoverPath,
  saveAudioFile,
  saveCoverFile,
  streamAudio
} from './storage'
import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { stream } from 'hono/streaming'

async function ensureArtist(userId: string, name: string): Promise<number> {
  const db = getDb()
  const trimmed = name.trim() || 'Unknown Artist'
  const existing = await db.execute({
    sql: `SELECT id FROM artists WHERE user_id = ? AND name = ? LIMIT 1`,
    args: [userId, trimmed]
  })
  if (existing.rows[0]) return num(existing.rows[0].id)

  const inserted = await db.execute({
    sql: `INSERT INTO artists (user_id, name) VALUES (?, ?) RETURNING id`,
    args: [userId, trimmed]
  })
  return num(inserted.rows[0]?.id)
}

async function ensureAlbum(userId: string, title: string, artistId: number | null): Promise<number> {
  const db = getDb()
  const trimmed = title.trim() || 'Unknown Album'
  const existing = await db.execute({
    sql:
      artistId == null
        ? `SELECT id FROM albums WHERE user_id = ? AND title = ? AND artist_id IS NULL LIMIT 1`
        : `SELECT id FROM albums WHERE user_id = ? AND title = ? AND artist_id = ? LIMIT 1`,
    args: artistId == null ? [userId, trimmed] : [userId, trimmed, artistId]
  })
  if (existing.rows[0]) return num(existing.rows[0].id)

  const inserted = await db.execute({
    sql: `INSERT INTO albums (user_id, title, artist_id) VALUES (?, ?, ?) RETURNING id`,
    args: [userId, trimmed, artistId]
  })
  return num(inserted.rows[0]?.id)
}

async function getTrackForUser(userId: string, trackId: number) {
  const db = getDb()
  const result = await db.execute({
    sql: `${TRACK_JOIN} WHERE t.id = ? AND t.user_id = ? LIMIT 1`,
    args: [trackId, userId]
  })
  return result.rows[0] ? mapTrack(result.rows[0] as Record<string, unknown>) : null
}

async function createTrackRecord(input: {
  userId: string
  title: string
  filename: string
  duration: number
  storagePath: string
  fileSize: number
}) {
  const artistId = await ensureArtist(input.userId, 'Unknown Artist')
  const albumId = await ensureAlbum(input.userId, 'Unknown Album', artistId)
  const db = getDb()
  const inserted = await db.execute({
    sql: `
      INSERT INTO tracks (
        user_id, title, filename, artist_id, album_id, duration, storage_path, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [
      input.userId,
      input.title,
      input.filename,
      artistId,
      albumId,
      input.duration || 0,
      input.storagePath,
      input.fileSize
    ]
  })
  return getTrackForUser(input.userId, num(inserted.rows[0]?.id))
}

function blobDirectEnabled(): boolean {
  return Boolean((process.env.BLOB_READ_WRITE_TOKEN || '').trim())
}

function isOwnedBlobUrl(url: string, userId: string, kind: 'audio' | 'covers'): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const { pathname } = new URL(url)
    const decoded = decodeURIComponent(pathname)
    const marker = `/${kind}/${userId}/`
    return decoded.includes(marker) || pathname.includes(marker)
  } catch {
    return false
  }
}

async function playlistExtras(userId: string, playlist: ReturnType<typeof mapPlaylist>) {
  const db = getDb()
  if (playlist.systemKey === 'favorites') {
    const result = await db.execute({
      sql: `SELECT COUNT(*) AS c, COALESCE(SUM(duration), 0) AS d FROM tracks WHERE user_id = ? AND is_favorite = 1`,
      args: [userId]
    })
    return { trackCount: num(result.rows[0]?.c), totalDuration: num(result.rows[0]?.d) }
  }
  if (playlist.systemKey === 'recent') {
    const result = await db.execute({
      sql: `SELECT COUNT(*) AS c, COALESCE(SUM(duration), 0) AS d FROM tracks WHERE user_id = ? AND last_played_at IS NOT NULL`,
      args: [userId]
    })
    return { trackCount: num(result.rows[0]?.c), totalDuration: num(result.rows[0]?.d) }
  }
  const result = await db.execute({
    sql: `
      SELECT COUNT(*) AS c, COALESCE(SUM(t.duration), 0) AS d
      FROM playlist_tracks pt
      JOIN tracks t ON t.id = pt.track_id
      WHERE pt.playlist_id = ?
    `,
    args: [playlist.id]
  })
  return { trackCount: num(result.rows[0]?.c), totalDuration: num(result.rows[0]?.d) }
}

export function createApp() {
  const app = new Hono()

  app.use(
    '*',
    cors({
      origin: (origin) => origin || '*',
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  )

  app.get('/health', (c) =>
    c.json({
      ok: true,
      db: process.env.TURSO_DATABASE_URL ? 'turso' : 'local-libsql'
    })
  )

  app.post('/auth/signup', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; displayName?: string }>()
    const email = body.email?.trim()
    const password = body.password || ''
    if (!email || password.length < 6) {
      return c.json({ error: 'メールと6文字以上のパスワードが必要です' }, 400)
    }
    const existing = await findUserByEmail(email)
    if (existing) return c.json({ error: 'このメールは既に登録されています' }, 409)
    const user = await createUser(email, password, body.displayName)
    const token = await signToken(user)
    return c.json({ token, user: { id: user.id, email: user.email } })
  })

  app.post('/auth/signin', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>()
    const email = body.email?.trim()
    const password = body.password || ''
    if (!email || !password) return c.json({ error: 'メールとパスワードが必要です' }, 400)
    const found = await findUserByEmail(email)
    if (!found || !(await verifyPassword(password, found.passwordHash))) {
      return c.json({ error: 'メールまたはパスワードが違います' }, 401)
    }
    const user = { id: found.id, email: found.email }
    const token = await signToken(user)
    return c.json({ token, user })
  })

  app.get('/auth/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ user })
  })

  const api = new Hono()
  api.use('*', authMiddleware)

  api.get('/tracks', async (c) => {
    const user = c.get('user')
    const limit = Math.min(Number(c.req.query('limit') || 5000), 10000)
    const offset = Math.max(Number(c.req.query('offset') || 0), 0)
    const db = getDb()
    const result = await db.execute({
      sql: `${TRACK_JOIN} WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      args: [user.id, limit, offset]
    })
    return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
  })

  api.get('/tracks/recent/played', async (c) => {
    const user = c.get('user')
    const limit = Math.min(Number(c.req.query('limit') || 24), 200)
    const db = getDb()
    const result = await db.execute({
      sql: `${TRACK_JOIN} WHERE t.user_id = ? AND t.last_played_at IS NOT NULL ORDER BY t.last_played_at DESC LIMIT ?`,
      args: [user.id, limit]
    })
    return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
  })

  api.get('/tracks/recent/added', async (c) => {
    const user = c.get('user')
    const limit = Math.min(Number(c.req.query('limit') || 24), 200)
    const db = getDb()
    const result = await db.execute({
      sql: `${TRACK_JOIN} WHERE t.user_id = ? ORDER BY t.created_at DESC LIMIT ?`,
      args: [user.id, limit]
    })
    return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
  })

  api.get('/tracks/:id', async (c) => {
    const track = await getTrackForUser(c.get('user').id, Number(c.req.param('id')))
    if (!track) return c.json({ error: 'Not found' }, 404)
    return c.json(track)
  })

  api.post('/tracks/:id/favorite', async (c) => {
    const user = c.get('user')
    const trackId = Number(c.req.param('id'))
    const db = getDb()
    const current = await db.execute({
      sql: `SELECT is_favorite FROM tracks WHERE id = ? AND user_id = ?`,
      args: [trackId, user.id]
    })
    if (!current.rows[0]) return c.json({ error: 'Not found' }, 404)
    const next = num(current.rows[0].is_favorite) ? 0 : 1
    await db.execute({
      sql: `UPDATE tracks SET is_favorite = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [next, trackId, user.id]
    })
    const track = await getTrackForUser(user.id, trackId)
    return c.json(track)
  })

  api.post('/tracks/:id/play', async (c) => {
    const user = c.get('user')
    const trackId = Number(c.req.param('id'))
    const body = await c.req.json<{ position?: number }>().catch(() => ({ position: 0 }))
    const db = getDb()
    await db.execute({
      sql: `
        UPDATE tracks
        SET play_count = play_count + 1,
            last_played_at = datetime('now'),
            last_position = ?,
            updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `,
      args: [body.position ?? 0, trackId, user.id]
    })
    return c.json({ ok: true })
  })

  api.post('/tracks/:id/position', async (c) => {
    const user = c.get('user')
    const trackId = Number(c.req.param('id'))
    const body = await c.req.json<{ position: number }>()
    const db = getDb()
    await db.execute({
      sql: `UPDATE tracks SET last_position = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [body.position ?? 0, trackId, user.id]
    })
    return c.json({ ok: true })
  })

  api.get('/tracks/:id/stream', async (c) => {
    const user = c.get('user')
    const track = await getTrackForUser(user.id, Number(c.req.param('id')))
    if (!track) return c.json({ error: 'Not found' }, 404)
    return streamAudio(c, track.path)
  })

  api.get('/upload-config', (c) =>
    c.json({
      directBlob: blobDirectEnabled(),
      maxAudioBytes: 200 * 1024 * 1024,
      maxCoverBytes: 8 * 1024 * 1024
    })
  )

  api.post('/blob/token', async (c) => {
    if (!blobDirectEnabled()) {
      return c.json({ error: 'Blob direct upload is not configured' }, 503)
    }
    const user = c.get('user')
    const body = await c.req.json<{ pathname?: string; kind?: 'audio' | 'cover' }>()
    const kind = body.kind === 'cover' ? 'cover' : 'audio'
    const pathname = (body.pathname || '').replace(/^\/+/, '')
    const prefix = kind === 'cover' ? `covers/${user.id}/` : `audio/${user.id}/`
    if (!pathname.startsWith(prefix)) {
      return c.json({ error: 'Invalid upload path' }, 400)
    }
    if (pathname.includes('..') || pathname.length > 400) {
      return c.json({ error: 'Invalid upload path' }, 400)
    }

    try {
      const clientToken = await generateClientTokenFromReadWriteToken({
        pathname,
        addRandomSuffix: false,
        allowOverwrite: false,
        maximumSizeInBytes: kind === 'cover' ? 8 * 1024 * 1024 : 200 * 1024 * 1024,
        allowedContentTypes:
          kind === 'cover'
            ? ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
            : ['audio/mpeg', 'audio/mp3', 'application/octet-stream'],
        validUntil: Date.now() + 60 * 60 * 1000
      })
      return c.json({ clientToken, pathname })
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to create upload token'
        },
        500
      )
    }
  })

  api.post('/tracks/register', async (c) => {
    const user = c.get('user')
    const body = await c.req.json<{
      storagePath?: string
      filename?: string
      duration?: number
      fileSize?: number
    }>()
    const storagePath = (body.storagePath || '').trim()
    const filename = (body.filename || '').trim()
    if (!storagePath || !filename) {
      return c.json({ error: 'storagePath and filename are required' }, 400)
    }
    if (!/\.mp3$/i.test(filename)) {
      return c.json({ error: 'MP3のみ対応しています' }, 400)
    }
    if (!isOwnedBlobUrl(storagePath, user.id, 'audio')) {
      return c.json({ error: 'Invalid storage URL' }, 400)
    }

    const title = filename.replace(/\.[^.]+$/, '').trim() || filename
    const track = await createTrackRecord({
      userId: user.id,
      title,
      filename,
      duration: Number(body.duration) || 0,
      storagePath,
      fileSize: Math.max(0, Number(body.fileSize) || 0)
    })
    return c.json(track)
  })

  api.post('/upload', async (c) => {
    const user = c.get('user')
    ensureLocalAudioDir()
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400)
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') {
      return c.json({ error: 'MP3のみ対応しています' }, 400)
    }

    const duration = Number(form.get('duration') || 0)
    const id = randomUUID()
    const relativePath = `${user.id}/${id}.mp3`
    const buffer = Buffer.from(await file.arrayBuffer())
    let storagePath: string
    try {
      storagePath = await saveAudioFile(relativePath, buffer, file.type || 'audio/mpeg')
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'アップロードに失敗しました' },
        500
      )
    }

    const title = file.name.replace(/\.[^.]+$/, '').trim() || file.name
    const track = await createTrackRecord({
      userId: user.id,
      title,
      filename: file.name,
      duration,
      storagePath,
      fileSize: buffer.length
    })
    return c.json(track)
  })

  api.post('/upload-cover', async (c) => {
    const user = c.get('user')
    const form = await c.req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400)

    const ext = extname(file.name).toLowerCase()
    const allowedExt = ['.png', '.jpg', '.jpeg', '.webp']
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
    if (!allowedExt.includes(ext) && !allowedTypes.includes(file.type)) {
      return c.json({ error: '画像は PNG / JPEG / WebP のみ対応しています' }, 400)
    }

    const id = randomUUID()
    const safeExt = allowedExt.includes(ext) ? ext : '.jpg'
    const relativePath = `${user.id}/${id}${safeExt}`
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > 8 * 1024 * 1024) {
      return c.json({ error: '画像は 8MB 以下にしてください' }, 400)
    }

    let url: string
    try {
      url = await saveCoverFile(relativePath, buffer, file.type || 'image/jpeg')
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'カバー画像のアップロードに失敗しました' },
        500
      )
    }
    return c.json({ url })
  })

  api.get('/covers', async (c) => {
    const path = c.req.query('path') || ''
    if (/^https?:\/\//i.test(path)) return c.redirect(path, 302)
    const abs = resolveLocalCoverPath(path)
    if (!abs) return c.json({ error: 'Not found' }, 404)
    const user = c.get('user')
    if (!path.startsWith(`covers/${user.id}/`)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    const stat = statSync(abs)
    const type =
      abs.endsWith('.png') ? 'image/png' : abs.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    c.header('Content-Type', type)
    c.header('Content-Length', String(stat.size))
    c.header('Cache-Control', 'private, max-age=86400')
    return stream(c, async (s) => {
      const nodeStream = createReadStream(abs)
      for await (const chunk of nodeStream) {
        await s.write(chunk)
      }
    })
  })

  api.get('/stats', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const [tracks, albums, artists, playlists] = await Promise.all([
      db.execute({
        sql: `SELECT COUNT(*) AS c, COALESCE(SUM(duration), 0) AS d FROM tracks WHERE user_id = ?`,
        args: [user.id]
      }),
      db.execute({ sql: `SELECT COUNT(*) AS c FROM albums WHERE user_id = ?`, args: [user.id] }),
      db.execute({ sql: `SELECT COUNT(*) AS c FROM artists WHERE user_id = ?`, args: [user.id] }),
      db.execute({ sql: `SELECT COUNT(*) AS c FROM playlists WHERE user_id = ?`, args: [user.id] })
    ])
    return c.json({
      trackCount: num(tracks.rows[0]?.c),
      albumCount: num(albums.rows[0]?.c),
      artistCount: num(artists.rows[0]?.c),
      playlistCount: num(playlists.rows[0]?.c),
      totalDuration: num(tracks.rows[0]?.d)
    })
  })

  api.get('/albums/recent/list', async (c) => {
    const user = c.get('user')
    const limit = Math.min(Number(c.req.query('limit') || 12), 100)
    const db = getDb()
    const result = await db.execute({
      sql: `
        SELECT al.*, a.name AS artist_name
        FROM albums al
        LEFT JOIN artists a ON a.id = al.artist_id
        WHERE al.user_id = ?
        ORDER BY al.created_at DESC
        LIMIT ?
      `,
      args: [user.id, limit]
    })
    return c.json(result.rows.map((row) => mapAlbum(row as Record<string, unknown>)))
  })

  api.get('/albums', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `
        SELECT al.*, a.name AS artist_name
        FROM albums al
        LEFT JOIN artists a ON a.id = al.artist_id
        WHERE al.user_id = ?
        ORDER BY al.created_at DESC
      `,
      args: [user.id]
    })
    return c.json(result.rows.map((row) => mapAlbum(row as Record<string, unknown>)))
  })

  api.get('/albums/:id', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `
        SELECT al.*, a.name AS artist_name
        FROM albums al
        LEFT JOIN artists a ON a.id = al.artist_id
        WHERE al.id = ? AND al.user_id = ?
      `,
      args: [Number(c.req.param('id')), user.id]
    })
    if (!result.rows[0]) return c.json({ error: 'Not found' }, 404)
    return c.json(mapAlbum(result.rows[0] as Record<string, unknown>))
  })

  api.get('/albums/:id/tracks', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `${TRACK_JOIN} WHERE t.album_id = ? AND t.user_id = ? ORDER BY t.disc_number, t.track_number, t.id`,
      args: [Number(c.req.param('id')), user.id]
    })
    return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
  })

  api.get('/playlists', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM playlists WHERE user_id = ? ORDER BY is_system DESC, name`,
      args: [user.id]
    })
    const playlists = await Promise.all(
      result.rows.map(async (row) => {
        const base = mapPlaylist(row as Record<string, unknown>)
        const extras = await playlistExtras(user.id, base)
        return { ...base, ...extras }
      })
    )
    return c.json(playlists)
  })

  api.get('/playlists/:id', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT * FROM playlists WHERE id = ? AND user_id = ?`,
      args: [Number(c.req.param('id')), user.id]
    })
    if (!result.rows[0]) return c.json({ error: 'Not found' }, 404)
    const base = mapPlaylist(result.rows[0] as Record<string, unknown>)
    const extras = await playlistExtras(user.id, base)
    return c.json({ ...base, ...extras })
  })

  api.get('/playlists/:id/tracks', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const playlistResult = await db.execute({
      sql: `SELECT * FROM playlists WHERE id = ? AND user_id = ?`,
      args: [Number(c.req.param('id')), user.id]
    })
    if (!playlistResult.rows[0]) return c.json({ error: 'Not found' }, 404)
    const playlist = mapPlaylist(playlistResult.rows[0] as Record<string, unknown>)

    if (playlist.systemKey === 'favorites') {
      const result = await db.execute({
        sql: `${TRACK_JOIN} WHERE t.user_id = ? AND t.is_favorite = 1 ORDER BY t.updated_at DESC`,
        args: [user.id]
      })
      return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
    }
    if (playlist.systemKey === 'recent') {
      const result = await db.execute({
        sql: `${TRACK_JOIN} WHERE t.user_id = ? AND t.last_played_at IS NOT NULL ORDER BY t.last_played_at DESC LIMIT 100`,
        args: [user.id]
      })
      return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
    }

    const result = await db.execute({
      sql: `
        ${TRACK_JOIN}
        JOIN playlist_tracks pt ON pt.track_id = t.id
        WHERE pt.playlist_id = ? AND t.user_id = ?
        ORDER BY pt.position
      `,
      args: [playlist.id, user.id]
    })
    return c.json(result.rows.map((row) => mapTrack(row as Record<string, unknown>)))
  })

  api.post('/playlists', async (c) => {
    const user = c.get('user')
    const body = await c.req.json<{ name: string; description?: string; coverPath?: string | null }>()
    const db = getDb()
    const inserted = await db.execute({
      sql: `
        INSERT INTO playlists (user_id, name, description, cover_path, is_system)
        VALUES (?, ?, ?, ?, 0)
        RETURNING *
      `,
      args: [user.id, body.name, body.description ?? null, body.coverPath ?? null]
    })
    return c.json({ ...mapPlaylist(inserted.rows[0] as Record<string, unknown>), trackCount: 0, totalDuration: 0 })
  })

  api.patch('/playlists/:id', async (c) => {
    const user = c.get('user')
    const body = await c.req.json<{ name?: string; description?: string | null; coverPath?: string | null }>()
    const db = getDb()
    await db.execute({
      sql: `
        UPDATE playlists
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            cover_path = COALESCE(?, cover_path),
            updated_at = datetime('now')
        WHERE id = ? AND user_id = ? AND is_system = 0
      `,
      args: [body.name ?? null, body.description ?? null, body.coverPath ?? null, Number(c.req.param('id')), user.id]
    })
    const result = await db.execute({
      sql: `SELECT * FROM playlists WHERE id = ? AND user_id = ?`,
      args: [Number(c.req.param('id')), user.id]
    })
    if (!result.rows[0]) return c.json({ error: 'Not found' }, 404)
    return c.json(mapPlaylist(result.rows[0] as Record<string, unknown>))
  })

  api.delete('/playlists/:id', async (c) => {
    const user = c.get('user')
    const db = getDb()
    await db.execute({
      sql: `DELETE FROM playlists WHERE id = ? AND user_id = ? AND is_system = 0`,
      args: [Number(c.req.param('id')), user.id]
    })
    return c.json({ ok: true })
  })

  api.post('/playlists/:id/tracks', async (c) => {
    const user = c.get('user')
    const playlistId = Number(c.req.param('id'))
    const body = await c.req.json<{ trackIds: number[] }>()
    const db = getDb()
    const owned = await db.execute({
      sql: `SELECT id FROM playlists WHERE id = ? AND user_id = ? AND is_system = 0`,
      args: [playlistId, user.id]
    })
    if (!owned.rows[0]) return c.json({ error: 'Not found' }, 404)

    const maxPos = await db.execute({
      sql: `SELECT COALESCE(MAX(position), -1) AS p FROM playlist_tracks WHERE playlist_id = ?`,
      args: [playlistId]
    })
    let position = num(maxPos.rows[0]?.p) + 1
    for (const trackId of body.trackIds || []) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)`,
        args: [playlistId, trackId, position++]
      })
    }
    return c.json({ ok: true })
  })

  api.delete('/playlists/:id/tracks/:trackId', async (c) => {
    const user = c.get('user')
    const playlistId = Number(c.req.param('id'))
    const trackId = Number(c.req.param('trackId'))
    const db = getDb()
    const owned = await db.execute({
      sql: `SELECT id FROM playlists WHERE id = ? AND user_id = ? AND is_system = 0`,
      args: [playlistId, user.id]
    })
    if (!owned.rows[0]) return c.json({ error: 'Not found' }, 404)
    await db.execute({
      sql: `DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`,
      args: [playlistId, trackId]
    })
    return c.json({ ok: true })
  })

  api.put('/playlists/:id/reorder', async (c) => {
    const user = c.get('user')
    const playlistId = Number(c.req.param('id'))
    const body = await c.req.json<{ trackIds: number[] }>()
    const db = getDb()
    const owned = await db.execute({
      sql: `SELECT id FROM playlists WHERE id = ? AND user_id = ? AND is_system = 0`,
      args: [playlistId, user.id]
    })
    if (!owned.rows[0]) return c.json({ error: 'Not found' }, 404)
    for (let i = 0; i < (body.trackIds || []).length; i++) {
      await db.execute({
        sql: `UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?`,
        args: [i, playlistId, body.trackIds[i]]
      })
    }
    return c.json({ ok: true })
  })

  api.get('/search', async (c) => {
    const user = c.get('user')
    const q = (c.req.query('q') || '').trim()
    if (!q) return c.json({ tracks: [], albums: [], playlists: [], artists: [] })
    const like = `%${q}%`
    const db = getDb()
    const [tracks, albums, playlists, artists] = await Promise.all([
      db.execute({
        sql: `${TRACK_JOIN} WHERE t.user_id = ? AND t.title LIKE ? LIMIT 40`,
        args: [user.id, like]
      }),
      db.execute({
        sql: `
          SELECT al.*, a.name AS artist_name FROM albums al
          LEFT JOIN artists a ON a.id = al.artist_id
          WHERE al.user_id = ? AND al.title LIKE ? LIMIT 20
        `,
        args: [user.id, like]
      }),
      db.execute({
        sql: `SELECT * FROM playlists WHERE user_id = ? AND name LIKE ? LIMIT 20`,
        args: [user.id, like]
      }),
      db.execute({
        sql: `SELECT id, name, created_at FROM artists WHERE user_id = ? AND name LIKE ? LIMIT 20`,
        args: [user.id, like]
      })
    ])
    return c.json({
      tracks: tracks.rows.map((row) => mapTrack(row as Record<string, unknown>)),
      albums: albums.rows.map((row) => mapAlbum(row as Record<string, unknown>)),
      playlists: playlists.rows.map((row) => mapPlaylist(row as Record<string, unknown>)),
      artists: artists.rows.map((row) => ({
        id: num(row.id),
        name: String(row.name),
        createdAt: String(row.created_at)
      }))
    })
  })

  api.get('/settings', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT settings_json FROM user_settings WHERE user_id = ?`,
      args: [user.id]
    })
    const partial = JSON.parse(String(result.rows[0]?.settings_json || '{}')) as Partial<AppSettings>
    return c.json({ ...DEFAULT_SETTINGS, ...partial })
  })

  api.patch('/settings', async (c) => {
    const user = c.get('user')
    const partial = await c.req.json<Partial<AppSettings>>()
    const db = getDb()
    const currentResult = await db.execute({
      sql: `SELECT settings_json FROM user_settings WHERE user_id = ?`,
      args: [user.id]
    })
    const current = {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(String(currentResult.rows[0]?.settings_json || '{}')) as Partial<AppSettings>)
    }
    const next = { ...current, ...partial }
    await db.execute({
      sql: `
        INSERT INTO user_settings (user_id, settings_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at
      `,
      args: [user.id, JSON.stringify(next)]
    })
    return c.json(next)
  })

  api.get('/playback-snapshot', async (c) => {
    const user = c.get('user')
    const db = getDb()
    const result = await db.execute({
      sql: `SELECT snapshot_json FROM playback_snapshots WHERE user_id = ?`,
      args: [user.id]
    })
    if (!result.rows[0]) return c.json(null)
    return c.json(JSON.parse(String(result.rows[0].snapshot_json)) as PlaybackSnapshot)
  })

  api.put('/playback-snapshot', async (c) => {
    const user = c.get('user')
    const snapshot = await c.req.json<PlaybackSnapshot>()
    const db = getDb()
    await db.execute({
      sql: `
        INSERT INTO playback_snapshots (user_id, snapshot_json, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at
      `,
      args: [user.id, JSON.stringify(snapshot)]
    })
    return c.json({ ok: true })
  })

  app.route('/', api)
  return app
}

export async function bootServer() {
  ensureLocalAudioDir()
  await migrate()
  const app = new Hono().basePath('/api')
  app.route('/', createApp())
  return app
}
