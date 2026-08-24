/** Public static covers for built-in playlists (web `public/system-covers`). */
export const SYSTEM_PLAYLIST_COVERS: Record<string, string> = {
  favorites: '/system-covers/favorites.png',
  recent: '/system-covers/recent.png'
}

export function resolveSystemPlaylistCover(
  systemKey: string | null | undefined,
  coverPath: string | null | undefined
): string | null {
  if (systemKey && SYSTEM_PLAYLIST_COVERS[systemKey]) {
    return SYSTEM_PLAYLIST_COVERS[systemKey]
  }
  return coverPath ?? null
}
