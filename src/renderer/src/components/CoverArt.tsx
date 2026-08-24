import { useEffect, useState } from 'react'
import { Disc3 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface CoverArtProps {
  coverPath?: string | null
  alt?: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
}

const sizeClass: Record<NonNullable<CoverArtProps['size']>, string> = {
  sm: 'h-12 w-12',
  md: 'h-16 w-16',
  lg: 'h-40 w-40',
  xl: 'h-56 w-56',
  hero: 'h-[320px] w-[320px] max-w-full'
}

export function CoverArt({ coverPath, alt = 'cover', className, size = 'md' }: CoverArtProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!coverPath) {
      setUrl(null)
      return
    }
    void window.musicFlow.getCoverUrl(coverPath).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })
    return () => {
      cancelled = true
    }
  }, [coverPath])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-mf bg-mf-elevated shadow-soft',
        sizeClass[size],
        className
      )}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-mf-elevated to-mf-bg text-mf-muted">
          <Disc3 className="h-1/3 w-1/3 opacity-60" />
        </div>
      )}
    </div>
  )
}
