import type { Plan } from '@/types'
import { generateWanVideo, type WanFormat, type WanQuality } from '@/lib/wan'
import { createServiceClient } from '@/lib/supabase'
import type { VideoEngine, LtxModel, LtxResult } from './ltx-types'

export async function generateWanVideoWithTracking(params: {
  prompt: string
  quality: string
  format: string
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
  const wanFormat: WanFormat = ['9:16', '16:9', '1:1'].includes(params.format)
    ? (params.format as WanFormat)
    : '16:9'

  try {
    const result = await generateWanVideo({
      prompt: params.prompt,
      userEmail: params.userEmail,
      quality: wanQuality,
      format: wanFormat,
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
      requestMetadata: {
        requested_quality: result.requestedQuality,
        generated_resolution: result.resolution,
        format: result.format,
        native_4k: result.native4k,
      },
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
      requestMetadata: {
        requested_quality: wanQuality,
        format: wanFormat,
      },
    })
    throw err
  }
}

export async function logVideoGeneration(params: {
  userId: string | null
  videoId: string | null
  plan: Plan
  engineRequested: VideoEngine
  modelRequested: LtxModel | 'wan-2.2'
  engineUsed: 'ltx' | 'wan' | 'pexels' | 'shotstack' | 'local'
  modelUsed: string
  fallbackTriggered: boolean
  fallbackReason: string | null
  durationMs: number
  success: boolean
  errorMessage: string | null
  requestMetadata?: Record<string, unknown>
}): Promise<void> {
  if (!params.userId) return
  try {
    const supabase = createServiceClient()
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
      request_metadata: params.requestMetadata ?? {},
    })
  } catch {
    // Tracking must never break a customer render.
  }
}
