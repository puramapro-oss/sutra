import { submitVideoJob, pollVideoJob } from '@/lib/runpod'

// ---------------------------------------------------------------------------
// WAN 2.2 — Moteur vidéo fallback pour SUTRA (V7.1).
// Tourne via RunPod (serverless pour payants, pod dédié pour super admin).
//
// Rôle dans la chaîne :
//   - Moteur PRIMAIRE pour le plan free (pas de LTX payant)
//   - FALLBACK automatique si LTX échoue (circuit breaker côté ltx.ts)
//
// Cette lib isole toute la logique WAN/RunPod pour :
//   - rendre ltx.ts plus léger (pas de dynamic import)
//   - faciliter les tests (mock RunPod sans toucher LTX)
//   - exposer une API unifiée { success, videoBuffer, model, duration, resolution }
// ---------------------------------------------------------------------------

export type WanQuality = '720p' | '1080p' | '4k'
export type WanFormat = '9:16' | '16:9' | '1:1'

export type WanResult = {
  videoBuffer: ArrayBuffer
  model: 'wan-2.2'
  duration: number
  resolution: string
  width: number
  height: number
}

const DIMS: Record<WanQuality, { width: number; height: number }> = {
  '720p': { width: 768, height: 512 },
  '1080p': { width: 1024, height: 576 },
  '4k': { width: 1280, height: 720 },
}

const POLL_TIMEOUT_MS = 300_000 // 5 min

/**
 * Génère une vidéo WAN 2.2 via RunPod (polling async → videoBuffer).
 *
 * @param prompt      Description de la scène
 * @param userEmail   Pour router vers pod dédié si super admin
 * @param opts.quality    '720p' (défaut) | '1080p' | '4k'
 * @param opts.duration   Secondes (défaut 5) → num_frames = duration × 16 fps
 * @param opts.format     Ratio (future : adjust dims selon format) — unused for now
 *
 * @throws Error si RunPod timeout (>5 min) ou réponse invalide.
 */
export async function generateWanVideo(params: {
  prompt: string
  userEmail: string | null
  quality?: WanQuality
  duration?: number
  format?: WanFormat
}): Promise<WanResult> {
  const { prompt, userEmail, quality = '720p', duration = 5 } = params
  const { width, height } = DIMS[quality] ?? DIMS['720p']

  const { jobId, baseUrl } = await submitVideoJob(
    {
      prompt,
      width,
      height,
      num_frames: Math.round(duration * 16),
    },
    userEmail,
  )

  const videoUrl = await pollVideoJob(jobId, baseUrl, POLL_TIMEOUT_MS)

  // pollVideoJob renvoie soit une URL HTTP (S3), soit un data URL base64.
  const res = await fetch(videoUrl)
  if (!res.ok) {
    throw new Error(`WAN fetch failed: HTTP ${res.status}`)
  }
  const videoBuffer = await res.arrayBuffer()

  return {
    videoBuffer,
    model: 'wan-2.2',
    duration,
    resolution: `${width}x${height}`,
    width,
    height,
  }
}
