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
root.use('*', async (_c, next) => {
  await ensureReady()
  await next()
})
root.route('/', createApp())

export default handle(root)
