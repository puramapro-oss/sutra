import { submitVideoJob, pollVideoJob } from '@/lib/runpod'

export type WanQuality = '720p' | '1080p' | '4k'
export type WanFormat = '9:16' | '16:9' | '1:1'

export type WanResult = {
  videoBuffer: ArrayBuffer
  model: 'wan-2.2'
  duration: number
  resolution: string
  width: number
  height: number
  requestedQuality: WanQuality
  format: WanFormat
  native4k: boolean
}

type Dimensions = { width: number; height: number }

/**
 * Native WAN generation sizes. The `4k` tier is the highest WAN render size,
 * not native UHD; callers must never label it as native 4K.
 */
const DIMS: Record<WanQuality, Record<WanFormat, Dimensions>> = {
  '720p': {
    '16:9': { width: 896, height: 512 },
    '9:16': { width: 512, height: 896 },
    '1:1': { width: 768, height: 768 },
  },
  '1080p': {
    '16:9': { width: 1024, height: 576 },
    '9:16': { width: 576, height: 1024 },
    '1:1': { width: 896, height: 896 },
  },
  '4k': {
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '1:1': { width: 1024, height: 1024 },
  },
}

const POLL_TIMEOUT_MS = 300_000

export function getWanDimensions(
  quality: WanQuality,
  format: WanFormat,
): Dimensions {
  return DIMS[quality]?.[format] ?? DIMS['720p']['16:9']
}

export async function generateWanVideo(params: {
  prompt: string
  userEmail: string | null
  quality?: WanQuality
  duration?: number
  format?: WanFormat
}): Promise<WanResult> {
  const {
    prompt,
    userEmail,
    quality = '720p',
    duration = 5,
    format = '16:9',
  } = params
  const { width, height } = getWanDimensions(quality, format)

  const { jobId, baseUrl } = await submitVideoJob(
    {
      prompt,
      width,
      height,
      num_frames: Math.round(duration * 16),
    },
    userEmail,
  )

  const videoUrl = await pollVideoJob(jobId, baseUrl, POLL_TIMEOUT_MS)
  const res = await fetch(videoUrl)
  if (!res.ok) {
    throw new Error(`WAN fetch failed: HTTP ${res.status}`)
  }
  const videoBuffer = await res.arrayBuffer()

  return {
    videoBuffer,
    model: 'wan-2.2',
    duration,
    resolution: `${width}x${height}`,
    width,
    height,
    requestedQuality: quality,
    format,
    native4k: width >= 3840 && height >= 2160,
  }
}
