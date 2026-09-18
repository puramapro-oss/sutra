import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { generateScript } from '@/lib/claude'
import {
  generateVoiceWithFallback,
  generateVisualWithFallback,
  generateMusicWithFallback,
  type VisualResult,
} from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo, actualQualityFor, type AssembleClip } from '@/lib/shotstack'
import { estimateCost, selectEngine, type VideoQuality } from '@/lib/ltx-utils'
import { stampVideoWhenReady } from '@/lib/video-proofs'
import { logApiCall, sendNotification } from '@/lib/logger'
import { publishToPlatforms, getOptimalFormat, type SocialPlatform, type PublishRequest } from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'
import type { Plan, ScriptData } from '@/types'

// -----------------------------------------------------------------------------
// Pipeline de création — exécutable INLINE (/api/create) OU par le worker
// (/api/cron/video-worker) sur REPRISE de tâche crashée, SANS régénérer les
// scènes déjà obtenues (checkpoint progress.scenes, audit #10/#14).
// -----------------------------------------------------------------------------

export interface CreateJobInput {
  videoId: string
  userId: string
  userEmail: string | null
  userPlan: Plan
  genPlan: Plan
  quality: string
  format: string
  mediaFormat: MediaFormat
  topic: string
  niche?: string
  style?: string
  mode: 'auto' | 'manual'
  mediaMode: 'ai' | 'stock' | 'mixed'
  voiceId: string
  manualScript?: string
  stockSelections: Array<{
    sceneIndex: number
    source: string | null
    type: 'video' | 'photo' | null
    url: string | null
    thumbnail: string | null
    quality: string | null
    fallbackToAI: boolean
  }>
  brandKit: { intro_template?: string; outro_template?: string } | null
}

export interface CreateJobResume {
  scenes: Record<string, AssembleClip>
}

export interface CreateJobHooks {
  /** Appelé après CHAQUE scène résolue (checkpoint durable). */
  onSceneResolved?: (index: number, clip: AssembleClip) => Promise<void>
  /** Prolongation du bail avant chaque phase fournisseur longue. */
  heartbeat?: () => Promise<void>
}

export interface CreateJobResult {
  videoUrl: string
  actualQuality: string
  duration: number
}

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

function generateSubtitles(narration: string, totalDuration: number): Array<{ text: string; start: number; end: number }> {
  const sentences = narration.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const segmentDuration = totalDuration / sentences.length
  return sentences.map((text, i) => ({ text: text.trim(), start: i * segmentDuration, end: (i + 1) * segmentDuration }))
}

/**
 * Exécute le pipeline complet. `resume.scenes` contient les clips DÉJÀ
 * résolus (checkpoint) : ces scènes ne déclenchent AUCUN nouvel appel
 * fournisseur — c'est la garantie « reprise sans double génération ».
 */
export async function executeCreateJob(
  input: CreateJobInput,
  resume: CreateJobResume,
  hooks: CreateJobHooks = {}
): Promise<CreateJobResult> {
  const serviceClient = createServiceClient()
  const { videoId, userId, userEmail, genPlan, quality, format, mediaFormat } = input

  // ---------------------------------------------------------------- Script
  let script: ScriptData
  if (input.mode === 'manual' && input.manualScript && input.manualScript.trim().length >= 20) {
    const scenes = input.manualScript
      .split('\n').map((l) => l.trim()).filter(Boolean)
      .map((line) => ({ visual_prompt: line.slice(0, 2000), duration_seconds: 5, use_stock: false }))
    script = {
      title: input.topic.slice(0, 160),
      description: `Video generee a partir du script manuel : ${input.topic}`,
      tags: [input.topic.split(/\s+/).slice(0, 3).join('-').toLowerCase(), 'manuel', 'sutra'],
      narration: input.manualScript,
      scenes,
      music_prompt: `instrumental background for a video about ${input.topic}`,
      music_style: 'cinematic',
      thumbnail_prompt: `cinematic thumbnail about ${input.topic}`,
      estimated_duration: Math.min(1200, scenes.reduce((s, sc) => s + sc.duration_seconds, 0)),
    } as ScriptData
  } else {
    const scriptStart = Date.now()
    script = await generateScript(
      { topic: input.topic, niche: input.niche ?? 'general', style: input.style ?? 'dynamique', format, duration: '60-90 secondes' },
      userId
    )
    await logApiCall(userId, 'claude', 'generateScript', 'success', Date.now() - scriptStart)
  }
  await serviceClient.from('videos').update({ title: script.title, description: script.description, tags: script.tags, script_data: script }).eq('id', videoId)

  // ---------------------------------------------------- Scènes (reprise ok)
  const stockByIndex = new Map<number, CreateJobInput['stockSelections'][number]>()
  for (const sel of input.stockSelections ?? []) stockByIndex.set(sel.sceneIndex, sel)

  const clipFromVisual = async (visual: VisualResult, duration: number): Promise<AssembleClip> => {
    if (visual.source === 'pexels-stock') {
      await logApiCall(userId, 'pexels', 'generateVisual:stock-fallback', 'fallback')
      return { url: visual.url, type: 'stock', kind: 'video', duration }
    }
    await logApiCall(userId, visual.engine === 'wan-classic' ? 'runpod' : 'ltx', 'generateVisual', 'success')
    return { url: visual.url, type: 'ia', kind: 'video', duration }
  }

  const resolveSceneClip = async (scene: ScriptData['scenes'][number], idx: number): Promise<AssembleClip | null> => {
    const fromCheckpoint = resume.scenes[String(idx)]
    if (fromCheckpoint) return fromCheckpoint // DÉJÀ FAIT — aucun appel fournisseur

    const sel = stockByIndex.get(idx)
    const userChoseStock = sel && !sel.fallbackToAI && sel.url
    const sceneDuration = Math.max(1, scene.duration_seconds || 5)
    const track = { userId, videoId, duration: sceneDuration }
    await hooks.heartbeat?.()

    if (input.mediaMode === 'stock') {
      if (userChoseStock) {
        return { url: sel!.url!, type: 'stock', kind: sel!.type === 'photo' ? 'photo' : 'video', duration: sceneDuration }
      }
      const results = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
      await logApiCall(userId, 'pexels', 'searchVideos', results[0] ? 'success' : 'fallback')
      if (results[0]) {
        return { url: results[0].url, type: 'stock', kind: 'video', duration: Math.max(sceneDuration, Math.min(results[0].duration || sceneDuration, 60)) }
      }
      const ai = await generateVisualWithFallback(scene.visual_prompt, quality, userEmail, genPlan, format, false, track)
      return clipFromVisual(ai, sceneDuration)
    }
    if (input.mediaMode === 'mixed') {
      if (userChoseStock) {
        return { url: sel!.url!, type: 'stock', kind: sel!.type === 'photo' ? 'photo' : 'video', duration: sceneDuration }
      }
      if (sel?.fallbackToAI || !sel) {
        const ai = await generateVisualWithFallback(scene.visual_prompt, quality, userEmail, genPlan, format, false, track)
        return clipFromVisual(ai, sceneDuration)
      }
    }
    if (scene.use_stock) {
      const results = await searchVideos(scene.visual_prompt, 1, { format: mediaFormat })
      await logApiCall(userId, 'pexels', 'searchVideos', results[0] ? 'success' : 'skipped')
      if (results[0]) {
        return { url: results[0].url, type: 'stock', kind: 'video', duration: Math.max(sceneDuration, Math.min(results[0].duration || sceneDuration, 60)) }
      }
      return null
    }
    const ai = await generateVisualWithFallback(scene.visual_prompt, quality, userEmail, genPlan, format, input.mediaMode === 'ai', track)
    return clipFromVisual(ai, sceneDuration)
  }

  // Voix + musique en parallèle des scènes ; chaque scène résolue est
  // checkpointée (hooks.onSceneResolved) pour reprise sans régénération.
  const [voiceBuffer, musicUrl, clipsResult] = await Promise.all([
    generateVoiceWithFallback(script.narration, input.voiceId).then(async (buf) => {
      await logApiCall(userId, 'elevenlabs', 'generateVoice', 'success')
      return buf
    }),
    generateMusicWithFallback(script.music_prompt, script.music_style, script.estimated_duration).then(async (url) => {
      await logApiCall(userId, 'suno', 'generateMusic', url ? 'success' : 'skipped')
      return url
    }),
    (async () => {
      const clips: AssembleClip[] = []
      for (let i = 0; i < script.scenes.length; i++) {
        const clip = await resolveSceneClip(script.scenes[i], i)
        if (clip) {
          clips.push(clip)
          await hooks.onSceneResolved?.(i, clip)
        }
      }
      return clips
    })(),
  ])

  const voiceUrl = await uploadToStorage(`voices/${userId}/${videoId}.mp3`, voiceBuffer, 'audio/mpeg')
  await serviceClient.from('videos').update({ voice_url: voiceUrl, music_url: musicUrl || null }).eq('id', videoId)

  const subtitles = generateSubtitles(script.narration, script.estimated_duration)
  await hooks.heartbeat?.()
  const assembled = await assembleFinalVideo({
    clips: clipsResult,
    voiceUrl,
    musicUrl: musicUrl || '',
    musicVolume: 0.3,
    subtitles,
    transitions: 'fade',
    format,
    quality,
    brandKit: input.brandKit,
  })
  await logApiCall(userId, 'shotstack', 'assembleFinalVideo', 'success')

  // Miniature : IMAGE uniquement (jamais un MP4 dans une balise <img>).
  const thumbnailUrl = clipsResult.find((c) => c.kind === 'photo')?.url ?? null
  const actualQuality = actualQualityFor(quality, assembled.outputQuality)
  // Coût estimé AVANT facturation réelle, attribué au vrai moteur routé —
  // rapprochement possible avec la facture fournisseur (audit #15).
  const { engine } = selectEngine(input.userPlan, input.userEmail)
  const videoQuality = (['720p', '1080p', '4k'].includes(quality) ? quality : '1080p') as VideoQuality
  const generatedSeconds = script.scenes
    .filter((scene) => !scene.use_stock)
    .reduce((total, scene) => total + Math.max(0, scene.duration_seconds), 0)
  const costEstimate = Number(
    (0.05 + 0.1 + 0.08 + estimateCost(engine, generatedSeconds, videoQuality) + 0.07).toFixed(4)
  )

  await serviceClient.from('videos').update({
    video_url: assembled.url,
    thumbnail_url: thumbnailUrl,
    shotstack_json: assembled.timeline,
    duration: assembled.duration,
    status: 'ready',
    quality: actualQuality,
    cost_estimate: costEstimate,
  }).eq('id', videoId)

  try {
    const stampOutcome = await stampVideoWhenReady({ videoId, userId, videoUrl: assembled.url })
    await logApiCall(userId, 'opentimestamps', 'stampVideoWhenReady', stampOutcome.status === 'stamped' ? 'success' : 'error', 0, stampOutcome.status === 'stamped' ? undefined : JSON.stringify(stampOutcome))
  } catch (stampErr) {
    await logApiCall(userId, 'opentimestamps', 'stampVideoWhenReady', 'error', 0, stampErr instanceof Error ? stampErr.message : String(stampErr))
  }

  await sendNotification(userId, {
    type: 'success',
    title: 'Video prete !',
    message: `Ta video "${script.title}" est prete a etre visionnee.`,
  })

  try {
    await triggerAutopilot({
      userId,
      videoId,
      videoUrl: assembled.url,
      videoTitle: script.title ?? '',
      videoDescription: script.description ?? '',
      videoTags: script.tags ?? [],
    })
  } catch (err) {
    console.error('[create] autopilot trigger failed:', err instanceof Error ? err.message : err)
  }

  return { videoUrl: assembled.url, actualQuality, duration: assembled.duration }
}
