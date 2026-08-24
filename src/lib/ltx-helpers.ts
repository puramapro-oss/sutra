import type { Plan } from '@/types'
import { generateWanVideo, type WanQuality } from '@/lib/wan'
import { createServiceClient } from '@/lib/supabase'
import type { VideoEngine, LtxModel, LtxResult } from './ltx-types'

// ---------------------------------------------------------------------------
// Wrapper interne WAN + tracking V7.1
// ---------------------------------------------------------------------------

export async function generateWanVideoWithTracking(params: {
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

export async function logVideoGeneration(params: {
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
