import { NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase'
import { autoOccurrences } from '@/lib/sutra-auto-utils'
import { publishAutoVideoRecord, type AutoConfig } from '@/lib/sutra-auto'
import { reserveQuota, releaseQuota, enqueueJob } from '@/lib/video-queue'
import type { AutoJobInput } from '@/lib/auto-pipeline'
import type { Profile } from '@/types'

export const maxDuration = 300

/** Schedule work only. All generation uses the existing durable video worker. */
export async function GET(request: Request) {
  const authError = assertCronAuth(request)
  if (authError) return authError
  const service = createServiceClient()
  const now = new Date()
  const { data: configs, error } = await service.from('sutra_auto_config').select('*').eq('is_active', true)
  if (error) return NextResponse.json({ error: 'Lecture des planifications impossible' }, { status: 503 })
  const processed: Array<{ user_id: string; status: string; error?: string }> = []

  for (const config of (configs ?? []) as AutoConfig[]) {
    try {
      // Publication due is independent of the next future generation occurrence.
      if (config.auto_publish && !config.require_approval_before_publish) {
        const { data: ready, error: readyError } = await service.from('sutra_auto_videos')
          .select('id').eq('user_id', config.user_id).eq('status', 'ready')
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
        // The unique index arbitrates concurrent crons BEFORE any paid planning.
        const { data: row, error: insertError } = await service.from('sutra_auto_videos').insert({
          user_id: config.user_id, schedule_id: schedule.id, scheduled_for: at.toISOString(),
          status: 'planning', generation_started_at: now.toISOString(),
        }).select('id').single()
        if (insertError?.code === '23505') {
          processed.push({ user_id: config.user_id, status: 'skipped_existing_occurrence' })
          continue
        }
        if (insertError || !row) throw new Error('Enregistrement occurrence impossible')

        let reserved = false
        try {
          reserved = await reserveQuota(profile as Profile)
          if (!reserved) throw new Error('Quota de generation epuise')
          const input: AutoJobInput = {
            userId: config.user_id, videoRowId: row.id, scheduleId: schedule.id,
            userEmail: profile.email ?? null, planTier: profile.plan ?? 'free', config,
            generationStartedAt: now.toISOString(),
          }
          await enqueueJob({ videoId: null, userId: config.user_id, kind: 'auto', payload: { input }, idempotencyKey: `auto-${row.id}` })
          reserved = false
          processed.push({ user_id: config.user_id, status: 'queued' })
        } catch (err) {
          if (reserved) await releaseQuota(config.user_id)
          const message = err instanceof Error ? err.message : 'Erreur file'
          const { error: updateError } = await service.from('sutra_auto_videos')
            .update({ status: 'failed', error_message: message }).eq('id', row.id).eq('user_id', config.user_id)
          if (updateError) throw new Error('Echec de mise en file non enregistre')
          processed.push({ user_id: config.user_id, status: 'failed', error: message })
        }
      }
    } catch (err) {
      processed.push({ user_id: config.user_id, status: 'error', error: err instanceof Error ? err.message : 'Erreur' })
    }
  }
  const hasErrors = processed.some(item => ['error', 'failed', 'publication_unconfirmed'].includes(item.status))
  return NextResponse.json({ status: hasErrors ? 'partial_failure' : 'ok', processed_count: processed.length, processed })
}
