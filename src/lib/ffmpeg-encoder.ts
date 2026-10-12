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

async function listEncoders(bin: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(bin, ['-hide_banner', '-encoders'])
    let out = ''
    child.stdout.on('data', (c) => (out += c.toString()))
    child.on('error', () => resolve(''))
    child.on('close', () => resolve(out))
  })
}

let cached: Promise<VideoEncoder> | null = null

/** Resultat mis en cache pour tout le process — un seul sondage ffmpeg. */
export function detectVideoEncoder(ffmpegBin: string): Promise<VideoEncoder> {
  if (!cached) {
    cached = (async () => {
      const candidate = HARDWARE_ENCODERS.find((e) => e.platform === process.platform)
      if (!candidate) return SOFTWARE_ENCODER
      try {
        const list = await listEncoders(ffmpegBin)
        if (!list.includes(candidate.name)) return SOFTWARE_ENCODER
        return {
          codec: candidate.name,
          args: (quality) => ['-c:v', candidate.name, '-b:v', HARDWARE_BITRATE[quality]],
        }
      } catch {
        return SOFTWARE_ENCODER
      }
    })()
  }
  return cached
}

/** Pour les tests : reinitialise le cache (sinon partage entre tests du meme process). */
export function resetEncoderCacheForTests(): void {
  cached = null
}
