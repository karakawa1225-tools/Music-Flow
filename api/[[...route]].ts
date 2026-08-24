import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { createApp } from '../src/server/app'
import { migrate } from '../src/server/db'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60
}

let migrated = false

async function ensureReady() {
  if (migrated) return
  await migrate()
  migrated = true
}

const root = new Hono()

root.use('*', async (c, next) => {
  // Dedicated /api/health.ts handles health without this bundle
  try {
    await ensureReady()
  } catch (error) {
    return c.json(
      {
        error: 'Database migration failed',
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    )
  }
  await next()
})

root.route('/', createApp())

export default handle(root)
