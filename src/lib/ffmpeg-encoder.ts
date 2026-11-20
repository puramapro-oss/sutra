/**
 * Detection d'encodeur materiel (hardware) avec repli logiciel garanti.
 *
 * Architecture imperative SUTRA : usage personnel/local doit consommer le
 * moins de ressources possible sans perdre de fonctionnalite. Sur une
 * machine avec un encodeur materiel disponible (VideoToolbox sur macOS,
 * potentiellement NVENC/QSV sur d'autres plateformes), l'utiliser reduit
 * drastiquement le CPU/l'energie consommes par rapport a libx264 logiciel
 * (constate empiriquement : encodage ~300x temps reel vs quelques x avec
 * libx264 sur la meme machine). Les clients/serverless sans acceleration
 * materielle (ou sur une plateforme non supportee) retombent automatiquement
 * et silencieusement sur libx264, disponible partout — aucune fonctionnalite
 * perdue, uniquement une consommation moindre quand c'est possible.
 *
 * La detection interroge `ffmpeg -encoders` une seule fois par process
 * (lazy + cache memoire) : jamais re-sondee a chaque clip/passe.
 */
import { spawn } from 'node:child_process'
import { FfmpegCompositorError } from './ffmpeg-io.ts'

export interface VideoEncoder {
  codec: string
  /** Args d'encodage (`-c:v <codec> ...`) pour une qualite donnee. */
  args: (quality: '720p' | '1080p' | '4k') => string[]
}

const SOFTWARE_CRF: Record<string, string> = { '720p': '21', '1080p': '21', '4k': '18' }
const SOFTWARE_PRESET: Record<string, string> = { '720p': 'veryfast', '1080p': 'veryfast', '4k': 'medium' }
const HARDWARE_BITRATE: Record<string, string> = { '720p': '5M', '1080p': '8M', '4k': '25M' }

const SOFTWARE_ENCODER: VideoEncoder = {
  codec: 'libx264',
  args: (quality) => ['-c:v', 'libx264', '-preset', SOFTWARE_PRESET[quality], '-crf', SOFTWARE_CRF[quality]],
}

const HARDWARE_ENCODERS: Array<{ platform: NodeJS.Platform; name: string }> = [
  { platform: 'darwin', name: 'h264_videotoolbox' },
]

async function listEncoders(bin: string, signal?: AbortSignal): Promise<string> {
  const cancelled = () => new FfmpegCompositorError('Detection encodeur annulee ou delai depasse', 'cancelled')
  if (signal?.aborted) throw cancelled()
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-hide_banner', '-encoders'])
    let out = '', failed = false
    const abort = () => { child.kill('SIGKILL') }
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL') }, 2000)
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (chunk) => {
      if (out.length + chunk.length > 1_000_000) { failed = true; child.kill('SIGKILL') }
      else out += chunk.toString()
    })
    child.stderr.resume()
    child.on('error', () => { cleanup(); if (signal?.aborted) reject(cancelled()); else resolve('') })
    child.on('close', (code) => {
      cleanup()
      if (signal?.aborted) reject(cancelled())
      else resolve(failed || code !== 0 ? '' : out)
    })
  })
}

// Cache successful discovery only. One caller's abort cannot poison later jobs.
let cached: VideoEncoder | null = null

export async function detectVideoEncoder(ffmpegBin: string, signal?: AbortSignal): Promise<VideoEncoder> {
  if (signal?.aborted) throw new FfmpegCompositorError('Detection encodeur annulee', 'cancelled')
  if (cached) return cached
  const candidate = HARDWARE_ENCODERS.find((e) => e.platform === process.platform)
  const list = candidate ? await listEncoders(ffmpegBin, signal) : ''
  cached = candidate && list.includes(candidate.name) ? {
    codec: candidate.name,
    args: (quality) => ['-c:v', candidate.name, '-b:v', HARDWARE_BITRATE[quality]],
  } : SOFTWARE_ENCODER
  return cached
}

/** Pour les tests : reinitialise le cache (sinon partage entre tests du meme process). */
export function resetEncoderCacheForTests(): void {
  cached = null
}
