/**
 * Unified stock media search across Pexels, Pixabay, Unsplash, and Coverr.
 * Quality filter based on provider-declared dimensions (at least 1080p).
 * Sort: 4K first (badge or), 1080p second (badge argent).
 */

import { z } from 'zod'
import { providerRecord } from '@/lib/provider-response'

import type {
  StockSource,
  StockType,
  StockOrientation,
  StockQuality,
  StockResult,
  StockSearchOptions,
} from '@/types/stock'

export type {
  StockSource,
  StockType,
  StockOrientation,
  StockQuality,
  StockResult,
  StockSearchOptions,
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

// Catalogue metadata is not proof that a downloaded asset is decodable.
// Validate every selected source, and never disguise a failed source as no matches.
const mediaUrl = z.string().max(8192).refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
      && (!url.port || url.port === '443')
  } catch { return false }
})
const dimension = z.number().int().positive()
const emptyOrUrl = z.union([z.literal(''), mediaUrl])
const videoSchema = z.object({
  id: dimension, url: mediaUrl, image: mediaUrl, duration: z.number().positive(),
  user: z.object({ name: z.string() }).optional(),
  video_files: z.array(z.object({ link: mediaUrl, width: dimension.nullable(), height: dimension.nullable(),
    file_type: z.string().optional() })),
})
const photoSchema = z.object({
  id: dimension, url: mediaUrl, width: dimension, height: dimension, photographer: z.string().optional(),
  src: z.object({ original: mediaUrl, large: mediaUrl }),
})
const pixabaySchema = z.object({
  id: dimension, pageURL: mediaUrl.optional(), duration: z.number().positive().optional(), user: z.string().optional(),
  videos: z.record(z.string(), z.object({ url: emptyOrUrl, width: z.number().int().nonnegative(),
    height: z.number().int().nonnegative(), thumbnail: emptyOrUrl.optional() })),
})
const unsplashSchema = z.object({
  id: z.string().min(1), width: dimension, height: dimension,
  urls: z.object({ full: mediaUrl, regular: mediaUrl }),
  user: z.object({ name: z.string() }).optional(), links: z.object({ html: mediaUrl }),
})
const coverrSchema = z.object({
  id: z.string().min(1), poster: mediaUrl, max_width: dimension, max_height: dimension,
  urls: z.object({ mp4: emptyOrUrl.optional(), mp4_download: emptyOrUrl.optional(), mp4_preview: emptyOrUrl.optional() }),
})

class StockProviderError extends Error {
  constructor(provider: string, code: string) { super(`${provider}:${code}`) }
}

async function stockData(provider: string, url: string, headers: Record<string, string> = {}) {
  const signal = AbortSignal.timeout(15_000)
  let response: Response
  try {
    response = await fetch(url, { method: 'GET', redirect: 'error', signal, headers, next: { revalidate: 86_400 } })
  } catch { throw new StockProviderError(provider, 'TRANSPORT_OR_TIMEOUT') }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    throw new StockProviderError(provider, `HTTP_${response.status}`)
  }
  return providerRecord(response, signal, 2 * 1024 * 1024)
    .catch(() => { throw new StockProviderError(provider, 'INVALID_RESPONSE_OR_TIMEOUT') })
}

function stockItems<T>(provider: string, schema: z.ZodType<T>, raw: unknown): T[] {
  const parsed = z.array(schema).safeParse(raw)
  if (!parsed.success) throw new StockProviderError(provider, 'INVALID_RESPONSE')
  return parsed.data
}

/* ------------------------------ PEXELS ------------------------------ */

async function pexelsVideos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? ''
  if (!PEXELS_API_KEY) return []
  const url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(
    query
  )}&per_page=20&orientation=${orientation}&size=large`
  const data = await stockData('pexels:videos', url, { Authorization: PEXELS_API_KEY })
  const results: StockResult[] = []
  for (const v of stockItems('pexels:videos', videoSchema, data.videos)) {
    // Pick best file ≥1080p
    const sorted = v.video_files
      .filter((f): f is typeof f & { width: number; height: number } => f.width !== null && f.height !== null
        && (!f.file_type || f.file_type === 'video/mp4'))
      .sort((a, b) => b.width * b.height - a.width * a.height)
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
}

async function pexelsPhotos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? ''
  if (!PEXELS_API_KEY) return []
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query
  )}&per_page=20&orientation=${orientation}`
  const data = await stockData('pexels:photos', url, { Authorization: PEXELS_API_KEY })
  const results: StockResult[] = []
  for (const p of stockItems('pexels:photos', photoSchema, data.photos)) {
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
}

/* ----------------------------- PIXABAY ----------------------------- */

async function pixabayVideos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY ?? ''
  if (!PIXABAY_API_KEY) return []
  const params = new URLSearchParams({
    key: PIXABAY_API_KEY,
    q: query,
    per_page: '20',
    safesearch: 'true',
  })
  const data = await stockData('pixabay:videos', `https://pixabay.com/api/videos/?${params}`)
  const results: StockResult[] = []

  for (const hit of stockItems('pixabay:videos', pixabaySchema, data.hits)) {
    const variants = Object.values(hit.videos ?? {})
      .filter(v => v.url && v.width > 0 && v.height > 0)
      .filter((v) => matchesOrientation(v.width, v.height, orientation))
      .sort((a, b) => b.width * b.height - a.width * a.height)
    const best = variants.find((v) => classifyQuality(v.width, v.height) !== null)
    if (!best) continue
    const quality = classifyQuality(best.width, best.height)
    if (!quality) continue
    results.push({
      id: `pixabay-v-${hit.id}`,
      source: 'pixabay',
      type: 'video',
      url: best.url,
      thumbnail: best.thumbnail ?? '',
      width: best.width,
      height: best.height,
      quality,
      duration: hit.duration,
      author: hit.user,
      pageUrl: hit.pageURL,
    })
  }
  return results
}

/* ----------------------------- UNSPLASH ----------------------------- */

async function unsplashPhotos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? ''
  if (!UNSPLASH_ACCESS_KEY) return []
  const ori = orientation === 'square' ? 'squarish' : orientation
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query
  )}&per_page=20&orientation=${ori}&content_filter=high`
  const data = await stockData('unsplash:photos', url, { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` })
  const results: StockResult[] = []
  for (const p of stockItems('unsplash:photos', unsplashSchema, data.results)) {
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
}

/* ------------------------------ COVERR ------------------------------ */

async function coverrVideos(
  query: string,
  orientation: StockOrientation
): Promise<StockResult[]> {
  const apiKey = process.env.COVERR_API_KEY
  if (!apiKey) return []
  const url = `https://api.coverr.co/videos?query=${encodeURIComponent(query)}&page_size=20&urls=true`
  const data = await stockData('coverr:videos', url, { Authorization: `Bearer ${apiKey}` })
  const results: StockResult[] = []
  for (const v of stockItems('coverr:videos', coverrSchema, data.hits)) {
    const w = v.max_width ?? 0
    const h = v.max_height ?? 0
    const q = classifyQuality(w, h)
    if (!q) continue
    if (!matchesOrientation(w, h, orientation)) continue
    // Download URL preserves Coverr tracking; low-res previews cannot inherit max dimensions.
    const link = v.urls.mp4_download || v.urls.mp4
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
      pageUrl: `https://coverr.co/videos/${encodeURIComponent(v.id)}`,
    })
  }
  return results
}

/* ------------------------------ MAIN ------------------------------ */

export async function searchStock({
  query,
  orientation = 'landscape',
  type = 'any',
}: StockSearchOptions): Promise<StockResult[]> {
  if (!query.trim()) return []

  const configured = (type !== 'photo' && (process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY || process.env.COVERR_API_KEY))
    || (type !== 'video' && (process.env.PEXELS_API_KEY || process.env.UNSPLASH_ACCESS_KEY))
  if (!configured) throw new Error('STOCK_NOT_CONFIGURED')
  const tasks: Array<Promise<StockResult[]>> = []
  if (type === 'any' || type === 'video') {
    tasks.push(pexelsVideos(query, orientation))
    tasks.push(pixabayVideos(query, orientation))
    tasks.push(coverrVideos(query, orientation))
  }
  if (type === 'any' || type === 'photo') {
    tasks.push(pexelsPhotos(query, orientation))
    tasks.push(unsplashPhotos(query, orientation))
  }

  const settled = await Promise.allSettled(tasks)
  const failed = settled.filter((item): item is PromiseRejectedResult => item.status === 'rejected')
  if (failed.length) {
    const reasons = failed.map(item => item.reason instanceof StockProviderError ? item.reason.message : 'UNAVAILABLE')
    throw new Error(`STOCK_SEARCH_FAILED:${reasons.join(',')}`)
  }
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
