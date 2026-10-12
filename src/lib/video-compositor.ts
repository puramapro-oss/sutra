/**
 * Orchestrateur de composition video — point d'entree UNIQUE pour
 * /api/create, /api/production et le mode autonome (sutra-auto).
 *
 * Moteur primaire : FFmpeg local (`ffmpeg-compositor.ts`) — gratuit, sans
 * dependance reseau tierce, controle total (watermark/dimensions/duree).
 * Secours : Shotstack cloud (`shotstack.ts`) si le moteur local echoue
 * (binaire absent dans l'environnement d'execution, timeout, etc).
 *
 * Jamais de "faux succes" : si les deux moteurs echouent, l'erreur est
 * propagee — l'appelant doit persister un statut 'failed' explicite
 * (cf /api/create, /api/production, sutra-auto) plutot que de pretendre
 * qu'une video est prete.
 */
import { composeVideo, isCancelledError, isValidationError, FfmpegCompositorError, type ComposeVideoParams } from '@/lib/ffmpeg-compositor'

export { isCancelledError }
import { assembleFinalVideo, type AssembleParams } from '@/lib/shotstack'
import { uploadToStorage } from '@/lib/storage'
import type { SubtitleEntry } from '@/types'
import { compositionPlan, type CompositionRequirements, type MediaLineage } from './composition-contract.ts'
import { assertFinalMedia, compositionHash, validateRenderedBuffer, validateRenderedMedia, type MediaValidation } from './media-validation.ts'

export interface VideoCompositionClip {
  url: string
  type: 'ia' | 'stock'
  durationSeconds?: number
  kind?: 'video' | 'photo'
  lineage?: MediaLineage
}

export interface VideoCompositionJob {
  renderJob?: AssembleParams['renderJob']
  clips: VideoCompositionClip[]
  requirements?: CompositionRequirements
  introOutroDurationSeconds?: number
  voiceUrl?: string | null
  musicUrl?: string | null
  voiceVolume?: number
  musicVolume?: number
  subtitles: SubtitleEntry[]
  transitions?: 'fade' | 'none'
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  watermarkUrl?: string | null
  watermarkText?: string | null
  introUrl?: string | null
  outroUrl?: string | null
  /** Active la reprise mid-render (voir ComposeVideoParams.jobId) — typiquement le videoId. */
  jobId?: string
  /** Annulation cooperative demandee par l'utilisateur. */
  signal?: AbortSignal
}

export interface VideoCompositionResult {
  url: string
  durationSeconds: number
  engine: 'ffmpeg' | 'shotstack'
  timeline?: Record<string, unknown>
  validation?: MediaValidation
}

export interface VideoCompositionDeps {
  compose?: (params: ComposeVideoParams) => ReturnType<typeof composeVideo>
  assemble?: typeof assembleFinalVideo
  upload?: typeof uploadToStorage
  validateBuffer?: typeof validateRenderedBuffer
  validateUrl?: typeof validateRenderedMedia
}

export async function composeVideoWithFallback(
  job: VideoCompositionJob,
  deps: VideoCompositionDeps = {}
): Promise<VideoCompositionResult> {
  compositionPlan(job)
  job.signal?.throwIfAborted()
  const compose = deps.compose ?? composeVideo
  const assemble = deps.assemble ?? assembleFinalVideo
  const upload = deps.upload ?? uploadToStorage
  let local: { buffer: Buffer; validation: MediaValidation }

  try {
    if (job.renderJob?.id) throw new Error('SUTRA_RESUME_EXISTING_RENDER')
    const result = await compose({
      requirements: job.requirements,
      introOutroDurationSeconds: job.introOutroDurationSeconds,
      clips: job.clips,
      voiceUrl: job.voiceUrl,
      musicUrl: job.musicUrl,
      voiceVolume: job.voiceVolume,
      musicVolume: job.musicVolume,
      subtitles: job.subtitles,
      transitions: job.transitions,
      format: job.format,
      quality: job.quality,
      watermarkUrl: job.watermarkUrl,
      watermarkText: job.watermarkText,
      introUrl: job.introUrl,
      outroUrl: job.outroUrl,
      jobId: job.jobId,
      signal: job.signal,
    })

    const validation = result.validation ?? await (deps.validateBuffer ?? validateRenderedBuffer)(result.buffer, job, [], job.signal)
    if (validation.contractHash !== compositionHash(job)) throw new FfmpegCompositorError('Preuve media incompatible avec le brief', 'final-validation')
    assertFinalMedia(validation.final, job)
    local = { buffer: result.buffer, validation }
  } catch (err) {
    job.signal?.throwIfAborted()
    // Une erreur de validation (clip vide, duree nulle/negative, duree totale
    // au-dela du plafond de la qualite) est deterministe : elle echouerait de
    // la meme facon sur Shotstack (ou pire, degraderait silencieusement la
    // duree/qualite demandee). Jamais la peine de declencher un appel API
    // payant pour un input qui ne peut pas aboutir — on propage directement.
    if (isValidationError(err)) {
      throw err
    }
    // Annulation volontaire de l'utilisateur (jamais une panne moteur) :
    // jamais de secours Shotstack (appel API payant) sur un rendu annule.
    if (isCancelledError(err)) {
      throw err
    }

    console.error(
      '[video-compositor] moteur FFmpeg local indisponible, secours Shotstack:',
      err instanceof Error ? err.name : 'Error'
    )

    const assembled = await assemble({
      signal: job.signal,
      renderJob: job.renderJob,
      clips: job.clips.map(c => ({ ...c, duration: c.durationSeconds })),
      requirements: job.requirements,
      introOutroDurationSeconds: job.introOutroDurationSeconds,
      watermarkText: job.watermarkText,
      voiceUrl: job.voiceUrl ?? '',
      musicUrl: job.musicUrl ?? '',
      voiceVolume: job.voiceVolume,
      musicVolume: job.musicVolume ?? 0.25,
      subtitles: job.subtitles,
      transitions: job.transitions ?? 'fade',
      format: job.format,
      quality: job.quality,
      watermarkUrl: job.watermarkUrl ?? null,
      brandKit: {
        intro_template: job.introUrl ?? undefined,
        outro_template: job.outroUrl ?? undefined,
      },
    })

    const validation = assembled.validation ?? await (deps.validateUrl ?? validateRenderedMedia)(assembled.url, job, job.signal)
    if (job.clips.some(c => c.url === assembled.url)) throw new Error('Video brute refusee comme montage')
    if (validation.contractHash !== compositionHash(job)) throw new FfmpegCompositorError('Preuve media incompatible avec le brief', 'final-validation')
    assertFinalMedia(validation.final, job)
    return { url: assembled.url, durationSeconds: validation.final.duration, engine: 'shotstack', timeline: assembled.timeline, validation }
  }
  // A storage failure is not a renderer failure and must not trigger paid rendering.
  job.signal?.throwIfAborted()
  const filename = `compositions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
  const url = await upload(filename, local.buffer, 'video/mp4')
  return { url, durationSeconds: local.validation.final.duration, engine: 'ffmpeg', validation: local.validation }
}
