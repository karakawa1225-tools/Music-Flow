import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { serve } from '@hono/node-server'
import { bootServer } from './app'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile()

const port = Number(process.env.PORT || 8787)

async function main() {
  const app = await bootServer()
  serve({ fetch: app.fetch, port }, (info) => {
    const rawUrl = (process.env.TURSO_DATABASE_URL || '').trim()
    const remote =
      rawUrl &&
      !rawUrl.includes('YOUR-') &&
      !rawUrl.includes('xxxx') &&
      rawUrl !== 'libsql://YOUR-DB-NAME-YOUR-ORG.turso.io'
    const dbMode = remote ? `Turso (${rawUrl})` : 'local libSQL (data/music-flow.db)'
    console.log(`[MUSIC FLOW API] http://localhost:${info.port}`)
    console.log(`[MUSIC FLOW API] database: ${dbMode}`)
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
