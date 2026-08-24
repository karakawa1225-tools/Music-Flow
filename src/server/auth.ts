import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'
import { SYSTEM_PLAYLIST_COVERS } from '../shared/systemCovers'
import { getDb } from './db'

const JWT_SECRET = () => process.env.JWT_SECRET || 'music-flow-dev-secret-change-me'

export type AuthUser = { id: string; email: string }

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(user: AuthUser): Promise<string> {
  return jwt.sign({ email: user.email }, JWT_SECRET(), {
    subject: user.id,
    expiresIn: '30d'
  })
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET())
    if (typeof payload === 'string') return null
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

export async function createUser(email: string, password: string, displayName?: string) {
  const db = getDb()
  const id = randomUUID()
  const passwordHash = await hashPassword(password)
  const name = displayName || email.split('@')[0]

  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)`,
    args: [id, email.toLowerCase().trim(), passwordHash, name]
  })

  await db.execute({
    sql: `INSERT INTO playlists (user_id, name, is_system, system_key, cover_path) VALUES (?, 'お気に入り', 1, 'favorites', ?)`,
    args: [id, SYSTEM_PLAYLIST_COVERS.favorites]
  })
  await db.execute({
    sql: `INSERT INTO playlists (user_id, name, is_system, system_key, cover_path) VALUES (?, '最近再生した曲', 1, 'recent', ?)`,
    args: [id, SYSTEM_PLAYLIST_COVERS.recent]
  })
  await db.execute({
    sql: `INSERT INTO user_settings (user_id, settings_json) VALUES (?, '{}')`,
    args: [id]
  })

  return { id, email: email.toLowerCase().trim() }
}

export async function findUserByEmail(email: string) {
  const db = getDb()
  const result = await db.execute({
    sql: `SELECT id, email, password_hash FROM users WHERE email = ? LIMIT 1`,
    args: [email.toLowerCase().trim()]
  })
  const row = result.rows[0]
  if (!row) return null
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash)
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('authorization') || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const queryToken = c.req.query('access_token') || c.req.query('token') || ''
  const token = bearer || queryToken
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const user = await verifyToken(token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('user', user)
  await next()
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser
  }
}
