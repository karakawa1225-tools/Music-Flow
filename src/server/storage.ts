import { put } from '@vercel/blob'
import { createReadStream, existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import type { Context } from 'hono'
import { stream } from 'hono/streaming'

const AUDIO_DIR = resolve(process.cwd(), 'data', 'audio')

export function useBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN) || process.env.VERCEL === '1'
}

export async function saveAudioFile(
  relativePath: string,
  buffer: Buffer,
  contentType = 'audio/mpeg'
): Promise<string> {
  if (useBlobStorage()) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error(
        'Vercel Blob が未設定です。Vercel ダッシュボードで Blob Store を作成し、BLOB_READ_WRITE_TOKEN を設定してください。'
      )
    }
    const result = await put(`audio/${relativePath}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false
    })
    return result.url
  }

  const absPath = join(AUDIO_DIR, relativePath)
  mkdirSync(resolve(absPath, '..'), { recursive: true })
  writeFileSync(absPath, buffer)
  return relativePath
}

export async function streamAudio(c: Context, storagePath: string) {
  if (/^https?:\/\//i.test(storagePath)) {
    // Public Blob / CDN URL — redirect so Range seeks work in the browser
    return c.redirect(storagePath, 302)
  }

  const filePath = resolve(AUDIO_DIR, storagePath)
  if (!existsSync(filePath)) return c.json({ error: 'File missing' }, 404)

  const stat = statSync(filePath)
  const range = c.req.header('range')
  c.header('Accept-Ranges', 'bytes')
  c.header('Content-Type', 'audio/mpeg')

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    if (!match) return c.text('Invalid Range', 416)
    const start = match[1] ? Number(match[1]) : 0
    let end = match[2] ? Number(match[2]) : stat.size - 1
    end = Math.min(end, stat.size - 1)
    if (start >= stat.size || start > end) return c.text('Range Not Satisfiable', 416)
    const chunkSize = end - start + 1
    c.status(206)
    c.header('Content-Range', `bytes ${start}-${end}/${stat.size}`)
    c.header('Content-Length', String(chunkSize))
    return stream(c, async (s) => {
      const nodeStream = createReadStream(filePath, { start, end })
      for await (const chunk of nodeStream) {
        await s.write(chunk)
      }
    })
  }

  c.header('Content-Length', String(stat.size))
  return stream(c, async (s) => {
    const nodeStream = createReadStream(filePath)
    for await (const chunk of nodeStream) {
      await s.write(chunk)
    }
  })
}

export function ensureLocalAudioDir() {
  if (!useBlobStorage()) mkdirSync(AUDIO_DIR, { recursive: true })
}
