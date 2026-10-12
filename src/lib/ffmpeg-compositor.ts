/**
 * FFmpeg local compositor — SUTRA
 * ----------------------------------------------------------------
 * Compose le rendu final reel d'une video : clips normalises + concat,
 * voix + musique mixees, watermark, intro/outro, sous-titres brules.
 * Aucune dependance a un service cloud tiers — binaire FFmpeg embarque
 * via `ffmpeg-static` (fallback sur `ffmpeg` du PATH si absent). Encodeur
 * materiel utilise automatiquement si disponible (ex: VideoToolbox sur
 * macOS) pour une consommation CPU minimale en usage local/personnel,
 * repli logiciel (libx264) garanti partout ailleurs.
 *
 * Multi-pass volontairement simple (normalize -> concat -> overlay ->
 * audio -> mux) plutot qu'un unique filter_complex geant : chaque etape
 * est testable isolement et le debug reste tractable. Les filtres purs
 * sont dans ffmpeg-filters.ts.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildAudioArgs,
  buildNormalizeFilter,
  buildSubtitlesFilter,
  buildWatermarkOverlayFilter,
  buildWatermarkTextFilter,
  generateSRT,
  getResolution,
  type SubtitleEntry,
} from './ffmpeg-filters.ts'
import {
  FfmpegCompositorError,
  downloadToFile,
  outputReady,
  resolveFfmpegBinary,
  runFfmpeg,
} from './ffmpeg-io.ts'
import { detectVideoEncoder } from './ffmpeg-encoder.ts'
import { acquireFfmpegSlot } from './ffmpeg-concurrency.ts'
import { compositionPlan, type CompositionRequirements, type MediaLineage } from './composition-contract.ts'
import { compositionHash, mediaValidation, withMediaFile, type SourceMeasurement, type MediaValidation } from './media-validation.ts'
import { probeMedia } from './media-inspection.ts'

export type { SubtitleEntry }
export { FfmpegCompositorError, isValidationError, isCancelledError } from './ffmpeg-io.ts'
export {
  buildWatermarkOverlayFilter,
  buildWatermarkTextFilter,
  buildSubtitlesFilter,
} from './ffmpeg-filters.ts'

export interface ComposeClip {
  url: string
  kind?: 'video' | 'photo'
  lineage?: MediaLineage
  /** Duree ciblee en secondes. Defaut 5s si absent (coherent avec l'ancien defaut Shotstack). */
  durationSeconds?: number
}

export interface ComposeVideoParams {
  clips: ComposeClip[]
  requirements?: CompositionRequirements
  voiceUrl?: string | null
  musicUrl?: string | null
  /** 0..1, defaut 0.25 — la voix reste toujours prioritaire. */
  voiceVolume?: number
  musicVolume?: number
  subtitles?: SubtitleEntry[]
  transitions?: 'fade' | 'none'
  format: '16:9' | '9:16' | '1:1'
  quality: '720p' | '1080p' | '4k'
  /** URL d'une image (PNG/JPG avec alpha ideal) utilisee comme watermark. */
  watermarkUrl?: string | null
  /** Watermark texte de secours si aucune image de marque n'est configuree. */
  watermarkText?: string | null
  introUrl?: string | null
  outroUrl?: string | null
  /** Duree des clips intro/outro en secondes. Defaut 3s (convention Shotstack existante). */
  introOutroDurationSeconds?: number
  /** Budget temps total de l'operation. Defaut 170s (marge sous maxDuration=180 des routes). */
  timeoutMs?: number
  /** Plafond duree totale — defaut par qualite (voir MAX_DURATION_BY_QUALITY). */
  maxDurationSeconds?: number
  /**
   * Identifiant stable (ex. videoId) activant la reprise mid-render : le
   * dossier temporaire devient deterministe et n'est PAS supprime en cas
   * d'echec, pour qu'une tentative suivante avec le meme jobId saute les
   * telechargements/passes ffmpeg deja reussis au lieu de tout refaire. Sans
   * jobId (mkdtemp aleatoire), comportement historique inchange.
   */
  jobId?: string
  /** Annulation cooperative demandee par l'utilisateur (voir video-cancel-registry.ts). */
  signal?: AbortSignal
}

export interface ComposeVideoResult {
  buffer: Buffer
  durationSeconds: number
  resolution: string
  validation?: MediaValidation
}

const DEFAULT_MUSIC_VOLUME = 0.25
const DEFAULT_TIMEOUT_MS = 170_000

// Plafond de securite : au-dela, le cout CPU/RAM (et le risque de depasser
// maxDuration des routes Next.js) devient deraisonnable pour ce pipeline
// synchrone. Rejet immediat et clair plutot qu'un timeout/OOM profond dans
// le pipeline apres avoir deja telecharge tous les assets.
const MAX_DURATION_BY_QUALITY: Record<string, number> = {
  '4k': 180, // 3 min — cout CPU/RAM le plus eleve
  '1080p': 600, // 10 min
  '720p': 1500, // 25 min
}

/** Caracteres surs pour un nom de dossier tmp — jobId vient de la DB (UUID), defensif. */
function sanitizeJobId(jobId: string): string {
  return jobId.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export async function composeVideo(params: ComposeVideoParams): Promise<ComposeVideoResult> {
  const plan = compositionPlan(params)
  const {
    clips,
    voiceUrl,
    musicUrl,
    musicVolume = DEFAULT_MUSIC_VOLUME,
    subtitles = [],
    transitions = 'fade',
    format,
    quality,
    watermarkUrl,
    watermarkText,
    introUrl,
    outroUrl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    jobId,
    signal,
  } = params

  if (clips.length === 0) {
    throw new FfmpegCompositorError('Aucun clip a assembler', 'validation')
  }
  if (clips.some((c) => c.durationSeconds !== undefined && c.durationSeconds <= 0)) {
    throw new FfmpegCompositorError('Un clip a une duree nulle ou negative', 'validation')
  }

  const estimatedDuration = plan.total
  const maxDuration = params.maxDurationSeconds ?? MAX_DURATION_BY_QUALITY[quality] ?? MAX_DURATION_BY_QUALITY['1080p']
  if (estimatedDuration > maxDuration) {
    throw new FfmpegCompositorError(
      `Duree totale demandee (${estimatedDuration}s) superieure au plafond ${quality} (${maxDuration}s) — reduisez la duree ou la qualite`,
      'validation'
    )
  }

  const resolution = getResolution(format, quality)
  const [width, height] = resolution.split('x').map(Number)
  const ffmpegBin = resolveFfmpegBinary()
  const encoder = await detectVideoEncoder(ffmpegBin)
  const deadline = Date.now() + timeoutMs



  // `release` est acquis AVANT le premier `try` : si mkdtemp() echoue (disque
  // plein, permissions) entre l'acquisition du slot et l'entree du bloc
  // protege, un `finally` qui ne commencerait qu'apres ne serait jamais
  // atteint — le slot de concurrence resterait perdu pour toujours (fuite
  // qui finit par bloquer tous les jobs futurs). D'ou ce `finally` englobant
  // separe, garanti d'etre execute quelle que soit l'etape qui echoue.
  const release = await acquireFfmpegSlot()
  try {
    // jobId stable -> dossier deterministe conserve en cas d'echec (reprise
    // mid-render au prochain retry). Sans jobId, comportement historique :
    // dossier aleatoire mkdtemp, toujours nettoye (ancien test/appelant ad-hoc).
    const resumable = Boolean(jobId)
    const tmpDir = resumable
      ? join(tmpdir(), `sutra-compose-${sanitizeJobId(jobId as string)}-${compositionHash(params).slice(0, 16)}`)
      : await mkdtemp(join(tmpdir(), 'sutra-compose-'))
    if (resumable) await mkdir(tmpDir, { recursive: true })
    const remainingMs = () => Math.max(1, deadline - Date.now())

    const checkAbort = (step: string) => {
      if (signal?.aborted) {
        throw new FfmpegCompositorError(`Composition annulee avant l'etape "${step}"`, 'cancelled')
      }
    }

    // Saute une etape deja terminee avec succes lors d'une tentative
    // precedente sur le meme jobId (son fichier de sortie existe deja et est
    // non vide) — c'est le coeur de la reprise mid-render.
    const ensure = async (outputPath: string, step: string, build: () => Promise<void>): Promise<void> => {
      checkAbort(step)
      if (outputReady(outputPath) && outputReady(`${outputPath}.complete`)) return
      await build()
      await writeFile(`${outputPath}.complete`, 'complete')
    }

    let succeeded = false
    try {
      type Segment = { path: string; durationSeconds: number }
      const segments: Segment[] = []
      const sources: SourceMeasurement[] = []

      if (introUrl) {
        const introPath = join(tmpDir, 'src-intro.mp4')
        await ensure(introPath, 'download-intro', () => downloadToFile(introUrl, introPath, 'download-intro', signal))
        await probeMedia(introPath, { timeoutMs: remainingMs(), signal })
        segments.push({ path: introPath, durationSeconds: plan.intro })
      }

      for (let i = 0; i < clips.length; i++) {
        const clipPath = join(tmpDir, `src-clip-${i}.mp4`)
        await ensure(clipPath, `download-clip-${i}`, () => downloadToFile(clips[i].url, clipPath, `download-clip-${i}`, signal))
        const source = await probeMedia(clipPath, { timeoutMs: remainingMs(), signal })
        if (!source.video) throw new FfmpegCompositorError('Clip sans image', 'validation')
        const lineage = clips[i].lineage
        const measure = (url: string) => withMediaFile(url, p => probeMedia(p, { timeoutMs: remainingMs(), signal }), signal)
        sources.push({ source, native: lineage?.nativeUrl ? await measure(lineage.nativeUrl) : null,
          enhanced: lineage?.enhancedUrl ? await measure(lineage.enhancedUrl) : null, generation: lineage?.generation ?? null })
        segments.push({ path: clipPath, durationSeconds: plan.durations[i] })
      }

      if (outroUrl) {
        const outroPath = join(tmpDir, 'src-outro.mp4')
        await ensure(outroPath, 'download-outro', () => downloadToFile(outroUrl, outroPath, 'download-outro', signal))
        await probeMedia(outroPath, { timeoutMs: remainingMs(), signal })
        segments.push({ path: outroPath, durationSeconds: plan.outro })
      }

      let watermarkPath: string | null = null
      if (watermarkUrl) {
        watermarkPath = join(tmpDir, 'watermark.png')
        await ensure(watermarkPath, 'download-watermark', () => downloadToFile(watermarkUrl, watermarkPath as string, 'download-watermark', signal))
      }

      let voicePath: string | null = null
      if (voiceUrl) {
        voicePath = join(tmpDir, 'voice.src')
        await ensure(voicePath, 'download-voice', () => downloadToFile(voiceUrl, voicePath as string, 'download-voice', signal))
        const voice = await probeMedia(voicePath, { timeoutMs: remainingMs(), signal })
        if (!voice.audio.length || !Number.isFinite(voice.duration) || voice.duration > plan.body + 0.12) throw new FfmpegCompositorError('Voix absente ou plus longue que le corps du montage', 'validation')
      }

      let musicPath: string | null = null
      if (musicUrl) {
        musicPath = join(tmpDir, 'music.src')
        await ensure(musicPath, 'download-music', () => downloadToFile(musicUrl, musicPath as string, 'download-music', signal))
        const music = await probeMedia(musicPath, { timeoutMs: remainingMs(), signal })
        if (!music.audio.length || !(music.duration > 0)) throw new FfmpegCompositorError('Musique sans audio decodable', 'validation')
      }

      const totalDurationSeconds = segments.reduce((sum, s) => sum + s.durationSeconds, 0)

      // Pass 1 — normalize chaque segment (meme resolution/fps/codec)
      const normPaths: string[] = []
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const normPath = join(tmpDir, `norm-${i}.mp4`)
        await ensure(normPath, `normalize-${i}`, () => {
          const filter = buildNormalizeFilter(width, height, seg.durationSeconds, transitions)
          return runFfmpeg(
            ['-stream_loop', '-1', '-i', seg.path, '-t', String(seg.durationSeconds), '-vf', filter, '-an',
              ...encoder.args(quality), '-pix_fmt', 'yuv420p', normPath],
            remainingMs(),
            `normalize-${i}`,
            signal
          )
        })
        normPaths.push(normPath)
      }

      // Pass 2 — concat (stream copy, codecs deja identiques)
      const concatVideoPath = join(tmpDir, 'concat-video.mp4')
      await ensure(concatVideoPath, 'concat', async () => {
        const concatListPath = join(tmpDir, 'concat.txt')
        await writeFile(concatListPath, normPaths.map((p) => `file '${p}'`).join('\n'))
        await runFfmpeg(
          ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', concatVideoPath],
          remainingMs(),
          'concat',
          signal
        )
      })

      // Pass 3 — sous-titres + watermark (une seule passe de reencodage)
      let visualPath = concatVideoPath
      const hasSubtitles = subtitles.length > 0
      const hasWatermarkImage = Boolean(watermarkPath)
      const hasWatermarkText = !hasWatermarkImage && Boolean(watermarkText)

      if (hasSubtitles || hasWatermarkImage || hasWatermarkText) {
        visualPath = join(tmpDir, 'visual.mp4')
        await ensure(visualPath, 'overlay', async () => {
          const args: string[] = ['-i', concatVideoPath]
          if (hasWatermarkImage) args.push('-i', watermarkPath as string)

          const overlayChain: string[] = []
          let currentLabel = '[0:v]'

          if (hasSubtitles) {
            const srtPath = join(tmpDir, 'subtitles.srt')
            await writeFile(srtPath, generateSRT(plan.subtitles))
            overlayChain.push(`${currentLabel}${buildSubtitlesFilter(srtPath, width, height)}[sub]`)
            currentLabel = '[sub]'
          }

          if (hasWatermarkImage) {
            overlayChain.push(buildWatermarkOverlayFilter(currentLabel, width))
            currentLabel = '[outv]'
          } else if (hasWatermarkText) {
            const textPath = join(tmpDir, 'watermark.txt')
            await writeFile(textPath, watermarkText as string)
            overlayChain.push(`${currentLabel}${buildWatermarkTextFilter(watermarkText as string, 24, textPath)}[outv]`)
            currentLabel = '[outv]'
          }

          args.push('-filter_complex', overlayChain.join(';'), '-map', currentLabel)
          args.push(...encoder.args(quality), '-pix_fmt', 'yuv420p', visualPath)
          await runFfmpeg(args, remainingMs(), 'overlay', signal)
        })
      }

      // Pass 4 — audio (voix + musique mixees, ou silence)
      const audioPath = join(tmpDir, 'audio.m4a')
      await ensure(audioPath, 'audio', () => {
        const audioArgs = buildAudioArgs({ voicePath, musicPath, voiceVolume: params.voiceVolume, musicVolume, totalDurationSeconds, outputPath: audioPath,
          voiceOffsetSeconds: plan.intro, bodyDurationSeconds: plan.body })
        return runFfmpeg(audioArgs, remainingMs(), 'audio', signal)
      })

      // Pass 5 — mux final (stream copy)
      const finalPath = join(tmpDir, 'final.mp4')
      await ensure(finalPath, 'mux', () =>
        runFfmpeg(
          ['-i', visualPath, '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0',
            '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', finalPath],
          remainingMs(),
          'mux',
          signal
        )
      )

      const validation = mediaValidation(params, await probeMedia(finalPath, { timeoutMs: remainingMs(), signal }), sources)
      const buffer = await readFile(finalPath)
      succeeded = true
      return { buffer, durationSeconds: validation.final.duration, resolution, validation }
    } finally {
      // Dossier ephemere (pas de jobId) : toujours nettoye, comme avant.
      // Dossier resumable (jobId) : conserve UNIQUEMENT en cas d'echec, pour
      // qu'un retry avec le meme jobId reprenne la ou ca s'est arrete.
      if (!resumable || succeeded) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      }
    }
  } finally {
    release()
  }
}
