import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { createVideoSchema } from '@/lib/validators'
import { checkLimits } from '@/lib/limits'
import { generateScript } from '@/lib/claude'
import { generateVoiceWithFallback, generateVisualWithFallback, generateMusicWithFallback, type VisualResult } from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { estimateCost, selectEngine, clampQualityToPlan, type VideoQuality } from '@/lib/ltx-utils'
import { resolveVoiceProviderId } from '@/lib/constants'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo, actualQualityFor, type AssembleClip } from '@/lib/shotstack'
import { stampVideoWhenReady } from '@/lib/video-proofs'
import { logApiCall, logActivity, sendNotification } from '@/lib/logger'
import { publishToPlatforms, getOptimalFormat, type SocialPlatform, type PublishRequest } from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'
import type { Plan, Profile, ScriptData } from '@/types'

function createPublicServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'public' }, auth: { autoRefreshToken: false, persistSession: false } })
}

async function triggerAutopilot(args: { userId: string; videoId: string; videoUrl: string; videoTitle: string; videoDescription: string; videoTags: string[] }): Promise<void> {
  try {
    const publicClient = createPublicServiceClient()
    const { data: config, error: configError } = await publicClient.from('social_autopilot_config').select('*').eq('user_id', args.userId).maybeSingle()
    if (configError || !config || !config.enabled) return
    const platforms = (config.default_platforms ?? []) as SocialPlatform[]
    if (platforms.length === 0) return
    const { data: accounts, error: accountsError } = await publicClient.from('social_accounts').select('id, platform, status').eq('user_id', args.userId).in('platform', platforms).eq('status', 'connected')
    if (accountsError) { console.error('[autopilot] accounts fetch error:', accountsError.message); return }
    const connectedSet = new Set((accounts ?? []).map((a) => a.platform as SocialPlatform))
    const usablePlatforms = platforms.filter((p) => connectedSet.has(p))
    if (usablePlatforms.length === 0) { console.error('[autopilot] no connected accounts for default platforms'); return }
    const accountIds = {} as Record<SocialPlatform, string>
    for (const acc of accounts ?? []) accountIds[acc.platform as SocialPlatform] = acc.id as string
    let captionsByPlatform: Partial<Record<SocialPlatform, { caption: string; hashtags: string[] }>> = {}
    if (config.auto_caption) {
      try { captionsByPlatform = await generateMultiPlatformCaptions(args.videoTitle, args.videoDescription, usablePlatforms, { language: 'fr', style: config.caption_style ?? 'engaging', includeCta: config.include_cta ?? true, maxHashtags: config.max_hashtags ?? 10 }) }
      catch (err) { console.error('[autopilot] caption gen error:', err instanceof Error ? err.message : err) }
    }
    const primary = usablePlatforms[0]
    const primaryCaption = captionsByPlatform[primary]
    const finalCaption = primaryCaption?.caption ?? args.videoTitle
    const finalHashtags = primaryCaption?.hashtags ?? args.videoTags
    const publishReq: PublishRequest = { videoUrl: args.videoUrl, caption: finalCaption, hashtags: finalHashtags, platforms: usablePlatforms, accountIds, format: getOptimalFormat(primary) }
    const results = await publishToPlatforms(publishReq)
    const nowIso = new Date().toISOString()
    const rows = results.map((r) => {
      const perPlatform = captionsByPlatform[r.platform]
      return { user_id: args.userId, video_id: args.videoId, platform: r.platform, account_id: accountIds[r.platform] ?? null, zernio_post_id: r.postId ?? null, external_post_id: r.postId ?? null, post_url: r.postUrl ?? null, caption: perPlatform?.caption ?? finalCaption, hashtags: perPlatform?.hashtags ?? finalHashtags, status: r.success ? 'published' : 'failed', scheduled_for: null, published_at: r.success ? nowIso : null, error_message: r.error ?? null, views: 0, likes: 0, shares: 0, comments: 0, metadata: { source: 'autopilot' }, created_at: nowIso, updated_at: nowIso }
    })
    if (rows.length > 0) {
      const { error: insertError } = await publicClient.from('social_posts').insert(rows)
      if (insertError) console.error('[autopilot] insert error:', insertError.message)
    }
  } catch (err) { console.error('[autopilot] unexpected error:', err instanceof Error ? err.message : err) }
}

// Aligned on the slowest providers (Shotstack/WAN 300s) — audit #14 : la
// limite serveur ne doit pas tuer la requête pendant que le fournisseur tourne.
export const maxDuration = 300

export async function POST(req: Request) {
  // Ligne vidéo créée AVANT tout appel payant pour pouvoir la marquer « failed »
  // si le pipeline meurt (audit #14 : jamais de ligne orpheline « generating »).
  let createdVideoId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    const body = await req.json()
    const parsed = createVideoSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    const withinLimits = await checkLimits(profile as Profile)
    if (!withinLimits) return NextResponse.json({ error: 'Limite de videos atteinte pour votre plan. Passez au plan superieur.' }, { status: 403 })

    const { topic, format, quality: requestedQuality, voice_id, voice, engine, script: manualScript, niche, style, mode, mediaMode, stockSelections } = parsed.data
    const userPlan = (profile as Profile).plan ?? 'free'
    // Plafond qualité PAR PLAN appliqué AVANT tout appel payant (audit #16) :
    // un starter qui demande 4k est servi en 720p, sans surcoût implicite.
    const quality = clampQualityToPlan(requestedQuality, userPlan, user.email)
    const mediaFormat = (['9:16', '16:9', '1:1'].includes(format) ? format : '16:9') as MediaFormat
    const { data: videoRow } = await serviceClient.from('videos').insert({ user_id: user.id, status: 'generating', format, quality, tags: [], media_mode: mediaMode, stock_sources: stockSelections ?? [] }).select('id').single()
    if (!videoRow) return NextResponse.json({ error: 'Erreur creation video' }, { status: 500 })
    const videoId = videoRow.id
    createdVideoId = videoId

    // Script : le script MANUEL fourni est respecté (audit #3) — jamais
    // régénéré quand l'utilisateur a écrit le sien en mode manual.
    let script: ScriptData
    if (mode === 'manual' && manualScript && manualScript.trim().length >= 20) {
      const scenes = manualScript
        .split('\n').map((l) => l.trim()).filter(Boolean)
        .map((line) => ({
          visual_prompt: line.slice(0, 2000),
          duration_seconds: 5,
          use_stock: false,
        }))
      script = {
        title: topic.slice(0, 160),
        description: `Video generee a partir du script manuel : ${topic}`,
        tags: [topic.split(/\s+/).slice(0, 3).join('-').toLowerCase(), 'manuel', 'sutra'],
        narration: manualScript,
        scenes,
        music_prompt: `instrumental background for a video about ${topic}`,
        music_style: 'cinematic',
        thumbnail_prompt: `cinematic thumbnail about ${topic}`,
        estimated_duration: Math.min(1200, scenes.reduce((s, sc) => s + sc.duration_seconds, 0)),
      } as ScriptData
    } else {
      const scriptStart = Date.now()
      script = await generateScript({ topic, niche: niche ?? 'general', style: style ?? 'dynamique', format, duration: '60-90 secondes' }, user.id)
      await logApiCall(user.id, 'claude', 'generateScript', 'success', Date.now() - scriptStart)
    }
    await serviceClient.from('videos').update({ title: script.title, description: script.description, tags: script.tags, script_data: script }).eq('id', videoId)

    // Voix : résolution alias → ID ElevenLabs réel (audit #18) — voice (hook)
    // et voice_id (ancien champ) sont tous deux acceptés.
    const selectedVoiceId = resolveVoiceProviderId(voice_id ?? voice)
    // Moteur choisi honoré pour le WAN (choix MOINS CHER, audit #3) ; une
    // demande ltx-pro hors plan reste ignorée (le plan gouverne, audit #16).
    const genPlan: Plan = engine === 'wan-classic' ? 'free' : userPlan
    const stockByIndex = new Map<number, (typeof stockSelections)[number]>()
    for (const sel of stockSelections ?? []) stockByIndex.set(sel.sceneIndex, sel)

    // Un clip de banque d'images issu du fallback reste typé « stock » avec sa
    // provenance Pexels logguée — jamais présenté comme généré par WAN.
    // Chaque clip porte SA durée pour l'horloge de montage (audit #4).
    const clipFromVisual = async (visual: VisualResult, duration: number): Promise<AssembleClip> => {
      if (visual.source === 'pexels-stock') {
        await logApiCall(user.id, 'pexels', 'generateVisual:stock-fallback', 'fallback')
        return { url: visual.url, type: 'stock', kind: 'video', duration }
      }
      await logApiCall(user.id, visual.engine === 'wan-classic' ? 'runpod' : 'ltx', 'generateVisual', 'success')
      return { url: visual.url, type: 'ia', kind: 'video', duration }
    }

    const resolveSceneClip = async (scene: ScriptData['scenes'][number], idx: number): Promise<AssembleClip | null> => {
      const sel = stockByIndex.get(idx)
      const userChoseStock = sel && !sel.fallbackToAI && sel.url
      const sceneDuration = Math.max(1, scene.duration_seconds || 5)
      const track = { userId: user.id, videoId, duration: sceneDuration }

      const stockClipFromSelection = (s: NonNullable<typeof sel>): AssembleClip => ({
        url: s.url!,
        type: 'stock',
        kind: s.type === 'photo' ? 'photo' : 'video',
        duration: sceneDuration,
      })

      if (mediaMode === 'stock') {
        if (userChoseStock) return stockClipFromSelection(sel!)
        const results = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
        await logApiCall(user.id, 'pexels', 'searchVideos', results[0] ? 'success' : 'fallback')
        if (results[0]) return { url: results[0].url, type: 'stock', kind: 'video', duration: Math.max(sceneDuration, Math.min(results[0].duration || sceneDuration, 60)) }
        const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, genPlan, format, false, track)
        return clipFromVisual(ai, sceneDuration)
      }
      if (mediaMode === 'mixed') {
        if (userChoseStock) return stockClipFromSelection(sel!)
        if (sel?.fallbackToAI || !sel) {
          const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, genPlan, format, false, track)
          return clipFromVisual(ai, sceneDuration)
        }
      }
      if (scene.use_stock) {
        const results = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
        await logApiCall(user.id, 'pexels', 'searchVideos', results[0] ? 'success' : 'skipped')
        return results[0] ? { url: results[0].url, type: 'stock', kind: 'video', duration: Math.max(sceneDuration, Math.min(results[0].duration || sceneDuration, 60)) } : null
      }
      // mediaMode 'ai' = 100 % IA strict : pas de repli stock silencieux (audit #18).
      const ai = await generateVisualWithFallback(scene.visual_prompt, quality, user.email, genPlan, format, mediaMode === 'ai', track)
      return clipFromVisual(ai, sceneDuration)
    }

    const [voiceBuffer, musicUrl, resolvedClips] = await Promise.all([
      generateVoiceWithFallback(script.narration, selectedVoiceId).then(async (buf) => { await logApiCall(user.id, 'elevenlabs', 'generateVoice', 'success'); return buf }),
      generateMusicWithFallback(script.music_prompt, script.music_style, script.estimated_duration).then(async (url) => { await logApiCall(user.id, 'suno', 'generateMusic', url ? 'success' : 'skipped'); return url }),
      Promise.all(script.scenes.map((s, i) => resolveSceneClip(s, i))).then((clips) => clips.filter(Boolean) as AssembleClip[])
    ])
    const voicePath = `voices/${user.id}/${videoId}.mp3`
    const voiceUrl = await uploadToStorage(voicePath, voiceBuffer, 'audio/mpeg')
    await serviceClient.from('videos').update({ voice_url: voiceUrl, music_url: musicUrl || null }).eq('id', videoId)
    const allClips = resolvedClips
    const subtitles = generateSubtitles(script.narration, script.estimated_duration)
    const assembleStart = Date.now()
    const assembled = await assembleFinalVideo({ clips: allClips, voiceUrl, musicUrl: musicUrl || '', musicVolume: 0.3, subtitles, transitions: 'fade', format, quality, brandKit: (profile as Profile).brand_kit ?? null })
    await logApiCall(user.id, 'shotstack', 'assembleFinalVideo', 'success', Date.now() - assembleStart)
    // Miniature : une IMAGE uniquement (jamais un MP4 dans une balise <img>,
    // audit #18) — la photo stock si présente, sinon pas de thumbnail.
    const thumbnailUrl = allClips.find((c) => c.kind === 'photo')?.url ?? null
    // Qualité RÉELLE stockée (clamp 4k→1080p si rendu HD : voir actualQualityFor)
    const actualQuality = actualQualityFor(quality, assembled.outputQuality)
    await serviceClient.from('videos').update({ video_url: assembled.url, thumbnail_url: thumbnailUrl, shotstack_json: assembled.timeline, duration: assembled.duration, status: 'ready', quality: actualQuality, cost_estimate: estimateTotalCost(script, userPlan, user.email, quality) }).eq('id', videoId)

    try {
      const stampOutcome = await stampVideoWhenReady({ videoId, userId: user.id, videoUrl: assembled.url })
      await logApiCall(user.id, 'opentimestamps', 'stampVideoWhenReady', stampOutcome.status === 'stamped' ? 'success' : 'error', 0, stampOutcome.status === 'stamped' ? undefined : JSON.stringify(stampOutcome))
    } catch (stampErr) {
      await logApiCall(user.id, 'opentimestamps', 'stampVideoWhenReady', 'error', 0, stampErr instanceof Error ? stampErr.message : String(stampErr))
    }
    await sendNotification(user.id, { type: 'success', title: 'Video prete !', message: `Ta video "${script.title}" est prete a etre visionnee.` })
    await logActivity(user.id, 'video_created', `Video "${script.title}" generee`, { video_id: videoId, quality, format, duration: assembled.duration })
    const { data: video } = await serviceClient.from('videos').select('*').eq('id', videoId).single()
    try {
      await triggerAutopilot({ userId: user.id, videoId, videoUrl: assembled.url, videoTitle: script.title ?? '', videoDescription: script.description ?? '', videoTags: script.tags ?? [] })
    } catch (err) { console.error('[create] autopilot trigger failed:', err instanceof Error ? err.message : err) }
    return NextResponse.json({ success: true, video })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    // La ligne vidéo est marquée « failed » — jamais laissée en « generating »
    // quand le pipeline meurt (audit #14).
    if (createdVideoId) {
      await createServiceClient()
        .from('videos')
        .update({ status: 'failed' })
        .eq('id', createdVideoId)
        .then(() => undefined, () => undefined)
    }
    await logApiCall(null, 'create', 'POST /api/create', 'error', undefined, message).catch(() => {})
    return NextResponse.json({ error: 'Erreur lors de la generation de la video', details: message }, { status: 500 })
  }
}

function generateSubtitles(narration: string, totalDuration: number): Array<{ text: string; start: number; end: number }> {
  const sentences = narration.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const segmentDuration = totalDuration / sentences.length
  return sentences.map((text, i) => ({ text: text.trim(), start: i * segmentDuration, end: (i + 1) * segmentDuration }))
}

function estimateTotalCost(
  script: ScriptData,
  plan: Plan,
  userEmail: string | null | undefined,
  quality: string,
): number {
  const { engine } = selectEngine(plan, userEmail)
  const videoQuality = (['720p', '1080p', '4k'].includes(quality)
    ? quality
    : '1080p') as VideoQuality
  const generatedSeconds = script.scenes
    .filter((scene) => !scene.use_stock)
    .reduce((total, scene) => total + Math.max(0, scene.duration_seconds), 0)

  // Existing voice/script/music/assembly estimates plus quality-aware video cost.
  return Number(
    (0.05 + 0.1 + 0.08 + estimateCost(engine, generatedSeconds, videoQuality) + 0.07)
      .toFixed(4),
  )
}
