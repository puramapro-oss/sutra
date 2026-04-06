/**
 * /api/auto/generate
 * Declenche manuellement la generation de la prochaine video pour un user.
 * Pipeline complet: plan → assets → ready (status pending_approval ou publishing).
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
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

    // 1. Plan
    const plan = await planNextVideo({
      config: ctx.config,
      themes: ctx.themes,
      memories: ctx.memories,
      recentVideos: ctx.recentVideos,
      topVideos: ctx.topVideos,
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
        plan_tier: (profile?.plan ?? 'free') as 'free' | 'starter' | 'creator' | 'pro' | 'enterprise',
      })

      const finalStatus = ctx.config.require_approval_before_publish ? 'pending_approval' : 'ready'
      await service
        .from('sutra_auto_videos')
        .update({
          status: finalStatus,
          video_raw_url: assets.video_raw_url,
          video_final_url: assets.video_raw_url, // sans compositing avance, on prend le brut
          audio_music_url: assets.audio_music_url,
          audio_voice_url: assets.audio_voice_url,
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
