import { pipelineSteps, checkpointStage, assertFinalMedia, requireTracks, persistPipelineVideo } from '@/lib/pipeline-state'
import { assembleFinalVideo, actualQualityFor, durableRenderJob, verifyAndStoreRenderedVideo, type AssembleClip, type AssembleParams } from '@/lib/shotstack'
import { shotstackContract } from './shotstack-timeline'
import { compositionHash, validateRenderedMedia, assertFinalMedia as assertCompositionMedia } from './media-validation'
import { createServiceClient } from '@/lib/supabase'
import { pipelineNotification as sendNotification, pipelineActivity as logActivity } from '@/lib/pipeline-state'

// -----------------------------------------------------------------------------
// Pipeline EXPORT — exécutable inline (/api/video/export) OU par le worker
// (/api/cron/video-worker), avec REPRISE sans double rendu : le résultat
// Shotstack (l'appel payé) est checkpointé (progress.steps.assembly) — un
// redémarrage ne re-rend JAMAIS un montage déjà obtenu (audit #10/#14).
// Fournisseurs injectables : les tests prouvent la garantie aux compteurs.
// -----------------------------------------------------------------------------

export interface ExportJobInput {
  videoId: string
  userId: string
  quality: string
  format: string
  voiceUrl: string
  musicUrl: string | null
  voiceVolume?: number
  musicVolume: number
  requiredTracks: { voice: boolean; music: boolean }
  clips: AssembleClip[]
  subtitles: Array<{ text: string; start: number; end: number }>
  requirements?: AssembleParams['requirements']
  brandKit?: AssembleParams['brandKit']
  watermarkUrl?: string | null
  watermarkText?: string | null
  introOutroDurationSeconds?: number
}

export interface ExportJobResume {
  steps: Record<string, unknown>
}

export interface ExportJobHooks {
  onStepResolved?: (key: string, value: unknown) => Promise<void>
  heartbeat?: () => Promise<void>
}

export interface ExportProviders {
  assemble: typeof assembleFinalVideo
  validate?: typeof validateRenderedMedia
  /** Persistance finale (update videos + notification + activité). */
  persist: (input: ExportJobInput, update: { video_url: string; quality: string; duration: number; shotstack_json?: Record<string, unknown> }) => Promise<void>
}

export interface ExportJobResult {
  url: string
  quality: string
}

/** Shared persistence for the request and recovery worker; a failed write is fatal. */
export async function persistExportResult(
  input: ExportJobInput,
  update: { video_url: string; quality: string; duration: number; shotstack_json?: Record<string, unknown> },
  service = createServiceClient(),
): Promise<void> {
  await persistPipelineVideo(service, 'videos', input.videoId, { ...update, status: 'ready' })
  await sendNotification(input.userId, {
    type: 'success', title: 'Export termine !', message: 'Ton export est pret dans ta bibliotheque.',
  })
  await logActivity(input.userId, 'video_exported', 'Video re-exportee', {
    video_id: input.videoId, quality: update.quality,
  })
}

/**
 * Exécute l'export. `resume.steps.assembly` (rendu déjà payé) court-circuite
 * l'appel Shotstack — c'est la garantie « reprise sans double débit ».
 */
export async function executeExportJob(
  input: ExportJobInput,
  resume: ExportJobResume,
  hooks: ExportJobHooks = {},
  providers: ExportProviders
): Promise<ExportJobResult> {
  const done = resume.steps
  const step = pipelineSteps(done, hooks)

  if (!input.requiredTracks) throw new Error('SUTRA_RECONCILIATION_REQUIRED: export track requirements missing')
  requireTracks(input.voiceUrl, input.musicUrl, input.requiredTracks)

  const params: AssembleParams = {
    clips: input.clips, voiceUrl: input.voiceUrl, musicUrl: input.musicUrl ?? '',
    voiceVolume: input.voiceVolume, musicVolume: input.musicVolume, subtitles: input.subtitles, transitions: 'fade',
    format: input.format, quality: input.quality, brandKit: input.brandKit,
    requirements: { ...input.requirements,
      voice: input.requiredTracks.voice ? 'required' : (input.requirements?.voice ?? 'optional'),
      music: input.requiredTracks.music ? 'required' : (input.requirements?.music ?? 'optional') },
    watermarkUrl: input.watermarkUrl, watermarkText: input.watermarkText,
    introOutroDurationSeconds: input.introOutroDurationSeconds,
  }
  const contract = shotstackContract(params)
  const hash = compositionHash(contract)
  if (done.mediaContractHash && done.mediaContractHash !== hash) throw new Error('SUTRA_EXPORT_CONTRACT_CHANGED')
  await step('mediaContractHash', async () => hash)
  await checkpointStage(done, hooks, 'script', null, 'skipped')
  await checkpointStage(done, hooks, 'scenes', input.clips)
  await checkpointStage(done, hooks, 'images', input.clips.filter(c => c.kind === 'photo'))
  await checkpointStage(done, hooks, 'voice', input.voiceUrl, input.voiceUrl ? 'complete' : 'skipped')
  await checkpointStage(done, hooks, 'music', input.musicUrl, input.musicUrl ? 'complete' : 'skipped')
  await checkpointStage(done, hooks, 'subtitles', input.subtitles)
  const rendered = await step('assembly', () => providers.assemble({ ...params,
    renderJob: durableRenderJob(done, hooks.onStepResolved),
  }), true, typeof done.assembly_render_id === 'string')
  await checkpointStage(done, hooks, 'composition', rendered)
  const assembled = await step('verified', () => verifyAndStoreRenderedVideo(rendered, {
    userId: input.userId, mediaId: input.videoId, requireAudio: Boolean((input.voiceUrl && (input.voiceVolume ?? 1) > 0) || (input.musicUrl && input.musicVolume > 0)),
  }))

  assertFinalMedia(assembled, input.clips.map(c => c.url), Boolean((input.voiceUrl && (input.voiceVolume ?? 1) > 0) || (input.musicUrl && input.musicVolume > 0)))
  const quality = actualQualityFor(input.quality, assembled.outputQuality)
  const saved = done.saved as ExportJobResult | undefined
  if (quality !== input.quality || (saved && (saved.url !== assembled.url || saved.quality !== quality))) {
    throw new Error('SUTRA_EXPORT_CHECKPOINT_MISMATCH')
  }
  // Re-read media even when all paid steps and the final business write are cached.
  const validation = await (providers.validate ?? validateRenderedMedia)(assembled.url, contract)
  if (validation.contractHash !== hash || validation.final.sha256 !== assembled.verification?.sha256) {
    throw new Error('SUTRA_EXPORT_MEDIA_CHANGED')
  }
  assertCompositionMedia(validation.final, contract)
  await hooks.onStepResolved?.('mediaValidation', validation)
  done.mediaValidation = validation
  await checkpointStage(done, hooks, 'export', assembled)
  await checkpointStage(done, hooks, 'publication', { reason: 'publication is a separate durable operation' }, 'pending')
  const result = await step('saved', async () => {
    await providers.persist(input, { video_url: assembled.url, quality, duration: validation.final.duration, shotstack_json: { ...assembled.timeline, sutraMediaValidation: validation } })
    return { url: assembled.url, quality }
  })
  return result
}
