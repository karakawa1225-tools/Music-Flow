import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

export interface AppPaths {
  root: string
  database: string
  databaseFile: string
  music: string
  covers: string
  playlists: string
  cache: string
  logs: string
}

let cached: AppPaths | null = null

export function getAppPaths(): AppPaths {
  if (cached) return cached

  const root = join(app.getPath('userData'), 'MUSIC FLOW')
  const database = join(root, 'database')
  const paths: AppPaths = {
    root,
    database,
    databaseFile: join(database, 'music-flow.db'),
    music: join(root, 'music'),
    covers: join(root, 'covers'),
    playlists: join(root, 'playlists'),
    cache: join(root, 'cache'),
    logs: join(root, 'logs')
  }

  for (const dir of [
    paths.root,
    paths.database,
    paths.music,
    paths.covers,
    paths.playlists,
    paths.cache,
    paths.logs
  ]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  cached = paths
  return paths
}
