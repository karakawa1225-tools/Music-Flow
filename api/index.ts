import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { createApp } from '../src/server/app'
import { migrate } from '../src/server/db'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60
}

let migrated = false
let migrateError: string | null = null

async function ensureReady() {
  if (migrated) return
  try {
    await migrate()
    migrated = true
    migrateError = null
  } catch (error) {
    migrateError = error instanceof Error ? error.message : String(error)
    throw error
  }
}

const root = new Hono()

root.get('/api/health', (c) =>
  c.json({
    ok: true,
    db: process.env.TURSO_DATABASE_URL ? 'turso' : 'local-libsql',
    migrated,
    migrateError
  })
)

root.use('/api/*', async (_c, next) => {
  // health already handled above
  await ensureReady()
  await next()
})

root.route('/', createApp())

export default handle(root)
