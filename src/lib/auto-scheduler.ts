import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/constants'
import { isAdmin } from '@/lib/utils'
import { submissionIdentity } from '@/lib/pipeline-submit'
import { isValidAutoSchedules } from '@/lib/auto-schedule-validation'
import { autoOccurrences } from '@/lib/sutra-auto-utils'
import type { AutoConfig } from '@/lib/sutra-auto-types'
import type { AutoJobInput } from '@/lib/auto-pipeline'
import type { VideoJob } from '@/lib/video-queue'
import type { Plan, Profile } from '@/types'

// Exhaustive against the canonical queue type; never acknowledge an unknown state.
const JOB_STATUS: Record<VideoJob['status'], true> = {
  queued: true, processing: true, done: true, failed: true, cancelled: true, reconciliation_required: true,
}

export type ScheduledConfig = AutoConfig & { scheduler_cursor?: string; updated_at?: string }

/** One bounded window per tick. SQL commits its jobs, quotas and cursor together.
 * No worker/provider is invoked here. A lost response is reconciled by re-reading
 * the cursor on the next tick; existing occurrence identities remain unchanged. */
export async function scheduleAutoWindow(
  service: ReturnType<typeof createServiceClient>, config: ScheduledConfig, profile: Profile, now: Date,
) {
  const from = new Date(config.scheduler_cursor ?? '')
  const horizon = now.getTime() + 3 * 60 * 60 * 1000
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(horizon) || !config.updated_at) {
    throw new Error('SUTRA_SCHEDULER_MIGRATION_REQUIRED')
  }
  if (!isValidAutoSchedules(config.schedules)) throw new Error('SUTRA_SCHEDULE_INVALID')
  if (from.getTime() >= horizon) return { jobs: [], backlog: false }
  const through = new Date(Math.min(horizon, from.getTime() + 24 * 60 * 60 * 1000))
  const jobs = autoOccurrences(config.schedules ?? [], from, through).map(({ schedule, at }) => {
    const input: AutoJobInput = {
      userId: config.user_id, videoRowId: randomUUID(), scheduleId: schedule.id,
      userEmail: profile.email ?? null, planTier: profile.plan ?? 'free', config,
      generationStartedAt: now.toISOString(),
    }
    return {
      ...submissionIdentity(`auto-occurrence-${config.user_id}`, { scheduleId: schedule.id, at: at.toISOString() }),
      input, initial: { schedule_id: schedule.id, scheduled_for: at.toISOString(), generation_started_at: now.toISOString() },
    }
  })
  const limit = isAdmin(profile.email) ? 0 : (PLAN_LIMITS[profile.plan as Plan] ?? PLAN_LIMITS.free).videos
  try {
    const { data, error } = await service.rpc('schedule_auto_video_jobs', {
      p_user_id: config.user_id, p_from: config.scheduler_cursor, p_through: through.toISOString(),
      p_updated_at: config.updated_at, p_jobs: jobs, p_limit: limit,
    })
    if (error || !data || data.cursor !== through.toISOString() || !Array.isArray(data.jobs) || data.jobs.length !== jobs.length
      || data.jobs.some((job: { id?: string; user_id?: string; kind?: string; idempotency_key?: string; status?: string }, i: number) =>
        !job?.id || !Object.hasOwn(JOB_STATUS, job.status ?? '') || job.user_id !== config.user_id || job.kind !== 'auto' || job.idempotency_key !== jobs[i].key)) {
      throw new Error('SUTRA_SCHEDULING_UNCONFIRMED')
    }
    return { jobs: data.jobs as VideoJob[], backlog: through.getTime() < horizon }
  } catch {
    // SQL/transport details may contain private data. Never retry this RPC inline.
    throw new Error('SUTRA_SCHEDULING_UNCONFIRMED')
  }
}
