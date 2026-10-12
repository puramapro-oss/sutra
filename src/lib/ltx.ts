import { ltxV2, LtxJobError, type LtxExecution, type LtxJob } from './ltx-v2'
import { validateLtxRequest, type LtxEndpoint, type LtxRequest } from './ltx-v2-contract'
import { executionForCheckpoint, type LtxJobPersistence, resumeLegacyLtx } from './ltx-checkpoint'
import { tryLocalRoute } from './local-engine'
export { durableLtxJob } from './ltx-workflow'
export type { LtxJobState, LtxJobPersistence } from './ltx-workflow'
export { LtxJobError } from './ltx-v2'
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
import { getResolution, selectEngine, getMaxQuality, clampQualityToPlan, recordLtxFailure, recordLtxSuccess, snapLtxDuration, ltxCompatibleFormat } from './ltx-utils'
import { generateWanVideoWithTracking, logVideoGeneration } from './ltx-helpers'

// Preserve PR1/PR3 explicit owner-local generation before external provider selection.

/** One paid submission, durable ID, read-only polling, then artifact download.
 * No automatic WAN substitution: an uncertain LTX outcome may still be billed.
 */
async function callLtxApi<E extends LtxEndpoint>(endpoint: E, body: LtxRequest<E>, execution?: LtxExecution) {
  if (!execution) throw new LtxJobError('LTX_DURABLE_CONTEXT_REQUIRED', null)
  const accepted = await ltxV2.submit(endpoint, body, execution)
  const job = await ltxV2.wait(accepted, execution)
  return { videoBuffer: await ltxV2.download(job, execution.signal), job }
}

export async function textToVideo(params: LtxTextToVideoRequest, execution?: LtxExecution | LtxJobPersistence): Promise<ArrayBuffer> {
  if (execution && 'save' in execution && execution.current && !execution.current.v2) return resumeLegacyLtx('/text-to-video', { prompt: params.prompt, model: params.model, duration: params.duration, resolution: params.resolution, fps: params.fps ?? 24, generate_audio: params.generate_audio ?? false, ...(params.camera_motion && { camera_motion: params.camera_motion }), ...(params.seed !== undefined && { seed: params.seed }) }, execution)
  return (await callLtxApi('text-to-video', params as LtxRequest<'text-to-video'>, execution && 'save' in execution ? executionForCheckpoint(execution) : execution)).videoBuffer
}

export async function imageToVideo(params: LtxImageToVideoRequest, execution?: LtxExecution | LtxJobPersistence): Promise<ArrayBuffer> {
  if (execution && 'save' in execution && execution.current && !execution.current.v2) return resumeLegacyLtx('/image-to-video', { image_uri: params.image_uri, prompt: params.prompt, model: params.model, duration: params.duration, resolution: params.resolution, fps: params.fps ?? 24, generate_audio: params.generate_audio ?? false, ...(params.last_frame_uri && { last_frame_uri: params.last_frame_uri }), ...(params.camera_motion && { camera_motion: params.camera_motion }) }, execution)
  return (await callLtxApi('image-to-video', params as LtxRequest<'image-to-video'>, execution && 'save' in execution ? executionForCheckpoint(execution) : execution)).videoBuffer
}

/** Real video editing. The caller must supply probed source metadata in execution. */
export async function retakeVideo(params: LtxRequest<'retake'>, execution: LtxExecution): Promise<ArrayBuffer> {
  return (await callLtxApi('retake', params, execution)).videoBuffer
}

export async function extendVideo(params: LtxRequest<'extend'>, execution: LtxExecution): Promise<ArrayBuffer> {
  return (await callLtxApi('extend', params, execution)).videoBuffer
}

export async function reframeVideo(params: LtxRequest<'video-to-video-reframe'>, execution: LtxExecution): Promise<ArrayBuffer> {
  return (await callLtxApi('video-to-video-reframe', params, execution)).videoBuffer
}

/** HDR produces an EXR ZIP, not an MP4. */
export async function videoToHdr(params: LtxRequest<'video-to-video-hdr'>, execution: LtxExecution): Promise<{ exrZip: ArrayBuffer; job: LtxJob }> {
  const result = await callLtxApi('video-to-video-hdr', params, execution)
  return { exrZip: result.videoBuffer, job: result.job }
}

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
    userId?: string
    videoId?: string
    jobId?: string
    job?: LtxJobPersistence
    /** Stable scene/operation identity, retained across worker restarts. */
    operationKey?: string
    execution?: LtxExecution
  } = {}
): Promise<LtxResult> {
  const { engine, model } = selectEngine(plan, userEmail)
  const requestedQuality = options.quality ?? getMaxQuality(plan)
  if (!['720p', '1080p', '4k'].includes(requestedQuality)) throw new Error('PROVIDER_UNSUPPORTED_QUALITY')
  const quality = clampQualityToPlan(requestedQuality, plan, userEmail)
  if (quality !== requestedQuality) throw new Error('PROVIDER_QUALITY_EXCEEDS_PLAN')
  if (!options.job?.current && !options.execution) {
    const local = await tryLocalRoute({ prompt, plan, quality, userEmail, format: options.format, duration: options.duration, userId: options.userId, videoId: options.videoId })
    if (local) return local
  }
  const requestedFormat = options.format ?? '16:9'
  if (!['16:9', '9:16', '1:1'].includes(requestedFormat)) throw new Error('PROVIDER_UNSUPPORTED_FORMAT')
  if (options.lastFrameUri && !options.imageUri) throw new Error('LTX_LAST_FRAME_REQUIRES_FIRST_FRAME')
  const requestedDuration = options.duration ?? (engine === 'wan-classic' ? 5 : 6)
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) throw new Error('PROVIDER_INVALID_DURATION')
  const format = engine === 'wan-classic' ? requestedFormat : ltxCompatibleFormat(requestedFormat)
  const resolution = getResolution(format, quality)
  const duration = engine === 'wan-classic' ? requestedDuration : snapLtxDuration(model as LtxModel, quality, requestedDuration)
  if (duration < requestedDuration) throw new Error('LTX_DURATION_REQUIRES_SCENE_SPLIT')
  const track = { userId: options.userId ?? null, videoId: options.videoId ?? null, plan, engineRequested: engine, modelRequested: model }
  // WAN is an explicitly selected plan engine, never a post-submission fallback.
  if (engine === 'wan-classic') {
    if (options.job?.current || options.execution) throw new LtxJobError('SUTRA_LTX_RESUME_CONFLICT', options.job?.current?.v2 ?? null)
    if (options.imageUri || options.lastFrameUri || options.cameraMotion) throw new Error('WAN_UNSUPPORTED_REFERENCE_OR_CAMERA')
    return generateWanVideoWithTracking({ prompt, quality, format, duration, userEmail, track, fallbackTriggered: false, fallbackReason: null })
  }
  const endpoint = options.imageUri ? 'image-to-video' : 'text-to-video'
  const input = {
    prompt, model: model as LtxModel, duration, resolution,
    ...(options.cameraMotion && { camera_motion: options.cameraMotion }),
    ...(options.imageUri && { image_uri: options.imageUri }),
    ...(options.lastFrameUri && { last_frame_uri: options.lastFrameUri }),
  }
  // Reject invalid/unsupported requests before touching the journal.
  validateLtxRequest(endpoint, input)
  const execution = options.execution ?? (options.job ? executionForCheckpoint(options.job) : undefined)
  if (!execution) throw new LtxJobError('LTX_DURABLE_CONTEXT_REQUIRED', null)
  if (options.job?.current && !options.job.current.v2) {
    const videoBuffer = options.imageUri
      ? await imageToVideo(input as LtxImageToVideoRequest, options.job)
      : await textToVideo(input as LtxTextToVideoRequest, options.job)
    return { videoBuffer, engine, model, duration, resolution }
  }
  const start = Date.now()
  try {
    const { videoBuffer, job } = await callLtxApi(endpoint, input as LtxRequest<typeof endpoint>, execution)
    recordLtxSuccess()
    await logVideoGeneration({ ...track, engineUsed: 'ltx', modelUsed: model, fallbackTriggered: false, fallbackReason: null, durationMs: Date.now() - start, success: true, errorMessage: null,
      requestMetadata: { provider_job_id: job.id, api_version: 2, remote_status: job.remoteStatus, estimated_cost_usd: job.cost.estimated, actual_cost_usd: null, actual_cost_status: job.cost.actualStatus } })
    // Signed URLs remain in the server-only journal, not public provenance.
    const { output: _output, ...provenance } = job
    void _output
    return { videoBuffer, engine, model, duration, resolution, provenance }
  } catch (err) {
    recordLtxFailure()
    throw err // Never turn an uncertain paid operation into another provider call.
  }
}

// ---------------------------------------------------------------------------
// Generate all scenes — replaces runpod.generateAllScenes as primary
// ---------------------------------------------------------------------------

export async function generateAllScenes(
  scenes: Array<{ prompt: string; duration_seconds: number }>,
  plan: Plan,
  userEmail: string | null,
  options: { format?: string; quality?: string; cameraMotion?: CameraMotion; userId?: string; videoId?: string; jobId?: string; operationKey?: string } = {}
): Promise<Array<{ url: string; engine: VideoEngine }>> {
  const results: Array<{ url: string; engine: VideoEngine }> = []

  // Generate scenes sequentially to avoid rate limits on LTX
  for (const [index, scene] of scenes.entries()) {
    const result = await generateVideoSmart(scene.prompt, plan, userEmail, {
      userId: options.userId, videoId: options.videoId, jobId: options.jobId,
      operationKey: `${options.operationKey ?? 'scenes'}:${index}`,
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
