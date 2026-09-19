/**
 * CRON: chaque heure
 * Pour chaque user avec config active, regarde si une video doit etre planifiee
 * dans les 3 prochaines heures et la genere en avance.
 *
 * Garanties (audit #11/#12) :
 *   - CRON_SECRET OBLIGATOIRE : sans secret configuré, le cron refuse (500)
 *     au lieu de s'exécuter sans authentification.
 *   - Unicité par occurrence : une vidéo existe pour (schedule_id, slot) →
 *     jamais de double génération pour le même créneau.
 *   - Publication à l'heure prévue : la vidéo n'est publiée qu'à/après
 *     scheduled_for, avec scheduledFor transmis au fournisseur.
 *   - Vidéo FINALE assemblée (voix + musique) publiée — jamais l'URL brute.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { assembleFinalVideo, generateSubtitlesFromScript } from '@/lib/shotstack'
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

interface ProfileLite {
  id: string
  email: string | null
  plan: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  // Fail-closed : un cron sans secret configuré ne doit JAMAIS s'exécuter
  // (audit #11 — la reproduction fonctionnait sans en-tête d'autorisation).
  if (!cronSecret) {
    console.error('[auto-plan] CRON_SECRET non configure — execution refusee')
    return NextResponse.json(
      { error: 'CRON_SECRET non configure : definis-le avant d\'activer le cron (aucune execution non authentifiee)' },
      { status: 500 }
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
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

      const slot = computeNextRun(due[0], now)
      const slotIso = slot?.toISOString() ?? null
      if (!slotIso) continue

      // ---------------------------------------------------------------
      // Unicité d'occurrence : (schedule_id, scheduled_for) déjà traité →
      // on PUBLIE si c'est l'heure, sinon on ne régénère JAMAIS (audit #11).
      // ---------------------------------------------------------------
      const { data: existing } = await supabase
        .from('sutra_auto_videos')
        .select('*')
        .eq('user_id', config.user_id)
        .eq('schedule_id', due[0].id)
        .eq('scheduled_for', slotIso)
        .limit(1)

      const already = existing?.[0]
      if (already) {
        if (
          already.status === 'ready' &&
          !already.published_at &&
          config.auto_publish &&
          !config.require_approval_before_publish &&
          already.video_final_url &&
          slot &&
          now >= slot
        ) {
          // Heure venue : publication de la vidéo ASSEMBLÉE, planifiée au créneau.
          const results = await publishAutoVideo({
            config,
            videoUrl: already.video_final_url,
            title: already.title,
            description: already.description ?? '',
            hashtags: (already.hashtags ?? []) as string[],
            scheduledFor: slotIso,
          })
          const ok = results.some((r) => r.success)
          await supabase
            .from('sutra_auto_videos')
            .update({
              status: ok ? 'published' : 'publish_failed',
              published_at: ok ? new Date().toISOString() : null,
              published_platforms: results,
            })
            .eq('id', already.id)
          processed.push({ user_id: config.user_id, status: ok ? 'published_on_time' : 'publish_failed' })
          continue
        }
        // Occurrence déjà générée (ou en cours, ou publiée) → rien à faire.
        processed.push({ user_id: config.user_id, status: 'skipped_existing_occurrence' })
        continue
      }

      // Anti-chevauchement : génération déjà en cours pour cet user.
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
          scheduled_for: slotIso,
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

        // -------------------------------------------------------------
        // Montage FINAL avant toute publication (audit #12) : voix et
        // musique sont ASSEMBLÉES au visuel — on ne publie jamais l'URL
        // brute sans piste audio. Échec de montage = pas de publication.
        // -------------------------------------------------------------
        let videoFinalUrl = assets.video_raw_url
        let assemblyError: string | null = null
        if (assets.audio_voice_url) {
          try {
            const duration = Math.max(1, ctx.config.default_duration ?? 6)
            const subtitles = plan.script
              ? generateSubtitlesFromScript(plan.script, [{ duration_seconds: duration }])
              : []
            const assembled = await assembleFinalVideo({
              clips: [{ url: assets.video_raw_url, type: 'ia', kind: 'video', duration }],
              voiceUrl: assets.audio_voice_url,
              musicUrl: assets.audio_music_url ?? '',
              musicVolume: 0.3,
              subtitles,
              transitions: 'fade',
              format: ctx.config.default_aspect_ratio ?? '9:16',
              quality: ctx.config.quality_level ?? '720p',
              brandKit: null,
            })
            videoFinalUrl = assembled.url
          } catch (asmErr) {
            assemblyError = asmErr instanceof Error ? asmErr.message : String(asmErr)
            console.error('[auto-plan] assemblage echoue — publication REFUSEE :', assemblyError)
          }
        }

        const finalStatus = assemblyError
          ? 'compositing_failed'
          : ctx.config.require_approval_before_publish
            ? 'pending_approval'
            : 'ready'
        await supabase
          .from('sutra_auto_videos')
          .update({
            status: finalStatus,
            video_raw_url: assets.video_raw_url,
            video_final_url: videoFinalUrl,
            audio_music_url: assets.audio_music_url,
            audio_voice_url: assets.audio_voice_url,
            error_message: assemblyError,
            generation_completed_at: new Date().toISOString(),
          })
          .eq('id', videoRow.id)

        // Publication SEULEMENT à/après l'heure prévue (audit #11) : la vidéo
        // est générée en avance mais publiée au créneau, jamais avant.
        const shouldPublishNow =
          !assemblyError &&
          ctx.config.auto_publish &&
          !ctx.config.require_approval_before_publish &&
          slot instanceof Date &&
          now >= slot

        if (shouldPublishNow) {
          const results = await publishAutoVideo({
            config: ctx.config,
            videoUrl: videoFinalUrl,
            title: plan.title,
            description: plan.description,
            hashtags: plan.hashtags,
            scheduledFor: slotIso,
          })
          const ok = results.some((r) => r.success)
          await supabase
            .from('sutra_auto_videos')
            .update({
              status: ok ? 'published' : 'publish_failed',
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
