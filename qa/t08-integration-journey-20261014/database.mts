// Persistence-port fixture only. This is NOT a PostgreSQL/RLS/transaction proof.
// Reuses T06's table/CAS fixture; queue RPC receipts are the only added boundary.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { socialDatabase, type Row } from '../../scripts/helpers/social-database.mts'
import type { VideoJob } from '../../src/lib/video-queue.ts'

export function journeyDatabase() {
  const social = socialDatabase()
  const tables = social.tables as unknown as Record<string, Row[]>
  tables.videos.length = 0
  tables.video_jobs.length = 0
  tables.social_autopilot_config = []
  Object.assign(social.profile, { email: 'client@fixture.invalid', plan: 'free' })
  const jobs = tables.video_jobs as unknown as Array<VideoJob & { request_hash: string }>
  const events = new Map<string, Row>()
  const calls: Array<{ name: string; args: Row }> = []
  const faults = { quota: false, submit: false, persistReady: false, checkpoint: '' }
  let reservations = 0, settlements = 0
  const failure = (message: string) => ({ data: null, error: { message } })
  const ok = (data: unknown) => ({ data: structuredClone(data), error: null })
  const rpc = async (name: string, args: Row) => {
    // Supabase transports JSON: callbacks/undefined never reach PostgreSQL.
    args = JSON.parse(JSON.stringify(args)) as Row
    calls.push({ name, args: structuredClone(args) })
    if (name === 'submit_video_job') {
      if (faults.submit) return failure('fixture database unavailable')
      const existing = jobs.find(j => j.idempotency_key === args.p_key)
      if (existing) return existing.request_hash === args.p_request_hash
        ? ok([existing]) : failure('SUTRA_IDEMPOTENCY_CONFLICT')
      if (faults.quota) return failure('SUTRA_QUOTA_EXHAUSTED')
      const job = { id: randomUUID(), user_id: args.p_user_id, video_id: args.p_video_id,
        kind: args.p_kind, payload: args.p_payload, idempotency_key: args.p_key,
        request_hash: args.p_request_hash, progress: {}, provider_job_ids: {}, status: 'queued',
        attempts: 0, max_attempts: 3, locked_by: null, last_error: null } as typeof jobs[number]
      jobs.push(structuredClone(job)); reservations++
      if (args.p_initial) tables.videos.push({ ...structuredClone(args.p_initial as Row),
        id: args.p_video_id, user_id: args.p_user_id, status: 'generating', publish_data: null })
      return ok([job])
    }
    if (name === 'claim_video_job_by_key') {
      const job = jobs.find(j => j.idempotency_key === args.p_key)
      if (!job || job.status !== 'queued') return ok([])
      job.status = 'processing'; job.locked_by = args.p_worker as string; job.attempts++
      return ok([job])
    }
    const job = jobs.find(j => j.id === args.p_job_id)
    if (!job || job.status !== 'processing' || job.locked_by !== args.p_worker) return ok(false)
    if (name === 'heartbeat_video_job_v2') return ok(true)
    if (name === 'checkpoint_video_job_v2') {
      const delta = args.p_progress as Row
      if (faults.checkpoint && Object.hasOwn((delta.steps ?? {}) as object, faults.checkpoint)) return failure('fixture checkpoint unavailable')
      for (const [key, value] of Object.entries(delta)) {
        job.progress[key] = ['steps', 'scenes'].includes(key)
          ? { ...(job.progress[key] as Row ?? {}), ...structuredClone(value as Row) } : structuredClone(value)
      }
      return ok(true)
    }
    if (name === 'persist_video_job_video') {
      const values = args.p_values as Row
      if (faults.persistReady && values.status === 'ready') return failure('fixture persistence unavailable')
      const row = tables[String(args.p_table)]?.find(r => r.id === args.p_id && r.user_id === job.user_id)
      assert.ok(row, 'pipeline must persist the same owned project')
      Object.assign(row, structuredClone(values)); return ok(true)
    }
    if (name === 'record_video_job_event') {
      const values = args.p_values as Row
      assert.equal(values.user_id, job.user_id)
      events.set(`${job.id}:${args.p_table}:${args.p_key}`, structuredClone(values)); return ok(true)
    }
    if (name === 'finish_video_job') {
      job.status = args.p_status as VideoJob['status']; job.last_error = args.p_error as string | null
      job.locked_by = null
      if (job.status === 'done') settlements++
      return ok(job.status)
    }
    throw new Error(`T08_UNEXPECTED_RPC:${name}`)
  }
  const client = Object.assign(social.client as object, { rpc })
  return { ...social, client, tables, jobs, events, calls, faults,
    accounting: () => ({ reservations, settlements }) }
}
