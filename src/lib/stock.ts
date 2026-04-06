/**
 * Unified stock media search across Pexels, Unsplash, and Coverr.
 * STRICT quality filter: never returns assets below 1080p.
 * Sort: 4K first (badge or), 1080p second (badge argent).
 */

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? ''
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? ''

export type StockSource = 'pexels' | 'unsplash' | 'coverr'
export type StockType = 'video' | 'photo'
export type StockOrientation = 'landscape' | 'portrait' | 'square'
export type StockQuality = '1080p' | '4k'

export interface StockResult {
  id: string
  source: StockSource
  type: StockType
  url: string
  thumbnail: string
  width: number
  height: number
  quality: StockQuality
  duration?: number
  author?: string
  pageUrl?: string
}

const MIN_WIDTH = 1920
const MIN_HEIGHT = 1080
const UHD_WIDTH = 3840

function classifyQuality(width: number, height: number): StockQuality | null {
  const max = Math.max(width, height)
  const min = Math.min(width, height)
  if (max >= UHD_WIDTH && min >= 2160) return '4k'
  if (max >= MIN_WIDTH && min >= MIN_HEIGHT) return '1080p'
  return null
}

function matchesOrientation(
  width: number,
  height: number,
  orientation: StockOrientation
): boolean {
  const ratio = width / height
  if (orientation === 'landscape') return ratio > 1.2
  if (orientation === 'portrait') return ratio < 0.85
  return ratio >= 0.85 && ratio <= 1.2
}

/* ------------------------------ PEXELS ------------------------------ */

interface PexelsVideoFile {
  id: number
  quality: string
  link: string
  width: number
  height: number
}
interface PexelsVideo {
  id: number
  url: string
  width: number
  height: number
  duration: number
  user: { name: string }
  image: string
  video_files: PexelsVideoFile[]
}
interface PexelsPhoto {
  id: number
  url: string
  width: number
  height: number
  photographer: string
  src: { original: string; large2x: string; large: string }
}

async function pexelsVideos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  if (!PEXELS_API_KEY) return []
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
      query
    )}&per_page=20&orientation=${orientation}&size=large`
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { videos?: PexelsVideo[] }
    const results: StockResult[] = []
    for (const v of data.videos ?? []) {
      // Pick best file ≥1080p
      const sorted = [...v.video_files].sort((a, b) => b.width * b.height - a.width * a.height)
      const best = sorted.find((f) => classifyQuality(f.width, f.height) !== null)
      if (!best) continue
      const q = classifyQuality(best.width, best.height)
      if (!q) continue
      results.push({
        id: `pexels-v-${v.id}`,
        source: 'pexels',
        type: 'video',
        url: best.link,
        thumbnail: v.image,
        width: best.width,
        height: best.height,
        quality: q,
        duration: v.duration,
        author: v.user?.name,
        pageUrl: v.url,
      })
    }
    return results
  } catch {
    return []
  }
}

async function pexelsPhotos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  if (!PEXELS_API_KEY) return []
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query
    )}&per_page=20&orientation=${orientation}`
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_API_KEY },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { photos?: PexelsPhoto[] }
    const results: StockResult[] = []
    for (const p of data.photos ?? []) {
      const q = classifyQuality(p.width, p.height)
      if (!q) continue
      results.push({
        id: `pexels-p-${p.id}`,
        source: 'pexels',
        type: 'photo',
        url: p.src.original,
        thumbnail: p.src.large,
        width: p.width,
        height: p.height,
        quality: q,
        author: p.photographer,
        pageUrl: p.url,
      })
    }
    return results
  } catch {
    return []
  }
}

/* ----------------------------- UNSPLASH ----------------------------- */

interface UnsplashPhoto {
  id: string
  width: number
  height: number
  urls: { full: string; regular: string; raw: string }
  user: { name: string }
  links: { html: string }
}

async function unsplashPhotos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  if (!UNSPLASH_ACCESS_KEY) return []
  try {
    const ori = orientation === 'square' ? 'squarish' : orientation
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query
    )}&per_page=20&orientation=${ori}&content_filter=high`
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: UnsplashPhoto[] }
    const results: StockResult[] = []
    for (const p of data.results ?? []) {
      const q = classifyQuality(p.width, p.height)
      if (!q) continue
      results.push({
        id: `unsplash-${p.id}`,
        source: 'unsplash',
        type: 'photo',
        url: p.urls.full,
        thumbnail: p.urls.regular,
        width: p.width,
        height: p.height,
        quality: q,
        author: p.user?.name,
        pageUrl: p.links.html,
      })
    }
    return results
  } catch {
    return []
  }
}

/* ------------------------------ COVERR ------------------------------ */

interface CoverrVideo {
  id: string
  title: string
  poster: string
  max_width: number
  max_height: number
  urls: { mp4: string; mp4_download: string; mp4_preview: string }
}

async function coverrVideos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  try {
    // Coverr public API (no key needed)
    const url = `https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=20`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = (await res.json()) as { hits?: CoverrVideo[] }
    const results: StockResult[] = []
    for (const v of data.hits ?? []) {
      const w = v.max_width ?? 0
      const h = v.max_height ?? 0
      const q = classifyQuality(w, h)
      if (!q) continue
      if (!matchesOrientation(w, h, orientation)) continue
      const link = v.urls?.mp4 ?? v.urls?.mp4_download ?? v.urls?.mp4_preview
      if (!link) continue
      results.push({
        id: `coverr-${v.id}`,
        source: 'coverr',
        type: 'video',
        url: link,
        thumbnail: v.poster,
        width: w,
        height: h,
        quality: q,
        pageUrl: `https://coverr.co/videos/${v.id}`,
      })
    }
    return results
  } catch {
    return []
  }
}

/* ------------------------------ MAIN ------------------------------ */

export interface StockSearchOptions {
  query: string
  orientation?: StockOrientation
  type?: StockType | 'any'
}

export async function searchStock({
  query,
  orientation = 'landscape',
  type = 'any',
}: StockSearchOptions): Promise<StockResult[]> {
  if (!query.trim()) return []

  const tasks: Array<Promise<StockResult[]>> = []
  if (type === 'any' || type === 'video') {
    tasks.push(pexelsVideos(query, orientation))
    tasks.push(coverrVideos(query, orientation))
  }
  if (type === 'any' || type === 'photo') {
    tasks.push(pexelsPhotos(query, orientation))
    tasks.push(unsplashPhotos(query, orientation))
  }

  const settled = await Promise.allSettled(tasks)
  const all: StockResult[] = []
  for (const s of settled) {
    if (s.status === 'fulfilled') all.push(...s.value)
  }

  // Dedupe by id
  const seen = new Set<string>()
  const unique = all.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  // Sort: 4K first, then 1080p, then videos before photos within same quality
  unique.sort((a, b) => {
    if (a.quality !== b.quality) return a.quality === '4k' ? -1 : 1
    if (a.type !== b.type) return a.type === 'video' ? -1 : 1
    return b.width * b.height - a.width * a.height
  })

  return unique.slice(0, 40)
}
