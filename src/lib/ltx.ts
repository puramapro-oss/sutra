import { fetchWithRetry } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { uploadToStorage } from '@/lib/storage'
import type { Plan } from '@/types'

// Re-export types from dedicated modules
export type {
  LtxModel,
  CameraMotion,
  VideoEngine,
  LtxTextToVideoRequest,
  LtxImageToVideoRequest,
  LtxResult,
} from './ltx-types'

// Re-export utils for compatibility
export {
  getResolution,
  selectEngine,
  getMaxQuality,
  getLtxHealth,
  recordLtxFailure,
  recordLtxSuccess,
  isLtxHealthy,
  estimateCost,
} from './ltx-utils'

// Import types and utils
import type { LtxModel, CameraMotion, VideoEngine, LtxTextToVideoRequest, LtxImageToVideoRequest, LtxResult } from './ltx-types'
import { getResolution, selectEngine, getMaxQuality, isLtxHealthy, recordLtxFailure, recordLtxSuccess, snapLtxDuration, ltxCompatibleFormat } from './ltx-utils'
import { generateWanVideoWithTracking, logVideoGeneration } from './ltx-helpers'
import { tryLocalRoute } from './local-engine'

// ---------------------------------------------------------------------------
// LTX Video 2.3 — Primary video engine for SUTRA
// Tier routing: super admin → ltx-2-3-pro | paid → ltx-2-3-fast | free → WAN 2.2 fallback
// ---------------------------------------------------------------------------

const LTX_BASE = 'https://api.ltx.video/v1'
const LTX_TIMEOUT = 180_000 // 3 min — synchronous response

// ---------------------------------------------------------------------------
// Core API calls
// ---------------------------------------------------------------------------

async function callLtxApi(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ArrayBuffer> {
  // Clé lue à l'appel via le validateur centralisé : erreur explicite et
  // testable, jamais de valeur capturée à l'import (build sans env OK).
  const apiKey = requireEnv('LTX_API_KEY', 'generation video LTX (plans payants)')

  const res = await fetchWithRetry(
    `${LTX_BASE}${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LTX_TIMEOUT),
      // Clé d'idempotence par défaut : la génération est le poste de coût n°1,
      // une réponse perdue ne doit jamais déclencher une seconde génération.
      idempotencyKey: `ltx-${body.seed ?? 'auto'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    },
    2
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

  // Mode personnel LOCAL (audit #17) : propriétaire uniquement — le bloc
  // complet vit dans local-engine.ts (tryLocalRoute) pour garder ce fichier
  // focalisé sur le routage externe.
  {
    const local = await tryLocalRoute({ prompt, plan, quality, userEmail, format: options.format, duration: options.duration, userId: options.userId, videoId: options.videoId })
    if (local) return local
    // tryLocalRoute lève déjà en mode strict ; en mode auto il retourne null
    // après avoir documenté le repli externe dans les logs.
  }

  const requestedFormat = options.format ?? '16:9'
  // LTX ne supporte que 16:9/9:16 : le carré est généré en 16:9 puis recadré
  // au montage (output.size 1:1 côté Shotstack).
  const format = engine === 'wan-classic' ? requestedFormat : ltxCompatibleFormat(requestedFormat)
  const resolution = getResolution(format, quality)
  // Durée ramenée à une valeur admise par le modèle/résolution (6-20s selon
  // tier, cf snapLtxDuration) — sinon LTX rejette et le repli WAN dégrade.
  const duration =
    engine === 'wan-classic'
      ? (options.duration ?? 5)
      : snapLtxDuration(model as LtxModel, quality, options.duration ?? 6)
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
        format,
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

  const fallbackPreservesIntent =
    !options.imageUri && !options.lastFrameUri && !options.cameraMotion

  // Never hide the loss of a reference image, end frame or camera constraint.
  if (!isLtxHealthy()) {
    if (!fallbackPreservesIntent) {
      throw new Error(
        'LTX indisponible : fallback WAN refuse car il perdrait une reference ou une contrainte camera',
      )
    }
    return generateWanVideoWithTracking({
      prompt,
      quality,
      format,
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
    if (!fallbackPreservesIntent) {
      await logVideoGeneration({
        ...track,
        engineUsed: 'ltx',
        modelUsed: model,
        fallbackTriggered: false,
        fallbackReason: 'fallback_would_lose_constraints',
        durationMs: Date.now() - start,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
    return generateWanVideoWithTracking({
      prompt,
      quality,
      format,
      duration,
      userEmail,
      track,
      fallbackTriggered: true,
      fallbackReason: err instanceof Error ? err.message : 'ltx_exception',
    })
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
