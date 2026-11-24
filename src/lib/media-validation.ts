import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { compositionPlan, type CompositionContract, type MediaLineage } from './composition-contract.ts'
import { downloadToFile, FfmpegCompositorError } from './ffmpeg-io.ts'
import { probeMedia, type MediaProbe } from './media-inspection.ts'

export interface SourceMeasurement {
  source: MediaProbe
  native: MediaProbe | null
  enhanced: MediaProbe | null
  generation: MediaLineage['generation'] | null
}
export interface MediaValidation {
  version: 1
  contractHash: string
  sources: SourceMeasurement[]
  requested: { width: number; height: number; fps: number; duration: number }
  final: MediaProbe
  resolutionOrigin: 'upscaled' | 'native-4k-attested' | '4k-origin-unknown' | 'source-sized-or-downscaled'
  subtitles: { mode: 'burned-in' | 'none'; cues: Array<{ text: string; start: number; end: number }>; verification: 'render-contract' }
}

export function compositionHash(contract: CompositionContract): string {
  // Explicit order; excludes job ID, transient cancellation and timeout options.
  return createHash('sha256').update(JSON.stringify({ clips: contract.clips.map(c => ({ url: c.url, duration: c.durationSeconds ?? 5, kind: c.kind ?? null, lineage: c.lineage ?? null })),
    voice: contract.voiceUrl || null, ...((contract.voiceVolume ?? 1) === 1 ? {} : { voiceVolume: contract.voiceVolume }), music: contract.musicUrl || null, volume: contract.musicVolume ?? 0.25,
    intro: contract.introUrl || null, outro: contract.outroUrl || null, logo: contract.watermarkUrl || null,
    text: contract.watermarkText || null, transitions: contract.transitions ?? 'fade', requirements: contract.requirements ?? {}, plan: compositionPlan(contract) })).digest('hex')
}

export function assertFinalMedia(media: MediaProbe, contract: CompositionContract): void {
  const plan = compositionPlan(contract)
  const fail = (reason: string): never => { throw new FfmpegCompositorError(`Rendu final refuse : ${reason}`, 'final-validation') }
  const v = media.video
  if (!media.fullDecode || !v || media.bytes <= 0) fail('video absente ou decodage incomplet')
  if (!v) return
  if (v.width !== plan.width || v.height !== plan.height || v.rotation !== 0) fail('dimensions/orientation differentes de la demande')
  if (v.sar !== '1:1') fail('pixels non carres')
  if (![v.fps, v.nominalFps].every(fps => Number.isFinite(fps) && Math.abs(fps - plan.fps) < 0.01)) fail('FPS non conformes')
  if (v.codec !== 'h264' || v.pixelFormat !== 'yuv420p') fail('codec/pixels incompatibles avec export MP4 H.264')
  if (!Number.isFinite(media.bitrate) || media.bitrate <= 0 || !Number.isFinite(v.bitrate) || v.bitrate <= 0) fail('bitrate absent ou invalide')
  // One frame rounding per segment is already normalized by compositionPlan.
  if (![media.duration, v.duration, v.start].every(Number.isFinite) || Math.abs(media.duration - plan.total) > 0.12 || Math.abs(v.duration - plan.total) > 0.1 ||
      !Number.isFinite(v.frames) || Math.abs(v.frames - Math.round(plan.total * 30)) > 1) fail('duree ou nombre images non conforme')
  if (Math.abs(v.start) > 1 / 30) fail('horloge video decalee')
  if (plan.audioRequired && media.audio.length !== 1) fail('audio requis absent ou pistes ambigues')
  if (media.audio.length > 1) fail('plusieurs pistes audio')
  for (const a of media.audio) {
    if (a.codec !== 'aac' || a.channels < 1 || a.channels > 2 || ![44100, 48000].includes(a.sampleRate) || !(a.bitrate > 0)) fail('audio incompatible')
    if (![a.start, a.duration].every(Number.isFinite) || Math.abs(a.start - v.start) > 0.08 || Math.abs(a.start + a.duration - v.start - v.duration) > 0.12) fail('desynchronisation audio/video')
  }
  if (media.subtitleStreams !== 0) fail('sous-titres attendus incrustes, piste externe inattendue')
}

export function mediaValidation(contract: CompositionContract, final: MediaProbe, sources: SourceMeasurement[]): MediaValidation {
  assertFinalMedia(final, contract)
  const plan = compositionPlan(contract)
  const measuredImage = (media: MediaProbe | null) => media?.fullDecode === true && media.bytes > 0 &&
    media.video !== null && Number.isFinite(media.video.width) && media.video.width > 0 && Number.isFinite(media.video.height) && media.video.height > 0
  if (sources.length !== contract.clips.length || sources.some((s, index) => !measuredImage(s.source) ||
      (s.native !== null && !measuredImage(s.native)) || (s.enhanced !== null && !measuredImage(s.enhanced)) ||
      (contract.clips[index].lineage?.nativeUrl && !s.native) || (contract.clips[index].lineage?.enhancedUrl && !s.enhanced))) {
    throw new FfmpegCompositorError('Preuve media incomplete : mesures source/native/amelioree absentes ou sans image', 'final-validation')
  }
  // URLs can alias identical bytes. A changed URL is never evidence of composition.
  // Preserve a legitimate single-clip export when no transformation was requested.
  const transformationRequired = contract.clips.length > 1 || plan.subtitles.length > 0 ||
    plan.audioRequired || plan.intro > 0 || plan.outro > 0 ||
    Boolean(contract.watermarkUrl?.trim() || contract.watermarkText?.trim())
  if (transformationRequired && sources.some(s => [s.source, s.native, s.enhanced]
    .some(raw => raw !== null && raw.sha256 === final.sha256))) {
    throw new FfmpegCompositorError('Video brute inchangee : transformation demandee non prouvee', 'final-validation')
  }
  const size = (m: MediaProbe | null) => m?.video ? Math.min(m.video.width, m.video.height) : 0
  const target = Math.min(plan.width, plan.height)
  const upscaled = sources.some(s => size(s.source) < target || (s.native !== null && size(s.native) < target) || s.generation?.kind === 'upscaled')
  const native4k = sources.length === contract.clips.length && sources.every(s => size(s.native) >= 2160 && s.generation?.kind === 'native' && Boolean(s.generation.evidence.trim()))
  return { version: 1, contractHash: compositionHash(contract), sources, final,
    requested: { width: plan.width, height: plan.height, fps: plan.fps, duration: plan.total },
    resolutionOrigin: upscaled ? 'upscaled' : target >= 2160 ? native4k ? 'native-4k-attested' : '4k-origin-unknown' : 'source-sized-or-downscaled',
    // ffprobe cannot OCR burned text. Timeline validation and synthetic pixel tests are distinct proof levels.
    subtitles: { mode: plan.subtitles.length ? 'burned-in' : 'none', cues: plan.subtitles, verification: 'render-contract' } }
}

export async function withMediaFile<T>(url: string, consume: (path: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'sutra-t05-probe-'))
  try {
    const path = join(dir, 'media')
    await downloadToFile(url, path, 'media-probe-download', signal)
    return await consume(path)
  } finally { await rm(dir, { recursive: true, force: true }) }
}

export async function measureSources(contract: CompositionContract, signal?: AbortSignal): Promise<SourceMeasurement[]> {
  const sources: SourceMeasurement[] = []
  const cache = new Map<string, MediaProbe>()
  const measure = async (url: string) => {
    if (!cache.has(url)) cache.set(url, await withMediaFile(url, path => probeMedia(path, { signal }), signal))
    return cache.get(url)!
  }
  for (const clip of contract.clips) {
    const source = await measure(clip.url)
    if (!source.video) throw new FfmpegCompositorError('Source sans image', 'validation')
    sources.push({ source, native: clip.lineage?.nativeUrl ? await measure(clip.lineage.nativeUrl) : null,
      enhanced: clip.lineage?.enhancedUrl ? await measure(clip.lineage.enhancedUrl) : null, generation: clip.lineage?.generation ?? null })
  }
  return sources
}

/** Used for remote render completion AND old resume checkpoints, before publishing a URL. */
export async function validateRenderedMedia(url: string, contract: CompositionContract, signal?: AbortSignal): Promise<MediaValidation> {
  compositionPlan(contract)
  if (contract.clips.some(c => c.url === url)) throw new FfmpegCompositorError('Video brute refusee comme rendu final', 'final-validation')
  const sources = await measureSources(contract, signal)
  await measureCompositionAudio(contract, signal)
  return withMediaFile(url, async path => mediaValidation(contract, await probeMedia(path, { signal }), sources), signal)
}

export async function measureCompositionAudio(contract: CompositionContract, signal?: AbortSignal) {
  const plan = compositionPlan(contract)
  let voice: MediaProbe | null = null, music: MediaProbe | null = null
  if (contract.voiceUrl) {
    voice = await withMediaFile(contract.voiceUrl, p => probeMedia(p, { signal }), signal)
    if (!voice.audio.length || !(voice.duration > 0) || voice.duration > plan.body + 0.12) throw new FfmpegCompositorError('Voix absente ou plus longue que le corps du montage', 'validation')
  }
  if (contract.musicUrl) {
    music = await withMediaFile(contract.musicUrl, p => probeMedia(p, { signal }), signal)
    if (!music.audio.length || !(music.duration > 0)) throw new FfmpegCompositorError('Musique sans audio decodable', 'validation')
  }
  return { voice, music }
}

export async function validateRenderedBuffer(buffer: Buffer, contract: CompositionContract, sources: SourceMeasurement[] = [], signal?: AbortSignal): Promise<MediaValidation> {
  compositionPlan(contract)
  const dir = await mkdtemp(join(tmpdir(), 'sutra-t05-validate-'))
  try {
    const path = join(dir, 'final.mp4')
    await writeFile(path, buffer)
    const final = await probeMedia(path, { signal })
    const measured = sources.length ? sources : await measureSources(contract, signal)
    await measureCompositionAudio(contract, signal)
    return mediaValidation(contract, final, measured)
  } finally { await rm(dir, { recursive: true, force: true }) }
}
