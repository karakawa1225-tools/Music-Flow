import { existsSync, readdirSync, statSync } from 'fs'
import { extname, join } from 'path'
import { BrowserWindow } from 'electron'
import { IPC } from '../../shared/constants'
import type { ScanProgress } from '../../shared/types'
import {
  addLibraryFolder,
  listLibraryFolders,
  markTrackMissing,
  touchLibraryFolder,
  upsertTrackFromFile
} from '../database/repositories'
import { getDb } from '../database'

const AUDIO_EXTS = new Set(['.mp3', '.mpeg', '.mpga'])

function collectMp3Files(root: string): string[] {
  const results: string[] = []
  const stack = [root]

  while (stack.length) {
    const current = stack.pop()!
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue
        stack.push(full)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (AUDIO_EXTS.has(ext)) results.push(full)
      }
    }
  }

  return results
}

function emitProgress(win: BrowserWindow | null, progress: ScanProgress): void {
  win?.webContents.send(IPC.SCAN_PROGRESS, progress)
}

export async function scanFolders(
  folderPaths: string[],
  win: BrowserWindow | null
): Promise<{ imported: number; failed: number; missing: number }> {
  const allFiles: string[] = []
  for (const folder of folderPaths) {
    if (!existsSync(folder)) continue
    allFiles.push(...collectMp3Files(folder))
  }

  const total = allFiles.length
  let imported = 0
  let failed = 0

  emitProgress(win, {
    phase: 'scanning',
    current: 0,
    total,
    message: '音楽ファイルを解析しています...'
  })

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i]
    try {
      const stats = statSync(filePath)
      const track = await upsertTrackFromFile(filePath, {
        size: stats.size,
        mtimeMs: stats.mtimeMs
      })
      if (track) imported += 1
      else failed += 1
    } catch {
      failed += 1
    }

    if (i % 5 === 0 || i === allFiles.length - 1) {
      emitProgress(win, {
        phase: 'parsing',
        current: i + 1,
        total,
        message: '音楽ファイルを解析しています...',
        folderPath: filePath
      })
      await new Promise((r) => setImmediate(r))
    }
  }

  // Mark missing files that were under scanned folders but no longer exist
  let missing = 0
  const tracked = getDb()
    .prepare('SELECT id, path FROM tracks')
    .all() as Array<{ id: number; path: string }>

  for (const row of tracked) {
    const underScanned = folderPaths.some(
      (folder) => row.path === folder || row.path.startsWith(folder + '\\') || row.path.startsWith(folder + '/')
    )
    if (!underScanned) continue
    if (!existsSync(row.path)) {
      markTrackMissing(row.id, true)
      missing += 1
    }
  }

  for (const folder of listLibraryFolders()) {
    if (folderPaths.includes(folder.path)) touchLibraryFolder(folder.id)
  }

  emitProgress(win, {
    phase: 'done',
    current: total,
    total,
    message: `スキャン完了: ${imported} 曲`
  })

  return { imported, failed, missing }
}

export async function addAndScanFolder(
  folderPath: string,
  win: BrowserWindow | null
): Promise<{ imported: number; failed: number; missing: number }> {
  addLibraryFolder(folderPath)
  return scanFolders([folderPath], win)
}

export async function importMp3Files(
  filePaths: string[],
  win: BrowserWindow | null
): Promise<{ imported: number; failed: number }> {
  const files = filePaths.filter((p) => AUDIO_EXTS.has(extname(p).toLowerCase()))
  let imported = 0
  let failed = 0

  emitProgress(win, {
    phase: 'parsing',
    current: 0,
    total: files.length,
    message: 'MP3を追加しています...'
  })

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    try {
      if (!existsSync(filePath)) {
        failed += 1
        continue
      }
      const stats = statSync(filePath)
      const track = await upsertTrackFromFile(filePath, {
        size: stats.size,
        mtimeMs: stats.mtimeMs
      })
      if (track) imported += 1
      else failed += 1
    } catch {
      failed += 1
    }

    emitProgress(win, {
      phase: 'parsing',
      current: i + 1,
      total: files.length,
      message: 'MP3を追加しています...',
      folderPath: filePath
    })
    await new Promise((r) => setImmediate(r))
  }

  emitProgress(win, {
    phase: 'done',
    current: files.length,
    total: files.length,
    message: `${imported} 曲を追加しました`
  })

  return { imported, failed }
}
