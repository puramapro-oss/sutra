import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { checkLimits } from '@/lib/limits'
import { generateScript } from '@/lib/claude'
import { generateVisualWithFallback, generateMusicWithFallback, generateVoiceWithFallback } from '@/lib/fallbacks'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo, generateSubtitlesFromScript } from '@/lib/shotstack'
import { logApiCall, logActivity, sendNotification } from '@/lib/logger'
import type { Plan, Profile, ScriptData } from '@/types'

export const maxDuration = 120

const TEMPLATE_CONFIGS: Record<string, { durationHint: string; sceneCount: number }> = {
  youtube: { durationHint: '8-12 minutes', sceneCount: 12 },
  tiktok: { durationHint: '30-60 secondes', sceneCount: 4 },
  reel: { durationHint: '15-30 secondes', sceneCount: 3 },
  docu: { durationHint: '10-20 minutes', sceneCount: 15 },
  tuto: { durationHint: '3-8 minutes', sceneCount: 8 },
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const { step, idea, template, format, engine, voice, musicStyle, tone, previousData } = body

    if (!idea || !step) {
      return NextResponse.json({ error: 'Parametres manquants' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    const userPlan = (profile as Profile).plan ?? 'free'

    // Step-by-step production
    if (step === 'script') {
      const config = TEMPLATE_CONFIGS[template] ?? TEMPLATE_CONFIGS.youtube
      const script = await generateScript({
        topic: idea,
        niche: 'general',
        style: tone ?? 'professionnel',
        format: format ?? '16:9',
        duration: config.durationHint,
      })
      await logApiCall(user.id, 'claude', 'production-script', 'success')
      return NextResponse.json({ data: script })
    }

    if (step === 'video') {
      const scriptData = previousData?.script as ScriptData | undefined
      if (!scriptData?.scenes) {
        return NextResponse.json({ error: 'Script requis pour generer les scenes' }, { status: 400 })
      }

      const sceneUrls = await Promise.all(
        scriptData.scenes
          .filter((s) => !s.use_stock)
          .map(async (scene) => {
            const result = await generateVisualWithFallback(
              scene.visual_prompt,
              profile.preferred_quality ?? '1080p',
              user.email,
              userPlan as Plan,
              format ?? '16:9'
            )
            await logApiCall(user.id, 'ltx', 'production-video', 'success')
            return result
          })
      )
      return NextResponse.json({ data: sceneUrls })
    }

    if (step === 'voice') {
      const scriptData = previousData?.script as ScriptData | undefined
      if (!scriptData?.narration) {
        return NextResponse.json({ error: 'Script requis pour la narration' }, { status: 400 })
      }

      const voiceId = voice ?? 'EXAVITQu4vr4xnSDxMaL'
      const voiceBuffer = await generateVoiceWithFallback(scriptData.narration, voiceId)
      const voicePath = `production/${user.id}/${Date.now()}.mp3`
      const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')
      await logApiCall(user.id, 'elevenlabs', 'production-voice', 'success')
      return NextResponse.json({ data: { url: voiceUrl } })
    }

    if (step === 'music') {
      const url = await generateMusicWithFallback(
        `${musicStyle ?? 'cinematic'} background music for ${idea}`,
        musicStyle ?? 'cinematic',
        120
      )
      await logApiCall(user.id, 'suno', 'production-music', url ? 'success' : 'skipped')
      return NextResponse.json({ data: { url: url || null } })
    }

    if (step === 'assembly') {
      const scriptData = previousData?.script as ScriptData | undefined
      const videoData = previousData?.video as Array<{ url: string }> | undefined
      const voiceData = previousData?.voice as { url: string } | undefined
      const musicData = previousData?.music as { url: string } | undefined

      if (!videoData?.length || !voiceData?.url) {
        return NextResponse.json({ error: 'Video et voix requises pour l\'assemblage' }, { status: 400 })
      }

      const clips = videoData.map((v) => ({ url: v.url, type: 'ia' as const }))
      const subtitles = scriptData?.narration
        ? generateSubtitlesFromScript(scriptData.narration, scriptData.scenes ?? [])
        : []

      const assembled = await assembleFinalVideo({
        clips,
        voiceUrl: voiceData.url,
        musicUrl: musicData?.url ?? '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: format ?? '16:9',
        quality: profile.preferred_quality ?? '1080p',
        brandKit: (profile as Profile).brand_kit ?? null,
      })

      // Save to videos table
      const { data: videoRow } = await serviceClient
        .from('videos')
        .insert({
          user_id: user.id,
          title: scriptData?.title ?? 'Production',
          description: scriptData?.description ?? '',
          video_url: assembled.url,
          duration: assembled.duration,
          format: format ?? '16:9',
          quality: profile.preferred_quality ?? '1080p',
          status: 'ready',
          tags: scriptData?.tags ?? [],
          script_data: scriptData ?? null,
        })
        .select('id')
        .single()

      await logApiCall(user.id, 'shotstack', 'production-assembly', 'success')
      await sendNotification(user.id, {
        type: 'success',
        title: 'Production terminee',
        message: `Ta video "${scriptData?.title ?? 'Production'}" est prete !`,
      })

      return NextResponse.json({ data: { url: assembled.url, videoId: videoRow?.id } })
    }

    if (step === 'thumbnail') {
      const scriptData = previousData?.script as ScriptData | undefined
      const thumbnailPrompt = scriptData?.thumbnail_prompt ?? `cinematic thumbnail for ${idea}`
      const thumbnailUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(thumbnailPrompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true`
      return NextResponse.json({ data: { url: thumbnailUrl } })
    }

    // Generate ALL at once
    if (step === 'all') {
      const withinLimits = await checkLimits(profile as Profile)
      if (!withinLimits) {
        return NextResponse.json({ error: 'Limite de videos atteinte' }, { status: 403 })
      }

      const config = TEMPLATE_CONFIGS[template] ?? TEMPLATE_CONFIGS.youtube

      // 1. Script
      const script = await generateScript({
        topic: idea,
        niche: 'general',
        style: tone ?? 'professionnel',
        format: format ?? '16:9',
        duration: config.durationHint,
      })

      const voiceId = voice ?? 'EXAVITQu4vr4xnSDxMaL'

      // 2. Parallel: voice, music, scenes
      const [voiceBuffer, musicUrl, sceneResults] = await Promise.all([
        generateVoiceWithFallback(script.narration, voiceId),
        generateMusicWithFallback(
          `${musicStyle ?? 'cinematic'} background music for ${idea}`,
          musicStyle ?? 'cinematic',
          script.estimated_duration
        ),
        Promise.all(
          script.scenes
            .filter((s) => !s.use_stock)
            .map((scene) =>
              generateVisualWithFallback(scene.visual_prompt, '1080p', user.email, userPlan as Plan, format ?? '16:9')
            )
        ),
      ])

      // Upload voice
      const voicePath = `production/${user.id}/${Date.now()}.mp3`
      const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')

      // 3. Assembly
      const clips = sceneResults.map((r) => ({ url: r.url, type: 'ia' as const }))
      const subtitles = generateSubtitlesFromScript(script.narration, script.scenes)

      const assembled = await assembleFinalVideo({
        clips,
        voiceUrl,
        musicUrl: musicUrl || '',
        musicVolume: 0.3,
        subtitles,
        transitions: 'fade',
        format: format ?? '16:9',
        quality: '1080p',
        brandKit: (profile as Profile).brand_kit ?? null,
      })

      // 4. Thumbnail
      const thumbnailUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(script.thumbnail_prompt)}?width=1920&height=1080&model=flux&enhance=true&nologo=true`

      // Save
      await serviceClient.from('videos').insert({
        user_id: user.id,
        title: script.title,
        description: script.description,
        video_url: assembled.url,
        thumbnail_url: thumbnailUrl,
        duration: assembled.duration,
        format: format ?? '16:9',
        quality: '1080p',
        status: 'ready',
        tags: script.tags,
        script_data: script,
      })

      await logActivity(user.id, 'production_completed', `Production "${script.title}" terminee`)

      return NextResponse.json({
        data: {
          script,
          video: sceneResults,
          voice: { url: voiceUrl },
          music: { url: musicUrl || null },
          assembly: { url: assembled.url },
          thumbnail: { url: thumbnailUrl },
        },
      })
    }

    return NextResponse.json({ error: 'Etape inconnue' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
