/**
 * Limiteur de concurrence en process pour les jobs de composition FFmpeg.
 *
 * Chaque composeVideo() lance 5 process ffmpeg sequentiels ; le risque n'est
 * pas interne a un job mais ENTRE jobs : plusieurs requetes simultanees sur
 * la meme instance (VPS/worker, ou meme un Mac personnel) sature le CPU si
 * rien ne les met en file. Volontairement en memoire du process (pas Redis)
 * : le vrai cas d'usage est une seule instance VPS/serverless/machine
 * perso a la fois, pas une coordination distribuee — inutile d'ajouter une
 * dependance externe pour ca.
 *
 * Defaut : nombre de coeurs - 1 (garde un coeur libre pour le reste de
 * l'app), minimum 1. Surchageable via FFMPEG_MAX_CONCURRENT_JOBS pour
 * s'adapter a une machine personnelle modeste ou a un VPS plus large.
 */
import { cpus } from 'node:os'
import { FfmpegCompositorError } from './ffmpeg-io.ts'

function resolveMaxConcurrency(): number {
  const fromEnv = Number(process.env.FFMPEG_MAX_CONCURRENT_JOBS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.max(1, Math.floor(fromEnv))
  return Math.max(1, cpus().length - 1)
}

let active = 0
const waiters: Array<() => void> = []

/** Attend un slot libre puis le reserve ; retourne la fonction a appeler pour le liberer. */
export async function acquireFfmpegSlot(signal?: AbortSignal): Promise<() => void> {
  const cancelled = () => new FfmpegCompositorError('Attente composition annulee ou delai depasse', 'cancelled')
  if (signal?.aborted) throw cancelled()
  const max = resolveMaxConcurrency()
  if (active >= max || waiters.length) {
    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener('abort', abort)
        // Reserve synchronously before waking the caller: a newcomer cannot steal it.
        active++
        resolve()
      }
      const abort = () => {
        const index = waiters.indexOf(grant)
        if (index !== -1) waiters.splice(index, 1)
        signal?.removeEventListener('abort', abort)
        reject(cancelled())
      }
      waiters.push(grant)
      signal?.addEventListener('abort', abort, { once: true })
    })
  } else {
    active++
  }
  let released = false
  return () => {
    if (released) return
    released = true
    active--
    const next = waiters.shift()
    if (next) next()
  }
}

/** Pour observabilite/tests uniquement. */
export function getFfmpegConcurrencyState(): { active: number; waiting: number; max: number } {
  return { active, waiting: waiters.length, max: resolveMaxConcurrency() }
}
