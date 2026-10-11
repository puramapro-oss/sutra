import { assembleFinalVideo, actualQualityFor, durableRenderJob, verifyAndStoreRenderedVideo, type AssembleClip } from '@/lib/shotstack'
import { createServiceClient } from '@/lib/supabase'
import { sendNotification, logActivity } from '@/lib/logger'

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
  musicVolume: number
  clips: AssembleClip[]
  subtitles: Array<{ text: string; start: number; end: number }>
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
  const { data, error } = await service.from('videos')
    .update({ ...update, status: 'ready' })
    .eq('id', input.videoId).eq('user_id', input.userId).select('id').single()
  if (error || !data) throw new Error(`Persistance export impossible: ${error?.message ?? 'video introuvable'}`)
  await sendNotification(input.userId, {
    type: 'success', title: 'Export termine !', message: 'Ton export est pret dans ta bibliotheque.',
  }).catch(() => {})
  await logActivity(input.userId, 'video_exported', 'Video re-exportee', {
    video_id: input.videoId, quality: update.quality,
  }).catch(() => {})
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
  const step = async <T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const cached = done[key]
    if (cached !== undefined) return cached as T
    await hooks.heartbeat?.()
    const value = await fn()
    await hooks.onStepResolved?.(key, value)
    done[key] = value
    return value
  }

  const rendered = await step('assembly', () =>
    providers.assemble({
      clips: input.clips,
      voiceUrl: input.voiceUrl,
      musicUrl: input.musicUrl ?? '',
      musicVolume: input.musicVolume,
      subtitles: input.subtitles,
      transitions: 'fade',
      format: input.format,
      quality: input.quality,
      brandKit: null,
      renderJob: durableRenderJob(done, hooks.onStepResolved),
    }))
  const assembled = await step('verified', () => verifyAndStoreRenderedVideo(rendered, {
    userId: input.userId, mediaId: input.videoId, requireAudio: Boolean(input.voiceUrl || (input.musicUrl && input.musicVolume > 0)),
  }))

  const result = await step('saved', async () => {
    const quality = actualQualityFor(input.quality, assembled.outputQuality)
    await providers.persist(input, { video_url: assembled.url, quality, duration: assembled.duration, shotstack_json: assembled.timeline })
    return { url: assembled.url, quality }
  })
  return result
}
