import { createClient, type Client } from '@libsql/client'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let client: Client | null = null

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
  const schemaPath = join(__dirname, '..', '..', 'turso', 'schema.sql')
  const sql = existsSync(schemaPath)
    ? readFileSync(schemaPath, 'utf8')
    : readFileSync(join(process.cwd(), 'turso', 'schema.sql'), 'utf8')

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
