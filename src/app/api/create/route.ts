import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createVideoSchema } from '@/lib/validators'
import { checkLimits } from '@/lib/limits'
import { generateScript } from '@/lib/claude'
import { generateVoiceWithFallback, generateVisualWithFallback, generateMusicWithFallback } from '@/lib/fallbacks'
import { searchVideos } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo } from '@/lib/shotstack'
import { logApiCall, logActivity, sendNotification } from '@/lib/logger'
import type { Profile, ScriptData } from '@/types'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createVideoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
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

    const withinLimits = await checkLimits(profile as Profile)
    if (!withinLimits) {
      return NextResponse.json(
        { error: 'Limite de videos atteinte pour votre plan. Passez au plan superieur.' },
        { status: 403 }
      )
    }

    const { topic, format, quality, voice_id, niche, style } = parsed.data

    const { data: videoRow } = await serviceClient
      .from('videos')
      .insert({
        user_id: user.id,
        status: 'generating',
        format,
        quality,
        tags: [],
      })
      .select('id')
      .single()

    if (!videoRow) {
      return NextResponse.json({ error: 'Erreur creation video' }, { status: 500 })
    }

    const videoId = videoRow.id

    const scriptStart = Date.now()
    const script: ScriptData = await generateScript({
      topic,
      niche: niche ?? 'general',
      style: style ?? 'dynamique',
      format,
      duration: '60-90 secondes',
    })
    await logApiCall(user.id, 'claude', 'generateScript', 'success', Date.now() - scriptStart)

    await serviceClient
      .from('videos')
      .update({ title: script.title, description: script.description, tags: script.tags, script_data: script })
      .eq('id', videoId)

    const selectedVoiceId = voice_id ?? 'EXAVITQu4vr4xnSDxMaL'

    const [voiceBuffer, musicUrl, sceneUrls, stockVideos] = await Promise.all([
      generateVoiceWithFallback(script.narration, selectedVoiceId)
        .then(async (buf) => {
          await logApiCall(user.id, 'elevenlabs', 'generateVoice', 'success')
          return buf
        }),
      generateMusicWithFallback(script.music_prompt, script.music_style, script.estimated_duration)
        .then(async (url) => {
          await logApiCall(user.id, 'suno', 'generateMusic', url ? 'success' : 'skipped')
          return url
        }),
      Promise.all(
        script.scenes
          .filter((s) => !s.use_stock)
          .map(async (scene) => {
            const url = await generateVisualWithFallback(scene.visual_prompt, quality, user.email)
            await logApiCall(user.id, 'runpod', 'generateVisual', 'success')
            return { url, type: 'ia' as const }
          })
      ),
      Promise.all(
        script.scenes
          .filter((s) => s.use_stock)
          .map(async (scene) => {
            const results = await searchVideos(scene.visual_prompt, 1)
            await logApiCall(user.id, 'pexels', 'searchVideos', 'success')
            return results[0] ? { url: results[0].url, type: 'stock' as const } : null
          })
      ).then((results) => results.filter(Boolean) as Array<{ url: string; type: 'stock' }>),
    ])

    const voicePath = `voices/${user.id}/${videoId}.mp3`
    const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')

    await serviceClient
      .from('videos')
      .update({ voice_url: voiceUrl, music_url: musicUrl || null })
      .eq('id', videoId)

    const allClips = [
      ...sceneUrls,
      ...stockVideos,
    ]

    const subtitles = generateSubtitles(script.narration, script.estimated_duration)

    const assembleStart = Date.now()
    const assembled = await assembleFinalVideo({
      clips: allClips,
      voiceUrl,
      musicUrl: musicUrl || '',
      musicVolume: 0.3,
      subtitles,
      transitions: 'fade',
      format,
      quality,
      brandKit: (profile as Profile).brand_kit ?? null,
    })
    await logApiCall(user.id, 'shotstack', 'assembleFinalVideo', 'success', Date.now() - assembleStart)

    const thumbnailUrl = sceneUrls[0]?.url ?? stockVideos[0]?.url ?? null

    await serviceClient
      .from('videos')
      .update({
        video_url: assembled.url,
        thumbnail_url: thumbnailUrl,
        shotstack_json: assembled.timeline,
        duration: assembled.duration,
        status: 'ready',
        cost_estimate: estimateTotalCost(script),
      })
      .eq('id', videoId)

    await sendNotification(user.id, {
      type: 'success',
      title: 'Video prete !',
      message: `Ta video "${script.title}" est prete a etre visionnee.`,
    })

    await logActivity(user.id, 'video_created', `Video "${script.title}" generee`, {
      video_id: videoId,
      quality,
      format,
      duration: assembled.duration,
    })

    const { data: video } = await serviceClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single()

    return NextResponse.json({ success: true, video })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    await logApiCall(null, 'create', 'POST /api/create', 'error', undefined, message).catch(() => {})
    return NextResponse.json({ error: 'Erreur lors de la generation de la video', details: message }, { status: 500 })
  }
}

function generateSubtitles(narration: string, totalDuration: number): Array<{ text: string; start: number; end: number }> {
  const sentences = narration.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const segmentDuration = totalDuration / sentences.length
  return sentences.map((text, i) => ({
    text: text.trim(),
    start: i * segmentDuration,
    end: (i + 1) * segmentDuration,
  }))
}

function estimateTotalCost(script: ScriptData): number {
  const claudeCost = 0.05
  const voiceCost = 0.1
  const musicCost = 0.08
  const sceneCost = script.scenes.filter((s) => !s.use_stock).length * 0.015
  const shotstackCost = 0.07
  return claudeCost + voiceCost + musicCost + sceneCost + shotstackCost
}
