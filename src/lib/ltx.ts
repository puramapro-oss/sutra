import { fetchWithRetry, sleep } from '@/lib/utils/api'
import { createHash } from 'node:crypto'
import { requireEnv } from '@/lib/env'
import { uploadToStorage } from '@/lib/storage'
import { downloadVideoBytes } from '@/lib/media-download'
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

const LTX_BASE = 'https://api.ltx.io/v2'
const LTX_TIMEOUT = 180_000

export interface LtxJobState {
  endpoint: string
  fingerprint: string
  started: true
  id?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  requestId?: string
}
export interface LtxJobPersistence {
  current?: LtxJobState
  save: (state: LtxJobState) => Promise<void>
}
export class LtxJobError extends Error {
  constructor(message: string, readonly jobId?: string) { super(message); this.name = 'LtxJobError' }
}

/** Store intent BEFORE the non-idempotent POST and ID BEFORE polling/downloading. */
export function durableLtxJob(steps: Record<string, unknown>, key: string,
  checkpoint?: (key: string, value: unknown) => Promise<void>): LtxJobPersistence {
  const job: LtxJobPersistence = { current: steps[key] as LtxJobState | undefined, save: async state => {
    await checkpoint?.(key, state)
    steps[key] = state
    job.current = state
  } }
  return job
}

function validJobId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
}

async function ltxJson(response: Response): Promise<Record<string, unknown>> {
  // Provider JSON is small. A proxy returning a file/HTML must not be buffered indefinitely.
  const reader = response.body?.getReader()
  if (!reader) throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 65_536) throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE')
      chunks.push(value)
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data as Record<string, unknown>
  } catch { throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE') }
  finally { await reader.cancel().catch(() => {}) }
}

// ---------------------------------------------------------------------------
// Core API calls
// ---------------------------------------------------------------------------

async function callLtxApi(
  endpoint: string,
  body: Record<string, unknown>,
  persistence?: LtxJobPersistence,
): Promise<ArrayBuffer> {
  const apiKey = requireEnv('LTX_API_KEY', 'generation video LTX (plans payants)')
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  let state: LtxJobState = persistence?.current ?? { endpoint, fingerprint, started: true }
  if (state.endpoint !== endpoint || state.fingerprint !== fingerprint) throw new LtxJobError('SUTRA_LTX_RESUME_CONFLICT')
  if (persistence?.current && !validJobId(state.id)) throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: LTX soumis sans identifiant confirme')
  if (state.status === 'failed') throw new LtxJobError('SUTRA_LTX_JOB_FAILED', state.id)
  const save = async (next: LtxJobState) => {
    await persistence?.save(next)
    if (persistence) persistence.current = next
    state = next
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  const signal = AbortSignal.timeout(LTX_TIMEOUT)
  try {
    if (!state.id) {
      await save(state)
      // The official LTX contract does not document POST idempotency. Never retry it.
      const response = await fetchWithRetry(`${LTX_BASE}${endpoint}`, {
        method: 'POST', headers, body: JSON.stringify(body), redirect: 'error', signal, timeoutMs: 30_000,
      }, 1)
      if (response.status !== 202) throw new LtxJobError(`SUTRA_LTX_SUBMISSION_HTTP_${response.status}`)
      const data = await ltxJson(response)
      if (!validJobId(data.id)) throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: identifiant LTX absent')
      await save({ ...state, id: data.id, status: 'pending', requestId: response.headers.get('x-request-id') ?? undefined })
    }
    while (true) {
      const response = await fetchWithRetry(`${LTX_BASE}${endpoint}/${encodeURIComponent(state.id!)}`, {
        method: 'GET', headers, redirect: 'error', signal, timeoutMs: 30_000,
      }, 3)
      if (!response.ok) throw new LtxJobError(`SUTRA_LTX_POLL_HTTP_${response.status}`, state.id)
      const data = await ltxJson(response)
      if (data.id !== state.id || !['pending', 'processing', 'completed', 'failed'].includes(String(data.status))) {
        throw new LtxJobError('SUTRA_LTX_INVALID_JOB_STATUS', state.id)
      }
      if (data.status !== state.status) await save({ ...state, status: data.status as LtxJobState['status'] })
      if (data.status === 'failed') throw new LtxJobError('SUTRA_LTX_JOB_FAILED', state.id)
      if (data.status === 'completed') {
        const result = data.result as { video_url?: unknown } | undefined
        if (typeof result?.video_url !== 'string') throw new LtxJobError('SUTRA_LTX_MISSING_OUTPUT', state.id)
        const bytes = await downloadVideoBytes(result.video_url)
        return Uint8Array.from(bytes).buffer
      }
      await sleep(5_000 + Math.random() * 1_000, signal)
    }
  } catch (error) {
    if (error instanceof LtxJobError) throw error
    // No prompt, URL, credential or provider response is exposed in errors.
    throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: generation LTX interrompue', state.id)
  }
}

// ---------------------------------------------------------------------------
// Text to Video
// ---------------------------------------------------------------------------

export async function textToVideo(params: LtxTextToVideoRequest, job?: LtxJobPersistence): Promise<ArrayBuffer> {
  return callLtxApi('/text-to-video', {
    prompt: params.prompt,
    model: params.model,
    duration: params.duration,
    resolution: params.resolution,
    fps: params.fps ?? 24,
    generate_audio: params.generate_audio ?? false,
    ...(params.camera_motion && { camera_motion: params.camera_motion }),
    ...(params.seed !== undefined && { seed: params.seed }),
  }, job)
}

// ---------------------------------------------------------------------------
// Image to Video
// ---------------------------------------------------------------------------

export async function imageToVideo(params: LtxImageToVideoRequest, job?: LtxJobPersistence): Promise<ArrayBuffer> {
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
  }, job)
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
    job?: LtxJobPersistence
  } = {}
): Promise<LtxResult> {
  const { engine, model } = selectEngine(plan, userEmail)
  const quality = options.quality ?? getMaxQuality(plan)

  // Mode personnel LOCAL (audit #17) : propriétaire uniquement — le bloc
  // complet vit dans local-engine.ts (tryLocalRoute) pour garder ce fichier
  // focalisé sur le routage externe.
  {
    const local = options.job?.current ? null : await tryLocalRoute({ prompt, plan, quality, userEmail, format: options.format, duration: options.duration, userId: options.userId, videoId: options.videoId })
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
    if (options.job?.current) throw new LtxJobError('SUTRA_LTX_RESUME_CONFLICT')
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
  if (!isLtxHealthy() && !options.job?.current) {
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
      }, options.job)
    } else {
      videoBuffer = await textToVideo({
        prompt,
        model: ltxModel,
        duration,
        resolution,
        camera_motion: options.cameraMotion,
      }, options.job)
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
    // Once a POST may have been accepted, another paid provider is not a retry.
    await logVideoGeneration({
        ...track,
        engineUsed: 'ltx',
        modelUsed: model,
        fallbackTriggered: false,
        fallbackReason: 'ltx_reconciliation_required',
        durationMs: Date.now() - start,
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
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
