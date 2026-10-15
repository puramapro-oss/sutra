import { z } from 'zod'
import { requireEnv } from '@/lib/env'
import { providerRecord } from '@/lib/provider-response'

// A missing credential or failed search must not masquerade as empty stock.
function pexelsApiKey(): string {
  return requireEnv('PEXELS_API_KEY', 'recherche de medias Pexels')
}

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

const mediaUrl = z.string().refine(value => {
  try {
    const url = new URL(value)
    return value.length <= 8192 && url.protocol === 'https:' && !url.username && !url.password && !url.hash
      && (!url.port || url.port === '443')
  } catch { return false }
})
const dimension = z.number().int().positive()
const videoSchema = z.object({
  id: dimension, url: mediaUrl, duration: z.number().positive(),
  user: z.object({ name: z.string(), url: mediaUrl }).optional(),
  video_files: z.array(z.object({
    id: dimension, quality: z.string(), link: mediaUrl, width: dimension.nullable(), height: dimension.nullable(),
    file_type: z.string().optional(), fps: z.number().positive().optional(),
  })).transform(files => files.filter((file): file is PexelsVideoFile => file.width !== null && file.height !== null
    && (!file.file_type || file.file_type === 'video/mp4'))),
})
const photoSchema = z.object({
  id: dimension, url: mediaUrl, width: dimension, height: dimension,
  photographer: z.string().optional(), photographer_url: mediaUrl.optional(),
  src: z.object({ original: mediaUrl.optional(), large2x: mediaUrl.optional(), large: mediaUrl.optional() })
    .refine(src => Boolean(src.original || src.large2x || src.large)),
})

async function pexelsData(path: string, params: URLSearchParams, apiKey: string) {
  const signal = AbortSignal.timeout(15_000)
  let response: Response
  try {
    response = await fetch(`https://api.pexels.com/${path}?${params}`, {
      method: 'GET', redirect: 'error', signal,
      headers: { Authorization: apiKey }, next: { revalidate: 86_400 },
    })
  } catch { throw new Error('Pexels TRANSPORT_OR_TIMEOUT') }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    throw new Error(`Pexels HTTP ${response.status}`)
  }
  return providerRecord(response, signal, 2 * 1024 * 1024)
    .catch(() => { throw new Error('Pexels INVALID_RESPONSE') })
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
  if (!query.trim()) return []
  const apiKey = pexelsApiKey()

  const format = options.format ?? '16:9'
  const params = new URLSearchParams({
    query: query.trim(),
    per_page: String(Math.max(1, Math.min(perPage, 80))),
    orientation: orientationFor(format),
  })

  const data = await pexelsData('v1/videos/search', params, apiKey)
  const parsed = z.array(videoSchema).safeParse(data.videos)
  if (!parsed.success) throw new Error('Pexels INVALID_RESPONSE')

  return parsed.data
    .map((video): PexelsVideoResult | null => {
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
  if (!query.trim()) return []
  const apiKey = pexelsApiKey()

  const format = options.format ?? '16:9'
  const params = new URLSearchParams({
    query: query.trim(),
    per_page: String(Math.max(1, Math.min(perPage, 80))),
    orientation: orientationFor(format),
  })

  const data = await pexelsData('v1/search', params, apiKey)
  const parsed = z.array(photoSchema).safeParse(data.photos)
  if (!parsed.success) throw new Error('Pexels INVALID_RESPONSE')

  return parsed.data.map((photo) => ({
    id: photo.id,
    url: (photo.src.original || photo.src.large2x || photo.src.large)!,
    width: photo.width,
    height: photo.height,
    sourcePage: photo.url,
    author: photo.photographer ?? null,
    authorUrl: photo.photographer_url ?? null,
    provider: 'pexels' as const,
  }))
}
