import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { resolveFfmpegBinary, FfmpegCompositorError } from './ffmpeg-io.ts'

export interface MediaProbe {
  sha256: string
  bytes: number
  duration: number
  bitrate: number
  video: null | { width: number; height: number; orientation: 'landscape' | 'portrait' | 'square';
    fps: number; nominalFps: number; codec: string; pixelFormat: string; sar: string; rotation: number;
    bitrate: number; start: number; duration: number; frames: number }
  audio: Array<{ codec: string; channels: number; sampleRate: number; bitrate: number; start: number; duration: number }>
  subtitleStreams: number
  fullDecode: true
}

/** Local files only: callers own the bounded download (and its URL security policy). */
export async function mediaCommand(binary: string, args: string[], timeoutMs = 60_000, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new FfmpegCompositorError('Validation media annulee', 'cancelled')
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', failure = ''
    const abort = () => { failure = 'Validation media annulee'; child.kill('SIGKILL') }
    const timer = setTimeout(() => { failure = 'Validation media : delai depasse'; child.kill('SIGKILL') }, timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
      if (stdout.length > 2_000_000) { failure = 'Reponse probe trop volumineuse'; child.kill('SIGKILL') }
    })
    child.stderr.on('data', (data: Buffer) => { stderr = (stderr + data.toString()).slice(-8000) })
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    child.on('error', () => { cleanup(); reject(new FfmpegCompositorError('Binaire de validation media indisponible', 'final-validation')) })
    child.on('close', code => {
      cleanup()
      if (failure || code !== 0 || stderr.trim()) reject(new FfmpegCompositorError(failure || 'Media illisible ou corrompu (probe/decode)', signal?.aborted ? 'cancelled' : 'final-validation'))
      else resolve(stdout)
    })
  })
}

const number = (v: unknown): number => typeof v === 'number' ? v : Number(v ?? 0)
const ratio = (v: string): number => { const [a, b] = v.split('/').map(Number); return b ? a / b : 0 }

export async function probeMedia(path: string, options: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<MediaProbe> {
  if (!path.startsWith('/')) throw new FfmpegCompositorError('Probe exige un fichier local absolu', 'validation')
  const deadline = Date.now() + (options.timeoutMs ?? 60_000)
  const remaining = () => Math.max(1, deadline - Date.now())
  const raw = await mediaCommand('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,mp3,wav,aac,ogg,image2,png_pipe,jpeg_pipe,webp_pipe', '-count_frames', '-show_streams', '-show_format', '-of', 'json', path], remaining(), options.signal)
  const data = JSON.parse(raw)
  const streams = data.streams as Array<Record<string, unknown>>
  const videos = streams.filter(s => s.codec_type === 'video' && !(s.disposition as { attached_pic?: number })?.attached_pic)
  if (videos.length > 1) throw new FfmpegCompositorError('Plusieurs pistes video : rendu ambigu', 'final-validation')
  // A successful probe alone does not prove the last frame decodes. Decode EVERY A/V stream.
  await mediaCommand(resolveFfmpegBinary(), ['-nostdin', '-v', 'error', '-xerror', '-err_detect', 'explode', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,mp3,wav,aac,ogg,image2,png_pipe,jpeg_pipe,webp_pipe', '-i', path,
    '-map', '0:v?', '-map', '0:a?', '-f', 'null', '-'], remaining(), options.signal)
  const hash = createHash('sha256')
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    if (options.signal?.aborted) throw new FfmpegCompositorError('Validation media annulee', 'cancelled')
    if (Date.now() > deadline) throw new FfmpegCompositorError('Validation media : delai depasse', 'final-validation')
    hash.update(chunk); bytes += chunk.length
  }
  const v = videos[0]
  const duration = number(data.format?.duration)
  const width = number(v?.width), height = number(v?.height)
  const rotation = v ? number((v.side_data_list as Array<{ rotation?: number }>)?.find(s => s.rotation !== undefined)?.rotation ?? (v.tags as { rotate?: string })?.rotate) : 0
  return { sha256: hash.digest('hex'), bytes, duration, bitrate: number(data.format?.bit_rate),
    video: v ? { width, height, orientation: width === height ? 'square' : width > height ? 'landscape' : 'portrait',
      fps: ratio(String(v.avg_frame_rate)), nominalFps: ratio(String(v.r_frame_rate)), codec: String(v.codec_name),
      pixelFormat: String(v.pix_fmt), sar: String(v.sample_aspect_ratio), rotation,
      bitrate: number(v.bit_rate), start: number(v.start_time), duration: number(v.duration) || duration, frames: number(v.nb_read_frames) } : null,
    audio: streams.filter(s => s.codec_type === 'audio').map(s => ({ codec: String(s.codec_name), channels: number(s.channels),
      sampleRate: number(s.sample_rate), bitrate: number(s.bit_rate), start: number(s.start_time), duration: number(s.duration) || duration })),
    subtitleStreams: streams.filter(s => s.codec_type === 'subtitle').length, fullDecode: true }
}
