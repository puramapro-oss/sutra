import { fetchWithRetry, sleep } from '@/lib/utils/api'
import { isSuperAdmin } from '@/lib/utils'
import { uploadToStorage } from '@/lib/storage'
import type { Plan } from '@/types'

// ---------------------------------------------------------------------------
// LTX Video 2.3 — Primary video engine for SUTRA
// Tier routing: super admin → ltx-2-3-pro | paid → ltx-2-3-fast | free → WAN 2.2 fallback
// ---------------------------------------------------------------------------

const LTX_API_KEY = process.env.LTX_API_KEY ?? ''
const LTX_BASE = 'https://api.ltx.video/v1'
const LTX_TIMEOUT = 180_000 // 3 min — synchronous response

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LtxModel = 'ltx-2-3-pro' | 'ltx-2-3-fast'

export type CameraMotion =
  | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right'
  | 'jib_up' | 'jib_down' | 'static' | 'focus_shift'

export type VideoEngine = 'ltx-pro' | 'ltx-fast' | 'wan-classic'

export interface LtxTextToVideoRequest {
  prompt: string
  model: LtxModel
  duration: number
  resolution: string
  fps?: number
  generate_audio?: boolean
  camera_motion?: CameraMotion
  seed?: number
}

export interface LtxImageToVideoRequest {
  image_uri: string
  prompt: string
  model: LtxModel
  duration: number
  resolution: string
  fps?: number
  generate_audio?: boolean
  last_frame_uri?: string
  camera_motion?: CameraMotion
}

export interface LtxResult {
  videoBuffer: ArrayBuffer
  engine: VideoEngine
  model: LtxModel | 'wan-2.2'
  duration: number
  resolution: string
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

const RESOLUTION_MAP: Record<string, Record<string, string>> = {
  '16:9': { '720p': '1280x720', '1080p': '1920x1080', '4k': '3840x2160' },
  '9:16': { '720p': '720x1280', '1080p': '1080x1920', '4k': '2160x3840' },
  '1:1':  { '720p': '720x720',  '1080p': '1080x1080', '4k': '2160x2160' },
}

export function getResolution(format: string, quality: string): string {
  return RESOLUTION_MAP[format]?.[quality] ?? RESOLUTION_MAP['16:9']['1080p']
}

// ---------------------------------------------------------------------------
// Model routing by plan + role
// ---------------------------------------------------------------------------

export function selectEngine(
  plan: Plan,
  userEmail?: string | null
): { engine: VideoEngine; model: LtxModel | 'wan-2.2' } {
  // Super admin always gets pro
  if (userEmail && isSuperAdmin(userEmail)) {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  // Paid plans get fast
  if (plan !== 'free') {
    return { engine: 'ltx-fast', model: 'ltx-2-3-fast' }
  }
  // Free falls back to WAN 2.2 via RunPod
  return { engine: 'wan-classic', model: 'wan-2.2' }
}

export function getMaxQuality(plan: Plan): string {
  const map: Record<Plan, string> = {
    free: '720p', starter: '720p', creator: '1080p',
    empire: '4k', enterprise: '4k', admin: '4k',
  }
  return map[plan] ?? '720p'
}

// ---------------------------------------------------------------------------
// Circuit breaker — track LTX health
// ---------------------------------------------------------------------------

let ltxFailures = 0
let ltxLastFailure = 0
const LTX_BREAKER_THRESHOLD = 3
const LTX_BREAKER_COOLDOWN = 60_000 // 1 min

function isLtxHealthy(): boolean {
  if (ltxFailures < LTX_BREAKER_THRESHOLD) return true
  if (Date.now() - ltxLastFailure > LTX_BREAKER_COOLDOWN) {
    ltxFailures = 0 // Reset after cooldown
    return true
  }
  return false
}

function recordLtxFailure(): void {
  ltxFailures++
  ltxLastFailure = Date.now()
}

function recordLtxSuccess(): void {
  ltxFailures = 0
}

export function getLtxHealth(): { healthy: boolean; failures: number; lastFailure: number } {
  return { healthy: isLtxHealthy(), failures: ltxFailures, lastFailure: ltxLastFailure }
}

// ---------------------------------------------------------------------------
// Core API calls
// ---------------------------------------------------------------------------

async function callLtxApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ArrayBuffer> {
  if (!LTX_API_KEY) throw new Error('LTX_API_KEY non configuree')

  const res = await fetchWithRetry(
    `${LTX_BASE}${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LTX_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LTX_TIMEOUT),
    },
    2 // max 2 retries
  )

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    let errorMsg = `LTX ${endpoint}: ${res.status}`
    try {
      const parsed = JSON.parse(errorText)
      errorMsg = `LTX: ${parsed.error?.message ?? errorText}`
    } catch {
      errorMsg = `LTX: ${errorText}`
    }
    throw new Error(errorMsg)
  }

  return await res.arrayBuffer()
}

// ---------------------------------------------------------------------------
// Text to Video
// ---------------------------------------------------------------------------

export async function textToVideo(params: LtxTextToVideoRequest): Promise<ArrayBuffer> {
  return callLtxApi('/text-to-video', {
    prompt: params.prompt,
    model: params.model,
    duration: params.duration,
    resolution: params.resolution,
    fps: params.fps ?? 24,
    generate_audio: params.generate_audio ?? false,
    ...(params.camera_motion && { camera_motion: params.camera_motion }),
    ...(params.seed !== undefined && { seed: params.seed }),
  })
}

// ---------------------------------------------------------------------------
// Image to Video
// ---------------------------------------------------------------------------

export async function imageToVideo(params: LtxImageToVideoRequest): Promise<ArrayBuffer> {
  return callLtxApi('/image-to-video', {
    image_uri: params.image_uri,
    prompt: params.prompt,
    model: params.model,
    duration: params.duration,
    resolution: params.resolution,
    fps: params.fps ?? 24,
    generate_audio: params.generate_audio ?? false,
    ...(params.last_frame_uri && { last_frame_uri: params.last_frame_uri }),
    ...(params.camera_motion && { camera_motion: params.camera_motion }),
  })
}

// ---------------------------------------------------------------------------
// Retake — same prompt, new seed
// ---------------------------------------------------------------------------

export async function retakeVideo(
  params: Omit<LtxTextToVideoRequest, 'seed'>
): Promise<ArrayBuffer> {
  return textToVideo({ ...params, seed: Math.floor(Math.random() * 2147483647) })
}

// ---------------------------------------------------------------------------
// Extend — generate continuation from last frame
// ---------------------------------------------------------------------------

export async function extendVideo(
  lastFrameUrl: string,
  continuationPrompt: string,
  model: LtxModel,
  duration: number,
  resolution: string,
  cameraMotion?: CameraMotion
): Promise<ArrayBuffer> {
  return imageToVideo({
    image_uri: lastFrameUrl,
    prompt: continuationPrompt,
    model,
    duration,
    resolution,
    camera_motion: cameraMotion,
  })
}

// ---------------------------------------------------------------------------
// Smart generation — with automatic WAN 2.2 fallback
// ---------------------------------------------------------------------------

export async function generateVideoSmart(
  prompt: string,
  plan: Plan,
  userEmail: string | null,
  options: {
    format?: string
    quality?: string
    duration?: number
    cameraMotion?: CameraMotion
    imageUri?: string
    lastFrameUri?: string
  } = {}
): Promise<LtxResult> {
  const { engine, model } = selectEngine(plan, userEmail)
  const quality = options.quality ?? getMaxQuality(plan)
  const format = options.format ?? '16:9'
  const resolution = getResolution(format, quality)
  const duration = options.duration ?? 5

  // Free plan → direct to WAN 2.2
  if (engine === 'wan-classic') {
    return generateViaWan(prompt, quality, format, duration, userEmail)
  }

  // LTX path with circuit breaker
  if (!isLtxHealthy()) {
    return generateViaWan(prompt, quality, format, duration, userEmail)
  }

  try {
    const ltxModel = model as LtxModel
    let videoBuffer: ArrayBuffer

    if (options.imageUri) {
      videoBuffer = await imageToVideo({
        image_uri: options.imageUri,
        prompt,
        model: ltxModel,
        duration,
        resolution,
        last_frame_uri: options.lastFrameUri,
        camera_motion: options.cameraMotion,
      })
    } else {
      videoBuffer = await textToVideo({
        prompt,
        model: ltxModel,
        duration,
        resolution,
        camera_motion: options.cameraMotion,
      })
    }

    recordLtxSuccess()
    return { videoBuffer, engine, model: ltxModel, duration, resolution }
  } catch (err) {
    recordLtxFailure()
    // Automatic fallback to WAN 2.2
    return generateViaWan(prompt, quality, format, duration, userEmail)
  }
}

// ---------------------------------------------------------------------------
// WAN 2.2 fallback via RunPod (existing infrastructure)
// ---------------------------------------------------------------------------

async function generateViaWan(
  prompt: string,
  quality: string,
  _format: string,
  duration: number,
  userEmail: string | null
): Promise<LtxResult> {
  // Dynamic import to avoid circular deps
  const { submitVideoJob, pollVideoJob } = await import('@/lib/runpod')

  const dims: Record<string, { width: number; height: number }> = {
    '720p': { width: 768, height: 512 },
    '1080p': { width: 1024, height: 576 },
    '4k': { width: 1280, height: 720 },
  }
  const { width, height } = dims[quality] ?? dims['720p']

  const { jobId, baseUrl } = await submitVideoJob(
    { prompt, width, height, num_frames: Math.round(duration * 16) },
    userEmail
  )
  const videoUrl = await pollVideoJob(jobId, baseUrl, 300_000)

  // Fetch the video as buffer
  const res = await fetch(videoUrl)
  const videoBuffer = await res.arrayBuffer()

  return { videoBuffer, engine: 'wan-classic', model: 'wan-2.2', duration, resolution: `${width}x${height}` }
}

// ---------------------------------------------------------------------------
// Generate all scenes — replaces runpod.generateAllScenes as primary
// ---------------------------------------------------------------------------

export async function generateAllScenes(
  scenes: Array<{ prompt: string; duration_seconds: number }>,
  plan: Plan,
  userEmail: string | null,
  options: { format?: string; quality?: string; cameraMotion?: CameraMotion } = {}
): Promise<Array<{ url: string; engine: VideoEngine }>> {
  const results: Array<{ url: string; engine: VideoEngine }> = []

  // Generate scenes sequentially to avoid rate limits on LTX
  for (const scene of scenes) {
    const result = await generateVideoSmart(scene.prompt, plan, userEmail, {
      format: options.format,
      quality: options.quality,
      duration: scene.duration_seconds,
      cameraMotion: options.cameraMotion,
    })

    // Upload to Supabase storage
    const filename = `scenes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const url = await uploadToStorage(filename, result.videoBuffer, 'video/mp4')
    results.push({ url, engine: result.engine })
  }

  return results
}

// ---------------------------------------------------------------------------
// Cost estimation per engine
// ---------------------------------------------------------------------------

export function estimateCost(engine: VideoEngine, durationSeconds: number): number {
  const rates: Record<VideoEngine, number> = {
    'ltx-pro': 0.05,   // per second
    'ltx-fast': 0.02,  // per second
    'wan-classic': 0.015, // per scene (flat)
  }
  return rates[engine] * durationSeconds
}
