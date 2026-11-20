/**
 * Primitives IO bas niveau pour le compositeur FFmpeg : spawn du process
 * avec timeout/erreur typee, telechargement d'assets. Separees de
 * ffmpeg-compositor.ts pour rester sous la limite de 300 lignes/fichier.
 */
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { downloadMediaBytes } from './media-download'

export class FfmpegCompositorError extends Error {
  readonly step: string
  constructor(message: string, step: string) {
    super(message)
    this.name = 'FfmpegCompositorError'
    this.step = step
  }
}

/**
 * Une erreur `step === 'validation'` est deterministe (clip vide, duree
 * nulle/negative, duree totale au-dela du plafond de la qualite demandee) :
 * elle echouerait de la meme facon sur n'importe quel moteur de composition.
 * Utilise par video-compositor.ts pour eviter de declencher un appel API
 * payant (Shotstack) en secours d'un input qui ne peut jamais aboutir.
 */
export function isValidationError(err: unknown): boolean {
  return err instanceof FfmpegCompositorError && (err.step === 'validation' || err.step === 'final-validation' || err.step.includes('download'))
}

/**
 * Une erreur `step === 'cancelled'` vient d'une annulation explicite demandee
 * par l'utilisateur (`/api/video/[id]/cancel`), jamais d'une panne du moteur.
 * video-compositor.ts l'utilise pour ne JAMAIS declencher le secours Shotstack
 * (appel API payant) sur une annulation volontaire.
 */
export function isCancelledError(err: unknown): boolean {
  return err instanceof FfmpegCompositorError && err.step === 'cancelled'
}

/**
 * Verifie qu'une passe anterieure a deja produit un fichier de sortie non
 * vide — utilise par ffmpeg-compositor.ts pour sauter une etape (download ou
 * passe ffmpeg) deja terminee avec succes lors d'une tentative precedente sur
 * le meme `jobId` (reprise mid-render apres crash/echec partiel, plutot que
 * de tout refaire depuis zero a chaque retry).
 */
export function outputReady(path: string): boolean {
  try {
    return statSync(path).size > 0
  } catch {
    return false
  }
}

export function resolveFfmpegBinary(): string {
  return 'ffmpeg'
}

export async function runFfmpeg(args: string[], timeoutMs: number, step: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new FfmpegCompositorError(`Composition annulee avant l'etape "${step}"`, 'cancelled')
  }
  const bin = resolveFfmpegBinary()
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, ['-y', '-nostdin', '-loglevel', 'error', ...args.flatMap(arg => arg === '-i' ? ['-protocol_whitelist', 'file,pipe', '-i'] : [arg])])
    let stderr = ''
    let timedOut = false
    let cancelled = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    const onAbort = () => {
      cancelled = true
      child.kill('SIGKILL')
    }
    signal?.addEventListener('abort', onAbort)

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new FfmpegCompositorError(`ffmpeg introuvable ou non executable (${err.message})`, step))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (cancelled) {
        reject(new FfmpegCompositorError(`Composition annulee pendant l'etape "${step}"`, 'cancelled'))
        return
      }
      if (timedOut) {
        reject(new FfmpegCompositorError(`ffmpeg timeout (${timeoutMs}ms) a l'etape "${step}"`, step))
        return
      }
      if (code !== 0) {
        const tail = stderr.trim().split('\n').slice(-15).join('\n')
        reject(new FfmpegCompositorError(`ffmpeg a echoue (code ${code}) a l'etape "${step}": ${tail}`, step))
        return
      }
      resolve()
    })
  })
}

export async function downloadToFile(url: string, destPath: string, step: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new FfmpegCompositorError(`Composition annulee avant l'etape "${step}"`, 'cancelled')
  }
  try {
    const bytes = await downloadMediaBytes(url, { kind: 'media', signal })
    await writeFile(destPath, bytes)
  } catch {
    throw new FfmpegCompositorError('Telechargement media refuse ou interrompu', signal?.aborted ? 'cancelled' : step)
  }
}
