/**
 * CRON: chaque heure
 * Pour chaque user avec config active, regarde si une video doit etre planifiee
 * dans les 3 prochaines heures et la genere en avance.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  loadAutoContext,
  planNextVideo,
  generateAutoVideoAssets,
  publishAutoVideo,
  computeNextRun,
  recordMemory,
  type AutoConfig,
  type AutoSchedule,
} from '@/lib/sutra-auto'

export const maxDuration = 300
const CRON_SECRET = process.env.CRON_SECRET

interface ProfileLite {
  id: string
  email: string | null
  plan: string
}

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const horizonMs = 3 * 60 * 60 * 1000 // 3h
  const now = new Date()
  const horizon = new Date(now.getTime() + horizonMs)

  const { data: configs } = await supabase
    .from('sutra_auto_config')
    .select('*')
    .eq('is_active', true)

  const processed: Array<{ user_id: string; status: string; error?: string }> = []

  for (const config of (configs ?? []) as AutoConfig[]) {
    try {
      const schedules = (config.schedules ?? []) as AutoSchedule[]
      const due = schedules.filter((s) => {
        const next = computeNextRun(s, now)
        return next && next <= horizon
      })
      if (!due.length) continue

      // Avoid double-generation: skip if a video is already pending for this user in next 3h
      const { data: pending } = await supabase
        .from('sutra_auto_videos')
        .select('id')
        .eq('user_id', config.user_id)
        .in('status', ['planning', 'generating_video', 'generating_audio', 'compositing'])
        .limit(1)
      if (pending && pending.length) {
        processed.push({ user_id: config.user_id, status: 'skipped_pending' })
        continue
      }

      const ctx = await loadAutoContext(config.user_id)
      if (!ctx.config) continue

      const plan = await planNextVideo({
        config: ctx.config,
        themes: ctx.themes,
        memories: ctx.memories,
        recentVideos: ctx.recentVideos,
        topVideos: ctx.topVideos,
      })

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, plan, email')
        .eq('id', config.user_id)
        .single()
      const p = profile as ProfileLite | null

      const { data: videoRow } = await supabase
        .from('sutra_auto_videos')
        .insert({
          user_id: config.user_id,
          schedule_id: due[0].id,
          theme_id: plan.theme_id,
          status: 'generating_video',
          title: plan.title,
          description: plan.description,
          hashtags: plan.hashtags,
          script: plan.script,
          prompt_used: plan.video_prompt,
          music_prompt: plan.music_prompt,
          ai_reasoning: plan.reasoning,
          generation_started_at: new Date().toISOString(),
          scheduled_for: computeNextRun(due[0], now)?.toISOString() ?? null,
        })
        .select()
        .single()

      if (!videoRow) continue

      try {
        const assets = await generateAutoVideoAssets({
          videoId: videoRow.id,
          plan,
          config: ctx.config,
          userEmail: p?.email ?? null,
          plan_tier: (p?.plan ?? 'free') as never,
        })

        const finalStatus = ctx.config.require_approval_before_publish ? 'pending_approval' : 'ready'
        await supabase
          .from('sutra_auto_videos')
          .update({
            status: finalStatus,
            video_raw_url: assets.video_raw_url,
            video_final_url: assets.video_raw_url,
            audio_music_url: assets.audio_music_url,
            audio_voice_url: assets.audio_voice_url,
            generation_completed_at: new Date().toISOString(),
          })
          .eq('id', videoRow.id)

        // Auto publish si configure
        if (ctx.config.auto_publish && !ctx.config.require_approval_before_publish) {
          const results = await publishAutoVideo({
            config: ctx.config,
            videoUrl: assets.video_raw_url,
            title: plan.title,
            description: plan.description,
            hashtags: plan.hashtags,
          })
          const ok = results.some((r) => r.success)
          await supabase
            .from('sutra_auto_videos')
            .update({
              status: ok ? 'published' : 'failed',
              published_at: ok ? new Date().toISOString() : null,
              published_platforms: results,
            })
            .eq('id', videoRow.id)
        }

        await recordMemory({
          userId: config.user_id,
          type: 'preference',
          content: `Auto-generation: "${plan.title}"`,
          importance: 0.4,
          related_video_id: videoRow.id,
        })

        processed.push({ user_id: config.user_id, status: 'generated' })
      } catch (genErr) {
        await supabase
          .from('sutra_auto_videos')
          .update({
            status: 'failed',
            error_message: genErr instanceof Error ? genErr.message : 'Erreur',
          })
          .eq('id', videoRow.id)
        processed.push({
          user_id: config.user_id,
          status: 'failed',
          error: genErr instanceof Error ? genErr.message : 'Erreur',
        })
      }
    } catch (err) {
      processed.push({
        user_id: config.user_id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Erreur',
      })
    }
  }

  return NextResponse.json({ status: 'ok', processed_count: processed.length, processed })
}
