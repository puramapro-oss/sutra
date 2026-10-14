import { assembleFinalVideo } from './final-composition'
import { pipelineSteps, checkpointStage, assertFinalMedia, requireTracks, persistPipelineVideo } from '@/lib/pipeline-state'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { generateMusic } from '@/lib/suno'
import { musicCheckpointed } from '@/lib/music-checkpoint'
import { generateScript } from '@/lib/claude'
import {
  generateVisualWithFallback,
  type VisualResult,
} from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { actualQualityFor, durableRenderJob, verifyAndStoreRenderedVideo, type AssembleClip } from '@/lib/shotstack'
import { durableLtxJob, type LtxJobState } from '@/lib/ltx'
import { executeProductionStep } from '@/lib/production-pipeline'
import { estimateCost, selectEngine, type VideoQuality } from '@/lib/ltx-utils'
import { stampVideoWhenReady } from '@/lib/video-proofs'
import { pipelineLog as logApiCall, pipelineNotification as sendNotification } from '@/lib/pipeline-state'
import { type SocialPlatform } from '@/lib/zernio'
import { publishVideoRecord } from '@/lib/social-publication'
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
  steps?: Record<string, unknown>
}

export interface CreateJobHooks {
  /** Appelé après CHAQUE scène résolue (checkpoint durable). */
  onSceneResolved?: (index: number, clip: AssembleClip) => Promise<void>
  onStepResolved?: (key: string, value: unknown) => Promise<void>
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

async function triggerAutopilot(args: { userId: string; videoId: string; videoUrl: string; videoTitle: string; videoDescription: string; videoTags: string[] }) {
  const { data: config, error } = await createPublicServiceClient().from('social_autopilot_config').select('*').eq('user_id', args.userId).maybeSingle()
  if (error) throw new Error('SUTRA_PUBLICATION_CONFIG_UNAVAILABLE')
  if (!config?.enabled || !config.default_platforms?.length) return { status: 'skipped' }
  // publishVideoRecord owns its durable CAS intent and provider reconciliation.
  const outcome = await publishVideoRecord(args.userId, {
    videoId: args.videoId, platforms: config.default_platforms as SocialPlatform[], caption: args.videoTitle,
    hashtags: args.videoTags, autoCaption: Boolean(config.auto_caption),
  })
  if (!['published', 'scheduled'].includes(outcome.status)) throw new Error('SUTRA_RECONCILIATION_REQUIRED: publication ' + outcome.status)
  return outcome
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
  const done = resume.steps ?? {}
  const save = async (key: string, value: unknown) => { await hooks.onStepResolved?.(key, value); done[key] = value }
  const step = pipelineSteps(done, hooks)
  const updateVideo = async (update: Record<string, unknown>) => {
    await persistPipelineVideo(serviceClient, 'videos', videoId, update)
  }

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
    script = await step('script', () => generateScript(
      { topic: input.topic, niche: input.niche ?? 'general', style: input.style ?? 'dynamique', format, duration: '60-90 secondes' },
      userId
    ), true)
    await logApiCall(userId, 'claude', 'generateScript', 'success', Date.now() - scriptStart)
  }
  if (!script.scenes.length || script.scenes.length > 60) throw new Error('SUTRA_INVALID_SCENE_COUNT')
  await checkpointStage(done, hooks, 'script', script)
  await step('metadata_saved', async () => { await updateVideo({ title: script.title, description: script.description, tags: script.tags, script_data: script }); return true })

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
    const track = { userId, videoId, duration: sceneDuration, job: durableLtxJob(done, `scene:${idx}:ltx`, hooks.onStepResolved) }
    // Preserve the provider result before logging or the separate scene receipt.
    // Legacy intent/remote-ID keys remain authoritative for uncertain submissions.
    const generateVisual = (strict: boolean) => step(`scene:${idx}:visual`, async () => {
      if (done[`scene:${idx}:started`] && !(done[`scene:${idx}:ltx`] as LtxJobState | undefined)?.id) {
        throw new Error(`SUTRA_RECONCILIATION_REQUIRED: scene ${idx + 1}`)
      }
      await save(`scene:${idx}:started`, true)
      return generateVisualWithFallback(scene.visual_prompt, quality, userEmail, genPlan, format, strict, track)
    })
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
      const ai = await generateVisual(false)
      return clipFromVisual(ai, sceneDuration)
    }
    if (input.mediaMode === 'mixed') {
      if (userChoseStock) {
        return { url: sel!.url!, type: 'stock', kind: sel!.type === 'photo' ? 'photo' : 'video', duration: sceneDuration }
      }
      if (sel?.fallbackToAI || !sel) {
        const ai = await generateVisual(false)
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
    const ai = await generateVisual(input.mediaMode === 'ai')
    return clipFromVisual(ai, sceneDuration)
  }

  // Voix + musique en parallèle des scènes ; chaque scène résolue est
  // checkpointée (hooks.onSceneResolved) pour reprise sans régénération.
  const generated = await Promise.allSettled([
    // Reuse the existing durable voice implementation, including large-buffer chunks.
    executeProductionStep({ step: 'voice', userId, userEmail, userPlan: input.userPlan, genPlan,
      qualityCap: quality, mediaFormat, idea: input.topic, template: null, format, voice: input.voiceId,
      musicStyle: script.music_style, tone: null, previousData: { script }, brandKit: null, requestKey: videoId,
    }, { steps: done }, hooks) as Promise<{ url: string }>,
    musicCheckpointed(done, hooks, step, 'music', async job => (await generateMusic({ prompt: script.music_prompt, style: script.music_style as Parameters<typeof generateMusic>[0]['style'], duration: script.estimated_duration, instrumental: true }, job)).audio_url).then(async (url) => {
      if (script.music_style && !url) throw new Error('SUTRA_REQUIRED_MUSIC_MISSING')
      await logApiCall(userId, 'suno', 'generateMusic', url ? 'success' : 'skipped')
      return url
    }),
    (async () => {
      const clips: AssembleClip[] = []
      for (let i = 0; i < script.scenes.length; i++) {
        const clip = await resolveSceneClip(script.scenes[i], i)
        if (!clip) throw new Error(`Scene ${i + 1} manquante — montage refuse`)
        if (clip) {
          clips.push(clip)
          await hooks.onSceneResolved?.(i, clip)
        }
      }
      return clips
    })(),
  ])
  // Do not release/requeue a job while another parallel paid task is still running.
  for (const result of generated) if (result.status === 'rejected') throw result.reason
  const voice = (generated[0] as PromiseFulfilledResult<{ url: string }>).value
  const musicUrl = (generated[1] as PromiseFulfilledResult<string>).value
  const clipsResult = (generated[2] as PromiseFulfilledResult<AssembleClip[]>).value

  await checkpointStage(done, hooks, 'scenes', clipsResult)
  await checkpointStage(done, hooks, 'images', clipsResult.filter(c => c.kind === 'photo'))
  const voiceUrl = voice.url
  requireTracks(voiceUrl, musicUrl, { voice: Boolean(script.narration), music: Boolean(script.music_style) })
  await checkpointStage(done, hooks, 'voice', voiceUrl)
  await checkpointStage(done, hooks, 'music', musicUrl)
  await step('tracks_saved', async () => { await updateVideo({ voice_url: voiceUrl, music_url: musicUrl || null }); return true })

  const subtitles = await step('subtitles', async () => generateSubtitles(script.narration, script.estimated_duration))
  await checkpointStage(done, hooks, 'subtitles', subtitles)
  await hooks.heartbeat?.()
  const rendered = await step('assembly', () => assembleFinalVideo({
    clips: clipsResult,
    voiceUrl,
    musicUrl: musicUrl || '',
    musicVolume: 0.3,
    subtitles,
    transitions: 'fade',
    format,
    quality,
    brandKit: input.brandKit,
    renderJob: durableRenderJob(done, hooks.onStepResolved),
  }), true, typeof done.assembly_render_id === 'string')
  await checkpointStage(done, hooks, 'composition', rendered)
  const assembled = await step('verified', () => verifyAndStoreRenderedVideo(rendered, {
    userId, mediaId: videoId, requireAudio: Boolean(voiceUrl || musicUrl),
  }))
  assertFinalMedia(assembled, clipsResult.map(c => c.url), Boolean(voiceUrl || musicUrl))
  await checkpointStage(done, hooks, 'export', assembled)
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

  await step('saved', async () => { await updateVideo({
    video_url: assembled.url,
    thumbnail_url: thumbnailUrl,
    shotstack_json: assembled.timeline,
    duration: assembled.duration,
    status: 'ready',
    quality: actualQuality,
    cost_estimate: costEstimate,
  }); return true })

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

  const publication = await step('publication', () => triggerAutopilot({
    userId, videoId, videoUrl: assembled.url, videoTitle: script.title ?? '',
    videoDescription: script.description ?? '', videoTags: script.tags ?? [],
  }))
  await checkpointStage(done, hooks, 'publication', publication)

  return { videoUrl: assembled.url, actualQuality, duration: assembled.duration }
}
