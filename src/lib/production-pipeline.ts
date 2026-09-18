import { generateScript } from '@/lib/claude'
import {
  generateVoiceWithFallback,
  generateVisualWithFallback,
  generateMusicWithFallback,
  type VisualResult,
} from '@/lib/fallbacks'
import { searchVideos, type MediaFormat } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { assembleFinalVideo, generateSubtitlesFromScript, actualQualityFor, type AssembleClip } from '@/lib/shotstack'
import { resolveVoiceProviderId } from '@/lib/constants'
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
  visual: (scene: ScriptData['scenes'][number], duration: number) => Promise<VisualResult | null>
  voice: (narration: string, voiceId: string) => Promise<ArrayBuffer>
  music: (prompt: string, style: string, duration: number) => Promise<string | null>
  assemble: typeof assembleFinalVideo
  upload: (path: string, buffer: Buffer, contentType: string) => Promise<string>
}

const MAX_VOICE_B64 = 5 * 1024 * 1024 // au-delà : voix non checkpointée (re-synthèse possible, tracée)

function defaultProviders(input: ProductionJobInput): ProductionProviders {
  return {
    script: (args) => generateScript(
      { topic: args.topic, niche: 'general', style: args.style, format: args.format, duration: args.durationHint },
      input.userId
    ),
    visual: async (scene, duration) => {
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
      return generateVisualWithFallback(scene.visual_prompt, input.qualityCap, input.userEmail, input.genPlan, input.mediaFormat, false, { userId: input.userId, duration })
    },
    voice: (text, voiceId) => generateVoiceWithFallback(text, voiceId),
    music: (prompt, style, duration) => generateMusicWithFallback(prompt, style, duration),
    assemble: (args) => assembleFinalVideo(args),
    upload: (path, buffer, contentType) => uploadToStorage(path, buffer, contentType),
  }
}

type Stepper = <T>(key: string, fn: () => Promise<T>) => Promise<T>

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
  const step: Stepper = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const cached = done[key]
    if (cached !== undefined) return cached as T
    await hooks.heartbeat?.()
    const value = await fn()
    done[key] = value
    await hooks.onStepResolved?.(key, value)
    return value
  }

  if (input.step === 'script') {
    const config = TEMPLATE_CONFIGS[input.template ?? ''] ?? TEMPLATE_CONFIGS.youtube
    return step('script', () =>
      providers.script({ topic: input.idea, style: input.tone ?? 'professionnel', format: input.format ?? '16:9', durationHint: config.durationHint }))
  }

  if (input.step === 'video') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    if (!scriptData?.scenes?.length) throw new Error('Script requis pour generer les scenes')
    const resolved: VisualResult[] = []
    for (let i = 0; i < Math.min(scriptData.scenes.length, MAX_SCENES); i++) {
      const scene = scriptData.scenes[i]
      const visual = await step(`scene:${i}`, () => providers.visual(scene, Math.max(1, scene.duration_seconds || 5)))
      if (visual) resolved.push(visual)
    }
    return resolved
  }

  if (input.step === 'voice') {
    const scriptData = sanitizeScriptData(input.previousData.script)
    if (!scriptData?.narration) throw new Error('Script requis pour la narration')
    const voiceUrl = await resolveVoiceUrl(input, step, providers, scriptData.narration)
    return { url: voiceUrl }
  }

  if (input.step === 'music') {
    return step('music', () =>
      providers.music(`${input.musicStyle ?? 'cinematic'} background music for ${input.idea}`, input.musicStyle ?? 'cinematic', 120))
  }

  if (input.step === 'assembly') {
    return runAssembly(input, step, providers)
  }

  if (input.step === 'all') {
    const config = TEMPLATE_CONFIGS[input.template ?? ''] ?? TEMPLATE_CONFIGS.youtube
    const script = await step('script', () =>
      providers.script({ topic: input.idea, style: input.tone ?? 'professionnel', format: input.format ?? '16:9', durationHint: config.durationHint }))
    const music = await step('music', () =>
      providers.music(`${input.musicStyle ?? 'cinematic'} background music for ${input.idea}`, input.musicStyle ?? 'cinematic', script.estimated_duration))
    const clips: AssembleClip[] = []
    for (let i = 0; i < Math.min(script.scenes.length, MAX_SCENES); i++) {
      const scene = script.scenes[i]
      const visual = await step(`scene:${i}`, () => providers.visual(scene, Math.max(1, scene.duration_seconds || 5)))
      if (visual) {
        clips.push({
          url: visual.url,
          type: visual.source === 'pexels-stock' ? 'stock' : 'ia',
          kind: 'video',
          duration: Math.max(1, scene.duration_seconds || 5),
        })
      }
    }
    if (clips.length === 0) throw new Error('Aucune scene resolue (IA et stock indisponibles) — video annulee, aucun autre cout engage')
    const voiceUrl = await resolveVoiceUrl(input, step, providers, script.narration)
    return runAssembly(input, step, providers, { script, clips, voiceUrl, musicUrl: music ?? '' })
  }

  throw new Error(`Etape non durable : ${input.step}`)
}

/** Voix : le buffer est checkpointé en base64 — un crash entre synthèse et
 *  upload ne RE-SYNTHÉTISE pas (pas de second débit voix). */
async function resolveVoiceUrl(
  input: ProductionJobInput,
  step: Stepper,
  providers: ProductionProviders,
  narration: string
): Promise<string> {
  return step('voice_url', async () => {
    const b64 = await step('voice_b64', async () => {
      const buf = await providers.voice(narration, resolveVoiceProviderId(input.voice))
      const encoded = Buffer.from(buf).toString('base64')
      return encoded.length > MAX_VOICE_B64 ? null : encoded
    })
    return providers.upload(`production/${input.userId}/${input.requestKey}.mp3`, b64 ? Buffer.from(b64, 'base64') : Buffer.alloc(0), 'audio/mpeg')
  })
}

async function runAssembly(
  input: ProductionJobInput,
  step: Stepper,
  providers: ProductionProviders,
  prefetched?: { script: ScriptData; clips: AssembleClip[]; voiceUrl: string; musicUrl: string }
): Promise<{ url: string; videoId: string | null; quality: string; duration: number }> {
  const scriptData = prefetched?.script ?? sanitizeScriptData(input.previousData.script)
  const clips = prefetched?.clips ?? assemblyClipsFromClient(input.previousData.video)
  const voiceUrl = prefetched?.voiceUrl ?? (input.previousData.voice as { url?: string } | undefined)?.url
  if (!clips.length || !voiceUrl) throw new Error('Video et voix requises pour l\'assemblage')

  const subtitles = scriptData?.narration
    ? generateSubtitlesFromScript(scriptData.narration, scriptData.scenes ?? [])
    : []
  const assembled = await step('assembly', () =>
    providers.assemble({
      clips,
      voiceUrl,
      musicUrl: prefetched?.musicUrl ?? ((input.previousData.music as { url?: string } | undefined)?.url ?? ''),
      musicVolume: 0.3,
      subtitles,
      transitions: 'fade',
      format: input.format ?? '16:9',
      quality: input.qualityCap,
      brandKit: input.brandKit,
    }))
  // Qualité annoncée = qualité RÉELLE après plafonnement du renderer.
  return step('assembly_saved', async () => ({
    url: assembled.url,
    videoId: null,
    duration: assembled.duration,
    quality: actualQualityFor(input.qualityCap, assembled.outputQuality),
  }))
}

function assemblyClipsFromClient(raw: unknown): AssembleClip[] {
  const arr = (raw as Array<Partial<AssembleClip>> | undefined) ?? []
  return arr.slice(0, MAX_SCENES)
    .filter((v) => v.url)
    .map((v) => ({ url: v.url!, type: v.type === 'stock' ? 'stock' : 'ia', kind: v.kind, duration: v.duration }))
}
