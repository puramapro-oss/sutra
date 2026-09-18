// -----------------------------------------------------------------------------
// Mode personnel LOCAL — Mac M4 Max 48 Go du propriétaire UNIQUEMENT.
//
// Objectif (audit #17) : les vidéos PERSO du propriétaire passent par un
// moteur local (ex. Draw Things / serveur d'inférence local), les CLIENTS
// restent sur les API externes — routage strict par identité.
//
// Contrat d'adaptateur (à brancher sur le serveur local choisi) :
//   POST {LOCAL_VIDEO_API_URL}
//     { prompt, width, height, num_frames, fps }
//   → 200 { video_base64 } | { video_url }
//   GET  {LOCAL_VIDEO_API_URL}/health → 200 quand le serveur est prêt.
//
// Garanties :
//   - Jamais actif pour un non-propriétaire (isSuperAdmin).
//   - LOCAL_ENGINE_MODE='strict' : échec local = ERREUR explicite, JAMAIS de
//     repli silencieux vers une API payante (pas de dépense surprise).
//   - LOCAL_ENGINE_MODE='auto' : repli externe documenté dans les logs.
//   - Aucune performance n'est revendiquée sans benchmark mesuré sur la
//     machine — ce module est un adaptateur, pas une promesse.
// -----------------------------------------------------------------------------

import { isSuperAdmin } from '@/lib/utils'
import { logVideoGeneration } from './ltx-helpers'
import { getWanDimensions } from './wan'
import type { LtxResult } from './ltx-types'
import type { Plan } from '@/types'

export type LocalEngineMode = 'strict' | 'auto'

export function isLocalEngineConfigured(): boolean {
  return (
    process.env.LOCAL_ENGINE_ENABLED === 'true' &&
    typeof process.env.LOCAL_VIDEO_API_URL === 'string' &&
    process.env.LOCAL_VIDEO_API_URL.length > 0
  )
}

export function localEngineMode(): LocalEngineMode {
  return process.env.LOCAL_ENGINE_MODE === 'auto' ? 'auto' : 'strict'
}

/** Le routage local ne concerne QUE le propriétaire — jamais un client. */
export function shouldUseLocalEngine(userEmail: string | null): boolean {
  return isLocalEngineConfigured() && Boolean(userEmail) && isSuperAdmin(userEmail)
}

interface LocalGenerateParams {
  prompt: string
  width: number
  height: number
  duration: number
  fps?: number
}

interface LocalGenerateResponse {
  video_base64?: string
  video_url?: string
}

/**
 * Appelle le serveur vidéo local. Timeout généreux (l'inférence locale est
 * lente) MAIS borné : un Mac bloqué ne doit pas geler la requête serveur.
 */
export async function generateLocalVideo(params: LocalGenerateParams): Promise<LtxResult> {
  const baseUrl = process.env.LOCAL_VIDEO_API_URL!
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      num_frames: Math.round(params.duration * (params.fps ?? 16)),
      fps: params.fps ?? 16,
    }),
    // Une passe locale longue-forme peut prendre plusieurs minutes ; borné à
    // 10 min pour rester sous le plafond d'exécution de la route.
    signal: AbortSignal.timeout(600_000),
  })

  if (!res.ok) {
    throw new Error(`Moteur local: HTTP ${res.status} ${res.statusText} — verifie que le serveur local tourne`)
  }
  const data = (await res.json()) as LocalGenerateResponse
  if (data.video_base64) {
    const buffer = Buffer.from(data.video_base64, 'base64')
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    return {
      videoBuffer: arrayBuffer,
      engine: 'wan-classic', // compat type ; la provenance 'local' est tracée
      model: 'local-m4max',
      duration: params.duration,
      resolution: `${params.width}x${params.height}`,
    }
  }
  if (data.video_url) {
    const file = await fetch(data.video_url, { signal: AbortSignal.timeout(60_000) })
    if (!file.ok) throw new Error(`Moteur local: recuperation du fichier HTTP ${file.status}`)
    return {
      videoBuffer: await file.arrayBuffer(),
      engine: 'wan-classic',
      model: 'local-m4max',
      duration: params.duration,
      resolution: `${params.width}x${params.height}`,
    }
  }
  throw new Error('Moteur local: reponse invalide (ni video_base64 ni video_url)')
}

/** Sonde de santé locale (gratuite) — utilisable par /api/admin/health. */
export async function probeLocalEngine(): Promise<{ ok: boolean; detail?: string }> {
  if (!isLocalEngineConfigured()) return { ok: false, detail: 'non configure' }
  try {
    const res = await fetch(`${process.env.LOCAL_VIDEO_API_URL!.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return { ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'erreur reseau' }
  }
}


export async function tryLocalRoute(params: {
  prompt: string
  plan: Plan
  quality: string
  format?: string
  duration?: number
  userEmail?: string | null
  userId?: string
  videoId?: string
}): Promise<LtxResult | null> {
  const userEmail = params.userEmail ?? null
  if (!shouldUseLocalEngine(userEmail)) return null

  const start = Date.now()
  const localFormat = (['9:16', '16:9', '1:1'].includes(params.format ?? '') ? params.format : '16:9') as '9:16' | '16:9' | '1:1'
  const dims = getWanDimensions((['720p', '1080p', '4k'].includes(params.quality) ? params.quality : '720p') as '720p' | '1080p' | '4k', localFormat)
  const duration = params.duration ?? 6

  try {
    const result = await generateLocalVideo({
      prompt: params.prompt,
      width: dims.width,
      height: dims.height,
      duration,
    })
    await logVideoGeneration({
      userId: params.userId ?? null,
      videoId: params.videoId ?? null,
      plan: params.plan,
      engineRequested: 'wan-classic',
      modelRequested: 'wan-2.2',
      engineUsed: 'local',
      modelUsed: 'local-m4max',
      fallbackTriggered: false,
      fallbackReason: null,
      durationMs: Date.now() - start,
      success: true,
      errorMessage: null,
    })
    return { videoBuffer: result.videoBuffer, engine: 'wan-classic', model: 'local-m4max', duration, resolution: result.resolution }
  } catch (localErr) {
    const reason = localErr instanceof Error ? localErr.message : String(localErr)
    if (localEngineMode() === 'strict') {
      await logVideoGeneration({
        userId: params.userId ?? null,
        videoId: params.videoId ?? null,
        plan: params.plan,
        engineRequested: 'wan-classic',
        modelRequested: 'wan-2.2',
        engineUsed: 'local',
        modelUsed: 'local-m4max',
        fallbackTriggered: false,
        fallbackReason: 'local_strict_failure',
        durationMs: Date.now() - start,
        success: false,
        errorMessage: reason,
      })
      throw new Error(`Moteur local indisponible (mode strict, aucun appel externe payant lance) : ${reason}`)
    }
    console.error('[ltx] moteur local echoue (mode auto), repli externe documente :', reason)
    return null
  }
}
