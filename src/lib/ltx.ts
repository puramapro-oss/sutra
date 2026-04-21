import { fetchWithRetry, sleep } from '@/lib/utils/api'
import { isSuperAdmin } from '@/lib/utils'
import { uploadToStorage } from '@/lib/storage'
import { generateWanVideo, type WanQuality } from '@/lib/wan'
import { createServiceClient } from '@/lib/supabase'
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
  // V7.1 — Plan-based routing explicite :
  //   super_admin + enterprise + admin → ltx-2-3-pro (qualité max)
  //   starter + creator + empire       → ltx-2-3-fast
  //   free                             → WAN 2.2 direct (pas de LTX payant)
  if (userEmail && isSuperAdmin(userEmail)) {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'enterprise' || plan === 'admin') {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'starter' || plan === 'creator' || plan === 'empire') {
    return { engine: 'ltx-fast', model: 'ltx-2-3-fast' }
  }
  // Plan 'free' (défaut) → WAN 2.2 direct (pas de fallback LTX).
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
    userId?: string // V7.1 — pour tracking video_generations
    videoId?: string
  } = {}
): Promise<LtxResult> {
  const { engine, model } = selectEngine(plan, userEmail)
  const quality = options.quality ?? getMaxQuality(plan)
  const format = options.format ?? '16:9'
  const resolution = getResolution(format, quality)
  const duration = options.duration ?? 5
  const start = Date.now()

  // V7.1 tracking context (flushé à la fin ou dans catch)
  const track = {
    userId: options.userId ?? null,
    videoId: options.videoId ?? null,
    plan,
    engineRequested: engine,
    modelRequested: model,
  }

  // Free plan → WAN 2.2 direct (pas de fallback LTX).
  if (engine === 'wan-classic') {
    try {
      const wan = await generateWanVideoWithTracking({
        prompt,
        quality,
        duration,
        userEmail,
        track,
        fallbackTriggered: false,
        fallbackReason: null,
      })
      return wan
    } catch (err) {
      await logVideoGeneration({
        ...track,
        engineUsed: 'wan',
        modelUsed: 'wan-2.2',
        fallbackTriggered: false,
        fallbackReason: null,
        durationMs: Date.now() - start,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  // LTX path — circuit breaker bypass → WAN fallback si LTX unhealthy.
  if (!isLtxHealthy()) {
    return generateWanVideoWithTracking({
      prompt,
      quality,
      duration,
      userEmail,
      track,
      fallbackTriggered: true,
      fallbackReason: 'circuit_breaker_open',
    })
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
    await logVideoGeneration({
      ...track,
      engineUsed: 'ltx',
      modelUsed: ltxModel,
      fallbackTriggered: false,
      fallbackReason: null,
      durationMs: Date.now() - start,
      success: true,
      errorMessage: null,
    })
    return { videoBuffer, engine, model: ltxModel, duration, resolution }
  } catch (err) {
    recordLtxFailure()
    // V7.1 — Fallback automatique WAN 2.2 avec traçage raison
    return generateWanVideoWithTracking({
      prompt,
      quality,
      duration,
      userEmail,
      track,
      fallbackTriggered: true,
      fallbackReason: err instanceof Error ? err.message : 'ltx_exception',
    })
  }
}

// ---------------------------------------------------------------------------
// Wrapper interne WAN + tracking V7.1
// ---------------------------------------------------------------------------

async function generateWanVideoWithTracking(params: {
  prompt: string
  quality: string
  duration: number
  userEmail: string | null
  track: {
    userId: string | null
    videoId: string | null
    plan: Plan
    engineRequested: VideoEngine
    modelRequested: LtxModel | 'wan-2.2'
  }
  fallbackTriggered: boolean
  fallbackReason: string | null
}): Promise<LtxResult> {
  const start = Date.now()
  const wanQuality: WanQuality = ['720p', '1080p', '4k'].includes(params.quality)
    ? (params.quality as WanQuality)
    : '720p'

  try {
    const result = await generateWanVideo({
      prompt: params.prompt,
      userEmail: params.userEmail,
      quality: wanQuality,
      duration: params.duration,
    })

    await logVideoGeneration({
      ...params.track,
      engineUsed: 'wan',
      modelUsed: 'wan-2.2',
      fallbackTriggered: params.fallbackTriggered,
      fallbackReason: params.fallbackReason,
      durationMs: Date.now() - start,
      success: true,
      errorMessage: null,
    })

    return {
      videoBuffer: result.videoBuffer,
      engine: 'wan-classic',
      model: 'wan-2.2',
      duration: result.duration,
      resolution: result.resolution,
    }
  } catch (err) {
    await logVideoGeneration({
      ...params.track,
      engineUsed: 'wan',
      modelUsed: 'wan-2.2',
      fallbackTriggered: params.fallbackTriggered,
      fallbackReason: params.fallbackReason,
      durationMs: Date.now() - start,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// V7.1 — Tracking video_generations (non-blocking, errors swallowed)
// ---------------------------------------------------------------------------

async function logVideoGeneration(params: {
  userId: string | null
  videoId: string | null
  plan: Plan
  engineRequested: VideoEngine
  modelRequested: LtxModel | 'wan-2.2'
  engineUsed: 'ltx' | 'wan' | 'pexels' | 'shotstack'
  modelUsed: string
  fallbackTriggered: boolean
  fallbackReason: string | null
  durationMs: number
  success: boolean
  errorMessage: string | null
}): Promise<void> {
  if (!params.userId) return // pas de user → pas de ligne DB (NOT NULL)
  try {
    const supabase = createServiceClient()
    // Traduit VideoEngine Purama → engine_requested CHECK schema (ltx/wan/...)
    const engineReqDb: 'ltx' | 'wan' =
      params.engineRequested === 'ltx-pro' || params.engineRequested === 'ltx-fast'
        ? 'ltx'
        : 'wan'
    await supabase.from('video_generations').insert({
      user_id: params.userId,
      video_id: params.videoId,
      user_plan: params.plan,
      engine_requested: engineReqDb,
      model_requested: String(params.modelRequested),
      engine_used: params.engineUsed,
      model_used: params.modelUsed,
      fallback_triggered: params.fallbackTriggered,
      fallback_reason: params.fallbackReason,
      duration_ms: params.durationMs,
      success: params.success,
      error_message: params.errorMessage,
      request_metadata: {},
    })
  } catch {
    // Non-blocking : on ne veut jamais fail une génération pour un log raté.
  }
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
