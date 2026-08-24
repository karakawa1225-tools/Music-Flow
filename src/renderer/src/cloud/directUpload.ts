import { put } from '@vercel/blob/client'
import { apiFetch, getToken } from './apiClient'

type UploadConfig = {
  directBlob: boolean
  maxAudioBytes: number
  maxCoverBytes: number
}

type AuthMe = { user: { id: string; email: string } }

let cachedConfig: UploadConfig | null = null
let cachedUserId: string | null = null

export async function getUploadConfig(): Promise<UploadConfig> {
  if (cachedConfig) return cachedConfig
  cachedConfig = await apiFetch<UploadConfig>('/api/upload-config')
  return cachedConfig
}

async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId
  const me = await apiFetch<AuthMe>('/api/auth/me')
  cachedUserId = me.user.id
  return cachedUserId
}

function randomId(): string {
  return crypto.randomUUID()
}

async function requestClientToken(pathname: string, kind: 'audio' | 'cover') {
  return apiFetch<{ clientToken: string; pathname: string }>('/api/blob/token', {
    method: 'POST',
    body: JSON.stringify({ pathname, kind })
  })
}

async function putToBlob(pathname: string, file: File, kind: 'audio' | 'cover', contentType: string) {
  const { clientToken } = await requestClientToken(pathname, kind)
  if (!getToken()) throw new Error('ログインが必要です')

  return put(pathname, file, {
    access: 'public',
    token: clientToken,
    contentType,
    multipart: file.size > 4 * 1024 * 1024
  })
}

export async function uploadTrackFile(
  file: File,
  duration: number,
  options?: { albumTitle?: string; artistName?: string }
) {
  const config = await getUploadConfig()
  if (!config.directBlob) {
    const form = new FormData()
    form.append('file', file)
    form.append('duration', String(duration))
    if (options?.albumTitle) form.append('albumTitle', options.albumTitle)
    if (options?.artistName) form.append('artistName', options.artistName)
    return apiFetch('/api/upload', { method: 'POST', body: form })
  }

  if (file.size > config.maxAudioBytes) {
    throw new Error('ファイルサイズが上限を超えています')
  }

  const userId = await getUserId()
  const pathname = `audio/${userId}/${randomId()}.mp3`
  const blob = await putToBlob(pathname, file, 'audio', file.type || 'audio/mpeg')

  return apiFetch('/api/tracks/register', {
    method: 'POST',
    body: JSON.stringify({
      storagePath: blob.url,
      filename: file.name,
      duration,
      fileSize: file.size,
      albumTitle: options?.albumTitle ?? null,
      artistName: options?.artistName ?? null
    })
  })
}

export async function uploadCoverFile(file: File): Promise<string> {
  const config = await getUploadConfig()
  if (!config.directBlob) {
    const form = new FormData()
    form.append('file', file)
    const result = await apiFetch<{ url: string }>('/api/upload-cover', {
      method: 'POST',
      body: form
    })
    return result.url
  }

  if (file.size > config.maxCoverBytes) {
    throw new Error('画像は 8MB 以下にしてください')
  }

  const extMatch = /\.(png|jpe?g|webp)$/i.exec(file.name)
  const ext = extMatch ? `.${extMatch[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg'
  const userId = await getUserId()
  const pathname = `covers/${userId}/${randomId()}${ext === '.jpeg' ? '.jpg' : ext}`
  const blob = await putToBlob(pathname, file, 'cover', file.type || 'image/jpeg')
  return blob.url
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function run() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(runners)
  return results
}
