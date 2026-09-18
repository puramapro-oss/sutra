/**
 * /api/auto/generate
 * Declenche manuellement la generation de la prochaine video pour un user.
 * Pipeline complet: plan → assets → ready (status pending_approval ou publishing).
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { checkLimits } from '@/lib/limits'
import { assembleFinalVideo, generateSubtitlesFromScript } from '@/lib/shotstack'
import type { Plan } from '@/types'
import {
  loadAutoContext,
  planNextVideo,
  generateAutoVideoAssets,
  recordMemory,
  type AutoConfig,
} from '@/lib/sutra-auto'

export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const scheduleId: string | null = body.schedule_id ?? null

    const ctx = await loadAutoContext(user.id)
    if (!ctx.config) {
      return NextResponse.json({ error: 'Configuration auto introuvable' }, { status: 400 })
    }

    const service = createServiceClient()

    // Garde de quota AVANT tout appel payant (audit #8) : la génération
    // autonome consomme le même budget que /api/create — plus de contournement.
    const { data: quotaProfile } = await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (quotaProfile) {
      const within = await checkLimits(quotaProfile as never)
      if (!within) {
        return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan.' }, { status: 403 })
      }
    }

    // 1. Plan
    const plan = await planNextVideo({
      config: ctx.config,
      themes: ctx.themes,
      memories: ctx.memories,
      recentVideos: ctx.recentVideos,
      topVideos: ctx.topVideos,
      userId: user.id,
    })

    // 2. Insert video record (planning)
    const { data: videoRow, error: insErr } = await service
      .from('sutra_auto_videos')
      .insert({
        user_id: user.id,
        schedule_id: scheduleId,
        theme_id: plan.theme_id,
        status: 'generating_video',
        title: plan.title,
        description: plan.description,
        hashtags: plan.hashtags,
        script: plan.script,
        prompt_used: plan.video_prompt,
        music_prompt: plan.music_prompt,
        ai_reasoning: plan.reasoning,
        ai_confidence: plan.expected_engagement === 'high' ? 0.9 : plan.expected_engagement === 'medium' ? 0.6 : 0.3,
        generation_started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insErr || !videoRow) throw insErr ?? new Error('Insert echoue')

    // 3. Generate assets (long running)
    const { data: profile } = await service
      .from('profiles')
      .select('plan, email')
      .eq('id', user.id)
      .single()

    try {
      const assets = await generateAutoVideoAssets({
        videoId: videoRow.id,
        plan,
        config: ctx.config as AutoConfig,
        userEmail: profile?.email ?? null,
        plan_tier: (profile?.plan ?? 'free') as Plan,
      })

      // Montage FINAL (audit #12) : voix + musique assemblées au visuel —
      // video_final_url n'est PLUS l'URL brute quand l'assemblage réussit.
      let videoFinalUrl = assets.video_raw_url
      let assemblyError: string | null = null
      if (assets.audio_voice_url) {
        try {
          const duration = Math.max(1, (ctx.config as AutoConfig).default_duration ?? 6)
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
            format: (ctx.config as AutoConfig).default_aspect_ratio ?? '9:16',
            quality: (ctx.config as AutoConfig).quality_level ?? '720p',
            brandKit: null,
          })
          videoFinalUrl = assembled.url
        } catch (asmErr) {
          assemblyError = asmErr instanceof Error ? asmErr.message : String(asmErr)
          console.error('[auto/generate] assemblage echoue :', assemblyError)
        }
      }

      const finalStatus = assemblyError
        ? 'compositing_failed'
        : ctx.config.require_approval_before_publish
          ? 'pending_approval'
          : 'ready'
      await service
        .from('sutra_auto_videos')
        .update({
          status: finalStatus,
          video_raw_url: assets.video_raw_url,
          video_final_url: videoFinalUrl,
          audio_music_url: assets.audio_music_url,
          audio_voice_url: assets.audio_voice_url,
          error_message: assemblyError,
          generation_completed_at: new Date().toISOString(),
          generation_duration_seconds: Math.floor(
            (Date.now() - new Date(videoRow.generation_started_at).getTime()) / 1000
          ),
        })
        .eq('id', videoRow.id)

      await recordMemory({
        userId: user.id,
        type: 'preference',
        content: `Video generee: "${plan.title}" — theme: ${plan.theme_id ?? 'libre'}, raison: ${plan.reasoning}`,
        importance: 0.5,
        related_video_id: videoRow.id,
      })

      // Bump theme usage
      if (plan.theme_id) {
        await service
          .from('sutra_auto_themes')
          .update({ last_used_at: new Date().toISOString(), times_used: (ctx.themes.find((t) => t.id === plan.theme_id)?.times_used ?? 0) + 1 })
          .eq('id', plan.theme_id)
          .eq('user_id', user.id)
      }

      return NextResponse.json({ video: { ...videoRow, status: finalStatus, ...assets } })
    } catch (genErr) {
      await service
        .from('sutra_auto_videos')
        .update({
          status: 'failed',
          error_message: genErr instanceof Error ? genErr.message : 'Erreur generation',
        })
        .eq('id', videoRow.id)
      throw genErr
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur generation', details: message }, { status: 500 })
  }
}
