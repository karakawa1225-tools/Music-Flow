import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile() {
  try {
    const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
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
  } catch {
    /* ignore */
  }
}

loadEnvFile()

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !authToken || authToken === 'REPLACE_ME') {
  console.error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env')
  process.exit(1)
}

const client = createClient({ url, authToken })
const sql = readFileSync(resolve('turso/schema.sql'), 'utf8')
const cleaned = sql
  .split(/\r?\n/)
  .map((line) => {
    const idx = line.indexOf('--')
    return idx >= 0 ? line.slice(0, idx) : line
  })
  .join('\n')

const statements = cleaned
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

for (const statement of statements) {
  await client.execute(statement)
  console.log('applied:', statement.slice(0, 72).replace(/\s+/g, ' '))
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
)
console.log(
  'tables:',
  tables.rows.map((r) => String(r.name)).join(', ')
)
