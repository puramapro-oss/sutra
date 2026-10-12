import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase'
import { autoOccurrences } from '@/lib/sutra-auto-utils'
import { publishAutoVideoRecord, type AutoConfig } from '@/lib/sutra-auto'
import { submissionIdentity, submitVideoJob } from '@/lib/pipeline-submit'
import type { AutoJobInput } from '@/lib/auto-pipeline'
import type { Profile } from '@/types'

export const maxDuration = 300

/** Schedule work only. All generation uses the existing durable video worker. */
export async function GET(request: Request) {
  const authError = assertCronAuth(request)
  if (authError) return authError
  const service = createServiceClient()
  const now = new Date()
  const { data: configs, error } = await service.from('sutra_auto_config').select('*')
  if (error) return NextResponse.json({ error: 'Lecture des planifications impossible' }, { status: 503 })
  const processed: Array<{ user_id: string; status: string; error?: string }> = []

  for (const config of (configs ?? []) as AutoConfig[]) {
    try {
      // Reconcile in-flight/partial records even when generation or auto-publish
      // has been disabled. This mode makes GET calls only, never POST/retry.
      const pending = await service.from('sutra_auto_videos').select('id').eq('user_id', config.user_id)
        .in('status', ['publishing', 'partially_published']).order('scheduled_for').limit(20)
      if (pending.error) throw new Error('Lecture reconciliation impossible')
      for (const video of pending.data ?? []) {
        try {
          const result = await publishAutoVideoRecord(config.user_id, video.id, false, service, undefined, {}, true)
          processed.push({ user_id: config.user_id, status: 'reconciliationRequired' in result ? 'publication_unconfirmed' : result.status })
        } catch (err) {
          processed.push({ user_id: config.user_id, status: 'publication_unconfirmed', error: err instanceof Error ? err.message : 'Erreur reconciliation' })
        }
      }
      if (!config.is_active) continue
      // Publication due is independent of the next future generation occurrence.
      if (config.auto_publish && !config.require_approval_before_publish) {
        const { data: ready, error: readyError } = await service.from('sutra_auto_videos')
          .select('id').eq('user_id', config.user_id).in('status', ['ready', 'publishing', 'partially_published'])
          .lte('scheduled_for', now.toISOString()).order('scheduled_for').limit(20)
        if (readyError) throw new Error('Lecture des publications dues impossible')
        for (const video of ready ?? []) {
          try {
            const result = await publishAutoVideoRecord(config.user_id, video.id, false, service)
            processed.push({ user_id: config.user_id, status: result.status })
          } catch (err) {
            processed.push({ user_id: config.user_id, status: 'publication_unconfirmed', error: err instanceof Error ? err.message : 'Erreur publication' })
          }
        }
      }

      // Recover one missed hourly interval and prepare the next three hours.
      const from = new Date(now.getTime() - 60 * 60 * 1000 - 1)
      const through = new Date(now.getTime() + 3 * 60 * 60 * 1000)
      const occurrences = autoOccurrences(config.schedules ?? [], from, through)
      if (!occurrences.length) continue
      const { data: profile, error: profileError } = await service.from('profiles').select('*').eq('id', config.user_id).single()
      if (profileError || !profile) throw new Error('Profil et quota non verifiables')

      for (const { schedule, at } of occurrences) {
        const input: AutoJobInput = {
          userId: config.user_id, videoRowId: randomUUID(), scheduleId: schedule.id,
          userEmail: profile.email ?? null, planTier: profile.plan ?? 'free', config,
          generationStartedAt: now.toISOString(),
        }
        const identity = submissionIdentity(`auto-occurrence-${config.user_id}`, { scheduleId: schedule.id, at: at.toISOString() })
        const job = await submitVideoJob(profile as Profile, {
          kind: 'auto', videoId: null, input, ...identity,
          initialVideo: { schedule_id: schedule.id, scheduled_for: at.toISOString(), generation_started_at: now.toISOString() },
        })
        processed.push({ user_id: config.user_id, status: job.status })
      }
    } catch (err) {
      processed.push({ user_id: config.user_id, status: 'error', error: err instanceof Error ? err.message : 'Erreur' })
    }
  }
  const hasErrors = processed.some(item => ['error', 'failed', 'partially_published', 'publication_unconfirmed'].includes(item.status))
  return NextResponse.json({ status: hasErrors ? 'partial_failure' : 'ok', processed_count: processed.length, processed })
}
