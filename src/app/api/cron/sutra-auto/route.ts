import { NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase'
import { publishAutoVideoRecord } from '@/lib/sutra-auto'
import { scheduleAutoWindow, type ScheduledConfig } from '@/lib/auto-scheduler'
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

  for (const config of (configs ?? []) as ScheduledConfig[]) {
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

      const { data: profile, error: profileError } = await service.from('profiles').select('*').eq('id', config.user_id).single()
      if (profileError || !profile) throw new Error('Profil et quota non verifiables')
      const window = await scheduleAutoWindow(service, config, profile as Profile, now)
      for (const job of window.jobs) processed.push({ user_id: config.user_id, status: job.status })
      if (window.backlog) processed.push({ user_id: config.user_id, status: 'scheduling_catchup_pending' })
    } catch (err) {
      processed.push({ user_id: config.user_id, status: 'error', error: err instanceof Error ? err.message : 'Erreur' })
    }
  }
  const hasErrors = processed.some(item => ['error', 'failed', 'partially_published', 'publication_unconfirmed', 'reconciliation_required', 'scheduling_catchup_pending'].includes(item.status))
  return NextResponse.json({ status: hasErrors ? 'partial_failure' : 'ok', processed_count: processed.length, processed })
}
