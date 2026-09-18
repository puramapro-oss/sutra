const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? ''

export type MediaFormat = '9:16' | '16:9' | '1:1'

interface PexelsVideoFile {
  id: number
  quality: string
  link: string
  width: number
  height: number
  file_type?: string
  fps?: number
}

interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  user?: { id: number; name: string; url: string }
  video_files: PexelsVideoFile[]
}

interface PexelsPhoto {
  id: number
  url: string
  width: number
  height: number
  photographer?: string
  photographer_url?: string
  src: {
    original: string
    large2x?: string
    large: string
  }
}

export interface PexelsVideoResult {
  id: number
  url: string
  duration: number
  width: number
  height: number
  sourcePage: string
  author: string | null
  authorUrl: string | null
  provider: 'pexels'
}

export interface PexelsImageResult {
  id: number
  url: string
  width: number
  height: number
  sourcePage: string
  author: string | null
  authorUrl: string | null
  provider: 'pexels'
}

function orientationFor(format: MediaFormat): 'landscape' | 'portrait' | 'square' {
  if (format === '9:16') return 'portrait'
  if (format === '1:1') return 'square'
  return 'landscape'
}

function targetRatio(format: MediaFormat): number {
  if (format === '9:16') return 9 / 16
  if (format === '1:1') return 1
  return 16 / 9
}

function selectBestVideoFile(
  files: PexelsVideoFile[],
  format: MediaFormat,
  minWidth: number,
  minHeight: number,
): PexelsVideoFile | undefined {
  const ratio = targetRatio(format)
  return files
    .filter((file) => file.link && file.width > 0 && file.height > 0)
    .sort((a, b) => {
      const aEnough = a.width >= minWidth && a.height >= minHeight ? 1 : 0
      const bEnough = b.width >= minWidth && b.height >= minHeight ? 1 : 0
      if (aEnough !== bEnough) return bEnough - aEnough

      const aRatioPenalty = Math.abs(a.width / a.height - ratio)
      const bRatioPenalty = Math.abs(b.width / b.height - ratio)
      if (Math.abs(aRatioPenalty - bRatioPenalty) > 0.02) {
        return aRatioPenalty - bRatioPenalty
      }

      return b.width * b.height - a.width * a.height
    })[0]
}

export async function searchVideos(
  query: string,
  perPage = 3,
  options: {
    format?: MediaFormat
    minWidth?: number
    minHeight?: number
  } = {},
): Promise<PexelsVideoResult[]> {
  if (!PEXELS_API_KEY || !query.trim()) return []

  const format = options.format ?? '16:9'
  const params = new URLSearchParams({
    query: query.trim(),
    per_page: String(Math.max(1, Math.min(perPage, 80))),
    orientation: orientationFor(format),
  })

  const res = await fetch(`https://api.pexels.com/v1/videos/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
    next: { revalidate: 86_400 },
  })

  if (!res.ok) return []
  const data = await res.json()

  return (data.videos ?? [])
    .map((video: PexelsVideo): PexelsVideoResult | null => {
      const file = selectBestVideoFile(
        video.video_files,
        format,
        options.minWidth ?? 0,
        options.minHeight ?? 0,
      )
      if (!file) return null
      return {
        id: video.id,
        url: file.link,
        duration: video.duration,
        width: file.width,
        height: file.height,
        sourcePage: video.url,
        author: video.user?.name ?? null,
        authorUrl: video.user?.url ?? null,
        provider: 'pexels',
      }
    })
    .filter((item: PexelsVideoResult | null): item is PexelsVideoResult => item !== null)
}

export async function searchImages(
  query: string,
  perPage = 3,
  options: { format?: MediaFormat } = {},
): Promise<PexelsImageResult[]> {
  if (!PEXELS_API_KEY || !query.trim()) return []

  const format = options.format ?? '16:9'
  const params = new URLSearchParams({
    query: query.trim(),
    per_page: String(Math.max(1, Math.min(perPage, 80))),
    orientation: orientationFor(format),
  })

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: PEXELS_API_KEY },
    next: { revalidate: 86_400 },
  })

  if (!res.ok) return []
  const data = await res.json()

  return (data.photos ?? []).map((photo: PexelsPhoto) => ({
    id: photo.id,
    url: photo.src.original || photo.src.large2x || photo.src.large,
    width: photo.width,
    height: photo.height,
    sourcePage: photo.url,
    author: photo.photographer ?? null,
    authorUrl: photo.photographer_url ?? null,
    provider: 'pexels' as const,
  }))
}
