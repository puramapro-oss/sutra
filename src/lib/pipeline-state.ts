import { AsyncLocalStorage } from 'node:async_hooks'
import type { AssembleResult } from '@/lib/shotstack'
import type { createServiceClient } from '@/lib/supabase'

export interface PipelineHooks {
  onStepResolved?: (key: string, value: unknown) => Promise<void>
  heartbeat?: () => Promise<void>
}

/** A paid intent is durable BEFORE submission. An ambiguous result is never retried.
 * Remote-ID recovery is supplied only by adapters that poll an existing request. */
export function pipelineSteps(done: Record<string, unknown>, hooks: PipelineHooks) {
  const pending = new Map<string, Promise<unknown>>()
  const save = async (key: string, value: unknown) => {
    await hooks.onStepResolved?.(key, value)
    done[key] = value
  }
  const step = <T>(key: string, run: () => Promise<T>, paid = false, recover = false): Promise<T> => {
    if (done[key] !== undefined) return Promise.resolve(done[key] as T)
    if (pending.has(key)) return pending.get(key) as Promise<T>
    const promise = (async () => {
      await hooks.heartbeat?.()
      if (paid) {
        if (done[`${key}:started`] && !recover) throw new Error(`SUTRA_RECONCILIATION_REQUIRED: ${key}`)
        await save(`${key}:started`, true)
      }
      const result = await run()
      if (result === undefined) throw new Error(`SUTRA_CHECKPOINT_EMPTY: ${key}`)
      await save(key, result)
      return result
    })()
    pending.set(key, promise)
    return promise.finally(() => pending.delete(key))
  }
  return step
}

export type PipelineStage = 'script' | 'scenes' | 'images' | 'voice' | 'music' | 'subtitles' | 'composition' | 'export' | 'publication'
export async function checkpointStage(
  done: Record<string, unknown>, hooks: PipelineHooks, stage: PipelineStage,
  value: unknown, status: 'complete' | 'skipped' | 'pending' = 'complete',
) {
  return pipelineSteps(done, hooks)(`stage:${stage}`, async () => ({ status, value }))
}

/** Cached booleans and provider URLs are not proof of a composed final file. */
export function assertFinalMedia(media: AssembleResult, rawUrls: string[], requireAudio: boolean) {
  const proof = media.verification
  if (!media.outputVerified || !proof || proof.url !== media.url || !/^[a-f\d]{64}$/.test(proof.sha256)
      || rawUrls.includes(media.url) || !Number.isFinite(media.duration) || media.duration <= 0
      || proof.width !== media.outputSize.width || proof.height !== media.outputSize.height
      || !Number.isFinite(proof.duration) || Math.abs(proof.duration - media.duration) > 0.1
      || !Number.isFinite(proof.fps) || proof.fps <= 0 || proof.width <= 0 || proof.height <= 0
      || (requireAudio && !proof.hasAudio)) {
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: final media proof missing or raw media')
  }
}

export function requireTracks(voice: string | null | undefined, music: string | null | undefined,
  required: { voice: boolean; music: boolean }) {
  if (required.voice && !voice?.trim()) throw new Error('SUTRA_REQUIRED_VOICE_MISSING')
  if (required.music && !music?.trim()) throw new Error('SUTRA_REQUIRED_MUSIC_MISSING')
}

const lease = new AsyncLocalStorage<{ jobId: string; worker: string }>()
export function withPipelineLease<T>(jobId: string, worker: string, run: () => Promise<T>): Promise<T> {
  return lease.run({ jobId, worker }, run)
}

/** The DB locks the job and validates the lease in the SAME transaction as the write. */
export async function persistPipelineVideo(service: ReturnType<typeof createServiceClient>,
  table: 'videos' | 'sutra_auto_videos', id: string, values: Record<string, unknown>, insert = false) {
  const owner = lease.getStore()
  if (!owner) throw new Error('SUTRA_JOB_LEASE_REQUIRED')
  const { data, error } = await service.rpc('persist_video_job_video', {
    p_job_id: owner.jobId, p_worker: owner.worker, p_table: table, p_id: id, p_values: values, p_insert: insert,
  })
  if (error || data !== true) throw new Error(`SUTRA_VIDEO_PERSISTENCE_FAILED: ${error?.message ?? 'write not confirmed'}`)
  return { id }
}

/** Operational writes share the generation lease and an atomic deduplication key. */
export async function pipelineEvent(table: 'api_logs' | 'activity_logs' | 'user_notifications', key: string, values: Record<string, unknown>) {
  const owner = lease.getStore()
  if (!owner) return // Injectable provider unit tests have no business DB session.
  const { createServiceClient } = await import('@/lib/supabase')
  const { data, error } = await createServiceClient().rpc('record_video_job_event', {
    p_job_id: owner.jobId, p_worker: owner.worker, p_table: table, p_key: key, p_values: values,
  })
  if (error || data !== true) throw new Error(`SUTRA_EVENT_PERSISTENCE_FAILED: ${error?.message ?? 'write not confirmed'}`)
}
export async function pipelineLog(userId: string | null, service: string, endpoint: string, status: string, responseTimeMs?: number, errorMessage?: string) {
  await pipelineEvent('api_logs', `${service}:${endpoint}:${status}`, { user_id: userId, service, endpoint, status, response_time_ms: responseTimeMs ?? null, error_message: errorMessage ?? null })
}
export async function pipelineNotification(userId: string, notification: { type: string; title: string; message: string }) {
  await pipelineEvent('user_notifications', 'ready', { user_id: userId, ...notification })
}
export async function pipelineActivity(userId: string, type: string, description: string, metadata?: Record<string, unknown>) {
  await pipelineEvent('activity_logs', type, { user_id: userId, type, description, metadata: metadata ?? null })
}
