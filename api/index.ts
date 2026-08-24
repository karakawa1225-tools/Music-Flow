import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { createApp } from '../src/server/app'
import { migrate } from '../src/server/db'

export const config = {
  maxDuration: 60
}

let migrated = false

async function ensureReady() {
  if (migrated) return
  await migrate()
  migrated = true
}

const app = new Hono().basePath('/api')

app.use('*', async (c, next) => {
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

app.route('/', createApp())

export default handle(app)
