import { assembleFinalVideo, actualQualityFor, type AssembleClip } from '@/lib/shotstack'

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
  persist: (input: ExportJobInput, update: { video_url: string; quality: string; duration: number }) => Promise<void>
}

export interface ExportJobResult {
  url: string
  quality: string
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
    done[key] = value
    await hooks.onStepResolved?.(key, value)
    return value
  }

  const assembled = await step('assembly', () =>
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
    }))

  const result = await step('saved', async () => {
    const quality = actualQualityFor(input.quality, assembled.outputQuality)
    await providers.persist(input, { video_url: assembled.url, quality, duration: assembled.duration })
    return { url: assembled.url, quality }
  })
  return result
}
