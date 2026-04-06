import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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
import {
  publishToPlatforms,
  getOptimalFormat,
  type SocialPlatform,
  type PublishRequest,
} from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'
import type { Plan, Profile, ScriptData } from '@/types'

function createPublicServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}

async function triggerAutopilot(args: {
  userId: string
  videoId: string
  videoUrl: string
  videoTitle: string
  videoDescription: string
  videoTags: string[]
}): Promise<void> {
  try {
    const publicClient = createPublicServiceClient()

    const { data: config, error: configError } = await publicClient
      .from('social_autopilot_config')
      .select('*')
      .eq('user_id', args.userId)
      .maybeSingle()

    if (configError || !config) return
    if (!config.enabled) return

    const platforms = (config.default_platforms ?? []) as SocialPlatform[]
    if (platforms.length === 0) return

    // Fetch connected accounts for these platforms
    const { data: accounts, error: accountsError } = await publicClient
      .from('social_accounts')
      .select('id, platform, status')
      .eq('user_id', args.userId)
      .in('platform', platforms)
      .eq('status', 'connected')

    if (accountsError) {
      console.error('[autopilot] accounts fetch error:', accountsError.message)
      return
    }

    const connectedSet = new Set((accounts ?? []).map((a) => a.platform as SocialPlatform))
    const usablePlatforms = platforms.filter((p) => connectedSet.has(p))
    if (usablePlatforms.length === 0) {
      console.error('[autopilot] no connected accounts for default platforms')
      return
    }

    const accountIds = {} as Record<SocialPlatform, string>
    for (const acc of accounts ?? []) {
      accountIds[acc.platform as SocialPlatform] = acc.id as string
    }

    // Generate captions if auto_caption
    let captionsByPlatform: Partial<
      Record<SocialPlatform, { caption: string; hashtags: string[] }>
    > = {}
    if (config.auto_caption) {
      try {
        captionsByPlatform = await generateMultiPlatformCaptions(
          args.videoTitle,
          args.videoDescription,
          usablePlatforms,
          {
            language: 'fr',
            style: config.caption_style ?? 'engaging',
            includeCta: config.include_cta ?? true,
            maxHashtags: config.max_hashtags ?? 10,
          }
        )
      } catch (err) {
        console.error('[autopilot] caption gen error:', err instanceof Error ? err.message : err)
      }
    }

    const primary = usablePlatforms[0]
    const primaryCaption = captionsByPlatform[primary]
    const finalCaption = primaryCaption?.caption ?? args.videoTitle
    const finalHashtags = primaryCaption?.hashtags ?? args.videoTags

    const publishReq: PublishRequest = {
      videoUrl: args.videoUrl,
      caption: finalCaption,
      hashtags: finalHashtags,
      platforms: usablePlatforms,
      accountIds,
      format: getOptimalFormat(primary),
    }

    const results = await publishToPlatforms(publishReq)

    const nowIso = new Date().toISOString()
    const rows = results.map((r) => {
      const perPlatform = captionsByPlatform[r.platform]
      return {
        user_id: args.userId,
        video_id: args.videoId,
        platform: r.platform,
        account_id: accountIds[r.platform] ?? null,
        zernio_post_id: r.postId ?? null,
        external_post_id: r.postId ?? null,
        post_url: r.postUrl ?? null,
        caption: perPlatform?.caption ?? finalCaption,
        hashtags: perPlatform?.hashtags ?? finalHashtags,
        status: r.success ? 'published' : 'failed',
        scheduled_for: null,
        published_at: r.success ? nowIso : null,
        error_message: r.error ?? null,
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        metadata: { source: 'autopilot' },
        created_at: nowIso,
        updated_at: nowIso,
      }
    })

    if (rows.length > 0) {
      const { error: insertError } = await publicClient.from('social_posts').insert(rows)
      if (insertError) {
        console.error('[autopilot] insert error:', insertError.message)
      }
    }
  } catch (err) {
    console.error('[autopilot] unexpected error:', err instanceof Error ? err.message : err)
  }
}

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

    const { topic, format, quality, voice_id, niche, style, mediaMode, stockSelections } = parsed.data

    const { data: videoRow } = await serviceClient
      .from('videos')
      .insert({
        user_id: user.id,
        status: 'generating',
        format,
        quality,
        tags: [],
        media_mode: mediaMode,
        stock_sources: stockSelections ?? [],
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

    const userPlan = (profile as Profile).plan ?? 'free'

    // Resolve each scene to a clip URL based on mediaMode + stockSelections
    const stockByIndex = new Map<number, (typeof stockSelections)[number]>()
    for (const sel of stockSelections ?? []) {
      stockByIndex.set(sel.sceneIndex, sel)
    }

    const resolveSceneClip = async (
      scene: ScriptData['scenes'][number],
      idx: number
    ): Promise<{ url: string; type: 'ia' | 'stock' } | null> => {
      const sel = stockByIndex.get(idx)
      const userChoseStock = sel && !sel.fallbackToAI && sel.url

      // Stock mode: use user selection if any, else search Pexels for a fallback
      if (mediaMode === 'stock') {
        if (userChoseStock) return { url: sel!.url!, type: 'stock' }
        const results = await searchVideos(scene.visual_prompt, 1)
        await logApiCall(user.id, 'pexels', 'searchVideos', results[0] ? 'success' : 'fallback')
        if (results[0]) return { url: results[0].url, type: 'stock' }
        // Last resort: fallback to IA so video is never broken
        const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, userPlan, format)
        await logApiCall(user.id, ai.engine === 'wan-classic' ? 'runpod' : 'ltx', 'generateVisual', 'fallback')
        return { url: ai.url, type: 'ia' }
      }

      // Mixed mode: respect user choice, IA on explicit fallback or unselected scenes
      if (mediaMode === 'mixed') {
        if (userChoseStock) return { url: sel!.url!, type: 'stock' }
        if (sel?.fallbackToAI || !sel) {
          const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, userPlan, format)
          await logApiCall(user.id, ai.engine === 'wan-classic' ? 'runpod' : 'ltx', 'generateVisual', 'success')
          return { url: ai.url, type: 'ia' }
        }
      }

      // AI mode (default): legacy behavior — IA unless script flagged use_stock
      if (scene.use_stock) {
        const results = await searchVideos(scene.visual_prompt, 1)
        await logApiCall(user.id, 'pexels', 'searchVideos', results[0] ? 'success' : 'skipped')
        return results[0] ? { url: results[0].url, type: 'stock' } : null
      }
      const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, userPlan, format)
      await logApiCall(user.id, ai.engine === 'wan-classic' ? 'runpod' : 'ltx', 'generateVisual', 'success')
      return { url: ai.url, type: 'ia' }
    }

    const [voiceBuffer, musicUrl, resolvedClips] = await Promise.all([
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
      Promise.all(script.scenes.map((s, i) => resolveSceneClip(s, i))).then(
        (clips) => clips.filter(Boolean) as Array<{ url: string; type: 'ia' | 'stock' }>
      ),
    ])

    // Compatibility shims for assembly + thumbnail logic below
    const sceneUrls = resolvedClips.filter((c) => c.type === 'ia') as Array<{ url: string; type: 'ia' }>
    const stockVideos = resolvedClips.filter((c) => c.type === 'stock') as Array<{ url: string; type: 'stock' }>

    const voicePath = `voices/${user.id}/${videoId}.mp3`
    const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')

    await serviceClient
      .from('videos')
      .update({ voice_url: voiceUrl, music_url: musicUrl || null })
      .eq('id', videoId)

    // Preserve scene order from the script
    const allClips = resolvedClips

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

    // Autopilot: trigger publish if enabled (non-blocking)
    try {
      await triggerAutopilot({
        userId: user.id,
        videoId,
        videoUrl: assembled.url,
        videoTitle: script.title ?? '',
        videoDescription: script.description ?? '',
        videoTags: script.tags ?? [],
      })
    } catch (err) {
      console.error('[create] autopilot trigger failed:', err instanceof Error ? err.message : err)
    }

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
