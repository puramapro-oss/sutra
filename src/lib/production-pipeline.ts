import { assembleFinalVideo } from './final-composition'
import { pipelineSteps, checkpointStage, assertFinalMedia, requireTracks } from '@/lib/pipeline-state'
import { createHash } from 'node:crypto'
import { durableLtxJob, type LtxJobPersistence, type LtxJobState } from '@/lib/ltx'
import { generateMusic, type SunoJobPort } from '@/lib/suno'
import { musicCheckpointed } from '@/lib/music-checkpoint'
import { generateScript } from '@/lib/claude'
import {
  generateVoiceWithFallback,
  generateVisualWithFallback,
  type VisualResult,
} from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { generateSubtitlesFromScript, actualQualityFor, durableRenderJob, verifyAndStoreRenderedVideo, type AssembleClip } from '@/lib/shotstack'
import { resolveVoiceProviderId } from '@/lib/constants'
import { shouldUseLocalEngine } from './local-engine'
import { TEMPLATE_CONFIGS, sanitizeScriptData, MAX_SCENES } from '@/lib/production-schema'
import type { Plan, Profile, ScriptData } from '@/types'

// -----------------------------------------------------------------------------
// Pipeline PRODUCTION exécutable inline (/api/production) OU par le worker
// (/api/cron/video-worker), avec REPRISE sans double génération ni double
// débit : chaque résultat fournisseur est checkpointé (progress.steps) et
// JAMAIS recalculé au redémarrage (audit #10/#14).
//
// Les fournisseurs sont injectables (défaut = libs réelles) : les tests
// branchent des doublures comptant les appels — la garantie « chaque scène
// n'est générée qu'une fois » est ainsi prouvée, pas supposée.
// -----------------------------------------------------------------------------

export type ProductionStep = 'script' | 'video' | 'voice' | 'music' | 'assembly' | 'all'

export interface ProductionJobInput {
  step: ProductionStep
  userId: string
  userEmail: string | null
  userPlan: Plan
  genPlan: Plan
  /** Plafond qualité déjà appliqué par plan (AVANT tout appel payant). */
  qualityCap: string
  mediaFormat: MediaFormat
  idea: string
  template: string | null
  format: string | null
  voice: string | null
  musicStyle: string | null
  tone: string | null
  previousData: Record<string, unknown>
  brandKit: Profile['brand_kit']
  /** Clé d'idempotence de la tâche — aussi le nom du fichier voix uploadé. */
  requestKey: string
}

export interface ProductionJobResume {
  steps: Record<string, unknown>
}

export interface ProductionJobHooks {
  /** Checkpoint durable après chaque résultat fournisseur obtenu. */
  onStepResolved?: (key: string, value: unknown) => Promise<void>
  /** Prolongation du bail avant chaque phase fournisseur longue. */
  heartbeat?: () => Promise<void>
}

/** Fournisseurs injectables (tests) — défauts = libs réelles. */
export interface ProductionProviders {
  script: (args: { topic: string; style: string; format: string; durationHint: string }) => Promise<ScriptData>
  /** Résout UNE scène (stock ou IA) — le checkpoint la court-circuite. */
  visual: (scene: ScriptData['scenes'][number], duration: number, job?: LtxJobPersistence) => Promise<VisualResult | null>
  voice: (narration: string, voiceId: string) => Promise<ArrayBuffer>
  music: (prompt: string, style: string, duration: number, job?: SunoJobPort) => Promise<string | null>
  assemble: typeof assembleFinalVideo
  upload: (path: string, buffer: Buffer, contentType: string) => Promise<string>
}

// Voix checkpointée en base64 — PLUS AUCUNE TAILLE EXCLUE :
//   * ≤ 20 Mo (b64) : bloc unique `voice_b64` (un seul RPC) ;
//   * > 20 Mo : DÉCOUPE en morceaux `voice_b64:{i}` (~12 Mo chacun, sous la
//     limite de payload RPC), reassemblés à la reprise — le RPC de checkpoint
//     MERGE le jsonb (migration v10), donc chaque morceau persiste sans écraser
//     l'acquis. Une interruption après synthèse ne régénère JAMAIS la voix,
//     quelle que soit sa taille.
const MAX_VOICE_B64 = 20 * 1024 * 1024
const VOICE_CHUNK_B64 = 12 * 1024 * 1024

function defaultProviders(input: ProductionJobInput): ProductionProviders {
  return {
    script: (args) => generateScript(
      { topic: args.topic, niche: 'general', style: args.style, format: args.format, duration: args.durationHint },
      input.userId
    ),
    visual: async (scene, duration, job) => {
      if (scene.use_stock) {
        const stock = await searchVideos(scene.visual_prompt, 1, { format: input.mediaFormat })
        const best = stock[0]
        if (!best) return null
        return {
          url: best.url,
          engine: 'wan-classic',
          source: 'pexels-stock',
          stockMeta: { id: best.id, author: best.author, authorUrl: best.authorUrl, sourcePage: best.sourcePage, width: best.width, height: best.height },
        } satisfies VisualResult
      }
      // Production has no video row until assembly. Its persisted request key is
      // the personal engine's stable scope; never use it as an API video-row ID.
      const personal = shouldUseLocalEngine(input.userEmail) && (!job?.current || Boolean(job.current.salad))
      return generateVisualWithFallback(scene.visual_prompt, input.qualityCap, input.userEmail, input.genPlan, input.mediaFormat, false,
        { userId: input.userId, videoId: personal ? input.requestKey : undefined, duration, job })
    },
    voice: (text, voiceId) => generateVoiceWithFallback(text, voiceId),
    music: async (prompt, style, duration, job) => style === 'none' ? null : (await generateMusic({ prompt, style: style as Parameters<typeof generateMusic>[0]['style'], duration, instrumental: true }, job)).audio_url,
    assemble: (args) => assembleFinalVideo(args),
    upload: (path, buffer, contentType) => uploadToStorage(path, buffer, contentType),
  }
}

type Stepper = <T>(key: string, fn: () => Promise<T>, paid?: boolean, recover?: boolean) => Promise<T>

/**
 * Exécute l'étape. `resume.steps` contient les résultats DÉJÀ obtenus
 * (checkpoint) : toute clé présente court-circuite l'appel fournisseur —
 * c'est la garantie « reprise sans double génération, donc sans double débit ».
 */
export async function executeProductionStep(
  input: ProductionJobInput,
  resume: ProductionJobResume,
  hooks: ProductionJobHooks = {},
  providers: ProductionProviders = defaultProviders(input)
): Promise<unknown> {
  const done = resume.steps
  const step = pipelineSteps(done, hooks)

  const visual = (scene: ScriptData['scenes'][number], index: number) => step(`scene:${index}`, () =>
    providers.visual(scene, Math.max(1, scene.duration_seconds || 5),
      durableLtxJob(done, `scene:${index}:ltx`, hooks.onStepResolved)),
    !scene.use_stock, Boolean((done[`scene:${index}:ltx`] as LtxJobState | undefined)?.id))

  if (input.step === 'script') {
    const config = TEMPLATE_CONFIGS[input.template ?? ''] ?? TEMPLATE_CONFIGS.youtube
    const script = await step('script', () =>
      providers.script({ topic: input.idea, style: input.tone ?? 'professionnel', format: input.format ?? '16:9', durationHint: config.durationHint }), true)
    await checkpointStage(done, hooks, 'script', script)
    return script
  }

  if (input.step === 'video') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    if (!scriptData?.scenes?.length) throw new Error('Script requis pour generer les scenes')
    const resolved: VisualResult[] = []
    for (let i = 0; i < Math.min(scriptData.scenes.length, MAX_SCENES); i++) {
      const scene = scriptData.scenes[i]
      const result = await visual(scene, i)
      if (!result?.url) throw new Error(`Scene ${i + 1} manquante — production incomplete`)
      resolved.push(result)
    }
    await checkpointStage(done, hooks, 'scenes', resolved)
    await checkpointStage(done, hooks, 'images', [], 'skipped')
    return resolved
  }

  if (input.step === 'voice') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    if (!scriptData?.narration) throw new Error('Script requis pour la narration')
    const voiceUrl = await resolveVoiceUrl(input, done, hooks, step, providers, scriptData.narration)
    await checkpointStage(done, hooks, 'voice', voiceUrl)
    return { url: voiceUrl }
  }

  if (input.step === 'music') {
    const music = await musicCheckpointed(done, hooks, step, 'music', job =>
      providers.music(`${input.musicStyle ?? 'cinematic'} background music for ${input.idea}`, input.musicStyle ?? 'cinematic', 120, job))
    requireTracks(null, music, { voice: false, music: input.musicStyle !== 'none' })
    await checkpointStage(done, hooks, 'music', music, music ? 'complete' : 'skipped')
    return music
  }

  if (input.step === 'assembly') {
    return runAssembly(input, step, providers, done, hooks)
  }

  if (input.step === 'all') {
    const config = TEMPLATE_CONFIGS[input.template ?? ''] ?? TEMPLATE_CONFIGS.youtube
    const script = await step('script', () =>
      providers.script({ topic: input.idea, style: input.tone ?? 'professionnel', format: input.format ?? '16:9', durationHint: config.durationHint }), true)
    if (!script.scenes.length || script.scenes.length > MAX_SCENES) throw new Error('Nombre de scenes hors limites — aucune scene ne sera supprimee silencieusement')
    await checkpointStage(done, hooks, 'script', script)
    const music = await musicCheckpointed(done, hooks, step, 'music', job =>
      providers.music(`${input.musicStyle ?? 'cinematic'} background music for ${input.idea}`, input.musicStyle ?? 'cinematic', script.estimated_duration, job))
    requireTracks(null, music, { voice: false, music: input.musicStyle !== 'none' })
    const clips: AssembleClip[] = []
    for (let i = 0; i < Math.min(script.scenes.length, MAX_SCENES); i++) {
      const scene = script.scenes[i]
      const result = await visual(scene, i)
      if (!result?.url) throw new Error(`Scene ${i + 1} manquante — montage refuse`)
      if (result) {
        clips.push({
          url: result.url,
          type: result.source === 'pexels-stock' ? 'stock' : 'ia',
          kind: 'video',
          duration: Math.max(1, scene.duration_seconds || 5),
        })
      }
    }
    if (clips.length === 0) throw new Error('Aucune scene resolue (IA et stock indisponibles) — video annulee, aucun autre cout engage')
    await checkpointStage(done, hooks, 'scenes', clips)
    await checkpointStage(done, hooks, 'images', [], 'skipped')
    await checkpointStage(done, hooks, 'music', music)
    const voiceUrl = await resolveVoiceUrl(input, done, hooks, step, providers, script.narration)
    await checkpointStage(done, hooks, 'voice', voiceUrl)
    return runAssembly(input, step, providers, done, hooks, { script, clips, voiceUrl, musicUrl: music ?? '' })
  }

  throw new Error(`Etape non durable : ${input.step}`)
}

/** Voix : le buffer est checkpointé en base64 (bloc ≤20 Mo, sinon morceaux
 *  ~12 Mo) — un crash entre synthèse et upload ne RE-SYNTHÉTISE pas, quelle
 *  que soit la taille. */
async function resolveVoiceUrl(
  input: ProductionJobInput,
  done: Record<string, unknown>,
  hooks: ProductionJobHooks,
  step: Stepper,
  providers: ProductionProviders,
  narration: string
): Promise<string> {
  return step('voice_url', async () => {
    const b64 = await voiceB64Checkpointed(done, hooks, step, providers, narration, input.voice)
    return providers.upload(`production/${input.userId}/${input.requestKey}.mp3`, b64 ? Buffer.from(b64, 'base64') : Buffer.alloc(0), 'audio/mpeg')
  })
}

/** Retourne la voix en base64 : depuis le checkpoint (bloc ou morceaux
 *  reassemblés) SANS rappeler le fournisseur, sinon synthétise UNE fois puis
 *  persiste tout (bloc unique ou découpe). */
export async function voiceB64Checkpointed(
  done: Record<string, unknown>,
  hooks: ProductionJobHooks,
  step: Stepper,
  providers: Pick<ProductionProviders, 'voice'>,
  narration: string,
  voice: string | null
): Promise<string | null> {
  // Cache bloc unique (voix ≤20 Mo).
  if (typeof done.voice_b64 === 'string') return done.voice_b64
  // Cache morceaux (voix >20 Mo) : réassemblage SANS synthèse.
  const parts = typeof done.voice_b64_parts === 'number' ? done.voice_b64_parts : 0
  if (parts > 0) {
    let b64 = ''
    for (let i = 0; i < parts; i++) {
      const part = done[`voice_b64:${i}`]
      if (typeof part !== 'string') throw new Error(`checkpoint voix corrompu (morceau ${i} manquant)`)
      b64 += part
    }
    const checksum = done.voice_b64_sha256
    if (typeof checksum === 'string' && createHash('sha256').update(b64).digest('hex') !== checksum) {
      throw new Error('SUTRA_VOICE_CHECKPOINT_CORRUPT')
    }
    return b64
  }

  if (done.voice_submission_started || Object.keys(done).some(key => /^voice_b64:\d+$/.test(key))) {
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: resultat vocal incomplet, aucune nouvelle synthese')
  }

  await hooks.heartbeat?.()
  await step('voice_submission_started', async () => true)
  const buf = await providers.voice(narration, resolveVoiceProviderId(voice))
  if (!buf.byteLength) throw new Error('SUTRA_VOICE_EMPTY_RESULT')
  const encoded = Buffer.from(buf).toString('base64')
  if (encoded.length <= MAX_VOICE_B64) {
    await step('voice_b64', async () => encoded)
    return encoded
  }
  // >20 Mo : découpe — CHAQUE morceau tient dans un RPC (merge jsonb côté SQL).
  const chunks: string[] = []
  for (let i = 0; i < encoded.length; i += VOICE_CHUNK_B64) chunks.push(encoded.slice(i, i + VOICE_CHUNK_B64))
  // The manifest precedes chunks: a partial write must never trigger a new voice
  // generation and combine the old beginning with a different recording.
  await step('voice_b64_sha256', async () => createHash('sha256').update(encoded).digest('hex'))
  await step('voice_b64_parts', async () => chunks.length)
  for (let i = 0; i < chunks.length; i++) {
    await step(`voice_b64:${i}`, async () => chunks[i])
  }
  return encoded
}

async function runAssembly(
  input: ProductionJobInput,
  step: Stepper,
  providers: ProductionProviders,
  done: Record<string, unknown>,
  hooks: ProductionJobHooks,
  prefetched?: { script: ScriptData; clips: AssembleClip[]; voiceUrl: string; musicUrl: string }
): Promise<{ url: string; videoId: string | null; quality: string; duration: number }> {
  const scriptData = prefetched?.script ?? sanitizeScriptData(input.previousData.script)
  const clips = prefetched?.clips ?? assemblyClipsFromClient(input.previousData.video)
  const voiceUrl = prefetched?.voiceUrl ?? (input.previousData.voice as { url?: string } | undefined)?.url
  if (!clips.length) throw new Error('Video requise pour l\'assemblage')

  if (scriptData?.scenes?.length && scriptData.scenes.length !== clips.length) throw new Error('SUTRA_INCOMPLETE_SCENES')
  await checkpointStage(done, hooks, 'script', scriptData, scriptData ? 'complete' : 'skipped')
  await checkpointStage(done, hooks, 'scenes', clips)
  await checkpointStage(done, hooks, 'images', clips.filter(c => c.kind === 'photo'))
  const musicUrl = prefetched?.musicUrl ?? ((input.previousData.music as { url?: string } | undefined)?.url ?? '')
  requireTracks(voiceUrl, musicUrl, { voice: Boolean(scriptData?.narration), music: input.musicStyle !== 'none' })
  await checkpointStage(done, hooks, 'voice', voiceUrl ?? '', voiceUrl ? 'complete' : 'skipped')
  await checkpointStage(done, hooks, 'music', musicUrl, musicUrl ? 'complete' : 'skipped')
  const subtitles = await step('subtitles', async () => scriptData?.narration
    ? generateSubtitlesFromScript(scriptData.narration, scriptData.scenes ?? []) : [])
  await checkpointStage(done, hooks, 'subtitles', subtitles)
  const rendered = await step('assembly', () =>
    providers.assemble({
      clips,
      voiceUrl: voiceUrl ?? '',
      musicUrl,
      musicVolume: 0.3,
      subtitles,
      transitions: 'fade',
      format: input.format ?? '16:9',
      quality: input.qualityCap,
      brandKit: input.brandKit,
      renderJob: durableRenderJob(done, hooks.onStepResolved),
    }), true, typeof done.assembly_render_id === 'string')
  await checkpointStage(done, hooks, 'composition', rendered)
  const assembled = await step('verified', () => verifyAndStoreRenderedVideo(rendered, {
    userId: input.userId, mediaId: input.requestKey,
    requireAudio: Boolean(voiceUrl || prefetched?.musicUrl || (input.previousData.music as { url?: string } | undefined)?.url),
  }))
  assertFinalMedia(assembled, clips.map(c => c.url), Boolean(voiceUrl || musicUrl))
  await checkpointStage(done, hooks, 'export', assembled)
  await checkpointStage(done, hooks, 'publication', { reason: 'publication is a separate durable operation' }, 'pending')
  // Renderer preset label; final-file verification remains a separate gate.
  return step('assembly_saved', async () => ({
    url: assembled.url,
    videoId: null,
    duration: assembled.duration,
    quality: actualQualityFor(input.qualityCap, assembled.outputQuality),
  }))
}

function assemblyClipsFromClient(raw: unknown): AssembleClip[] {
  const arr = (raw as Array<Partial<AssembleClip>> | undefined) ?? []
  if (!Array.isArray(arr) || !arr.length || arr.length > MAX_SCENES || arr.some(v => !v?.url)) throw new Error('SUTRA_INCOMPLETE_SCENES')
  return arr.map((v) => ({ url: v.url!, type: v.type === 'stock' ? 'stock' : 'ia', kind: v.kind, duration: v.duration }))
}

export { persistProductionResult } from '@/lib/production-persistence'
