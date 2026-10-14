import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/constants'
import { isAdmin } from '@/lib/utils'
import type { Plan, Profile } from '@/types'
import type { VideoJob, VideoJobKind } from '@/lib/video-queue'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  return value
}

/** Same intent retries forever; an explicit new key requests a new generation. */
export function submissionIdentity(prefix: string, request: unknown, requestId?: string | null) {
  if (requestId != null && (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 200)) {
    throw new Error('SUTRA_INVALID_REQUEST_ID')
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical(request))).digest('hex')
  return { key: `${prefix}-${requestId ?? fingerprint}`, fingerprint }
}

/** Quota, initial video and durable task commit together, or none do. */
export async function submitVideoJob(profile: Profile, params: {
  kind: VideoJobKind; videoId: string | null; input: object; key: string; fingerprint: string
  initialVideo?: Record<string, unknown>
}): Promise<VideoJob> {
  const limit = isAdmin(profile.email) ? 0 : (PLAN_LIMITS[profile.plan as Plan] ?? PLAN_LIMITS.free).videos
  try {
    const { data, error } = await createServiceClient().rpc('submit_video_job', {
      p_user_id: profile.id, p_kind: params.kind, p_video_id: params.videoId,
      p_payload: { input: params.input }, p_key: params.key, p_request_hash: params.fingerprint,
      p_limit: limit, p_initial: params.initialVideo ?? null,
    })
    if (error) throw error
    const job = (Array.isArray(data) ? data[0] : data) as VideoJob | null
    if (!job?.id || job.user_id !== profile.id || job.kind !== params.kind || job.idempotency_key !== params.key) {
      throw new Error('SUTRA_SUBMISSION_UNCONFIRMED')
    }
    return job
  } catch (error) {
    // All consumers may expose this message. Never append an internal RPC or
    // transport diagnostic, and never retry an unconfirmed submission here.
    const code = error && typeof error === 'object' && 'message' in error ? error.message : null
    throw new Error(typeof code === 'string' && [
      'SUTRA_QUOTA_EXHAUSTED', 'SUTRA_IDEMPOTENCY_CONFLICT', 'SUTRA_INVALID_REQUEST_ID',
    ].includes(code) ? code : 'SUTRA_SUBMISSION_UNCONFIRMED')
  }
}

export function submissionErrorStatus(message: string): number {
  if (message.includes('SUTRA_QUOTA_EXHAUSTED')) return 403
  if (message.includes('SUTRA_IDEMPOTENCY_CONFLICT')) return 409
  if (message.includes('SUTRA_INVALID_REQUEST_ID')) return 400
  return 503
}
