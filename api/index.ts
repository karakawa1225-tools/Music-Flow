import type { IncomingMessage, ServerResponse } from 'http'
import { getRequestListener } from '@hono/node-server'
import { Hono } from 'hono'
import { createApp } from '../src/server/app'
import { migrate } from '../src/server/db'

export const config = {
  maxDuration: 60
}

let migrated = false
let listener: ReturnType<typeof getRequestListener> | null = null

async function getListener() {
  if (!migrated) {
    await migrate()
    migrated = true
  }
  if (!listener) {
    const app = new Hono().basePath('/api')
    app.route('/', createApp())
    listener = getRequestListener(app.fetch)
  }
  return listener
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const run = await getListener()
    await run(req, res)
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'API handler failed',
          detail: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }
}
