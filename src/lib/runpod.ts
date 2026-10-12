import { fetchWithRetry, sleep } from '@/lib/utils/api'
import { requireEnv, optionalEnv, isEnvSet } from '@/lib/env'
import { isSuperAdmin } from '@/lib/utils'

export type RunpodFormat = '9:16' | '16:9' | '1:1'

export type RunpodRemoteStatus = 'unknown' | 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
export interface RunpodProvenance {
  provider: 'runpod'
  id: string | null
  remoteStatus: RunpodRemoteStatus
  timeoutMs: number
  lastHttpStatus: number | null
  cost: { currency: 'USD'; estimated: null; actual: null; actualStatus: 'not_reported'; basis: 'worker_gpu_profile_required' }
  quota: { remaining: null; retryAfterSeconds: number | null }
  source: 'https://docs.runpod.io/serverless/endpoints/send-requests'
}
export function runpodProvenance(id: string | null, remoteStatus: RunpodRemoteStatus, timeoutMs: number, lastHttpStatus: number | null = null): RunpodProvenance {
  return { provider: 'runpod', id, remoteStatus, timeoutMs, lastHttpStatus,
    cost: { currency: 'USD', estimated: null, actual: null, actualStatus: 'not_reported', basis: 'worker_gpu_profile_required' },
    quota: { remaining: null, retryAfterSeconds: null }, source: 'https://docs.runpod.io/serverless/endpoints/send-requests' }
}
export class RunpodJobError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  constructor(readonly code: string, readonly provenance: RunpodProvenance) {
    super(`RunPod: ${code}${provenance.id ? ` (job ${provenance.id})` : ''}; resoumission non autorisee`)
    this.name = 'RunpodJobError'
  }
}

interface VideoGenRequest {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  num_frames?: number
  seed?: number
  steps?: number
  cfg_scale?: number
}

export function isRunpodConfigured(): boolean {
  return isEnvSet('RUNPOD_API_KEY') && isEnvSet('RUNPOD_ENDPOINT_ID')
}

function getBaseUrl(userEmail?: string | null): string {
  const endpointId = requireEnv('RUNPOD_ENDPOINT_ID', 'generation video WAN/RunPod')
  const podUrl = optionalEnv('RUNPOD_POD_URL', '')
  // Super admin uses dedicated GPU pod if configured
  if (userEmail && isSuperAdmin(userEmail) && podUrl) {
    return podUrl.replace(/\/$/, '')
  }
  // Everyone else (and super admin fallback) uses serverless
  return `https://api.runpod.ai/v2/${endpointId}`
}

export async function submitVideoJob(
  req: VideoGenRequest,
  userEmail?: string | null
): Promise<{ jobId: string; baseUrl: string; provenance: RunpodProvenance }> {
  const apiKey = requireEnv('RUNPOD_API_KEY', 'generation video WAN/RunPod')
  const baseUrl = getBaseUrl(userEmail)

  let res: Response
  try { res = await fetchWithRetry(`${baseUrl}/run`, {
    method: 'POST', cache: 'no-store', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: {
        prompt: req.prompt,
        negative_prompt: req.negative_prompt ?? 'blurry, low quality, distorted, watermark, text, glitch, deformed',
        width: req.width ?? 768,
        height: req.height ?? 512,
        num_frames: req.num_frames ?? 81,
        steps: req.steps ?? 20,
        cfg_scale: req.cfg_scale ?? 6,
        seed: req.seed,
      },
    }),
  }) } catch { throw new RunpodJobError('SUBMISSION_UNKNOWN', runpodProvenance(null, 'unknown', 300_000)) }

  const provenance = runpodProvenance(null, 'unknown', 300_000, res.status)
  const retry = Number(res.headers.get('retry-after'))
  if (res.headers.has('retry-after') && Number.isFinite(retry) && retry >= 0) provenance.quota.retryAfterSeconds = retry
  if (!res.ok) throw new RunpodJobError(`HTTP ${res.status}`, provenance)
  const data = await res.json().catch(() => null) as { id?: string; status?: string } | null
  if (!data?.id || !/^[A-Za-z0-9_-]{1,200}$/.test(data.id)) throw new RunpodJobError('pas de job ID / SUBMISSION_UNKNOWN', provenance)
  provenance.id = data.id
  if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') provenance.remoteStatus = data.status
  return { jobId: data.id, baseUrl, provenance }
}

export async function pollVideoJob(
  jobId: string,
  baseUrl?: string,
  timeoutMs = 300_000
): Promise<string> {
  const apiKey = requireEnv('RUNPOD_API_KEY', 'generation video WAN/RunPod')
  const endpointId = requireEnv('RUNPOD_ENDPOINT_ID', 'generation video WAN/RunPod')
  const pollUrl = baseUrl ?? `https://api.runpod.ai/v2/${endpointId}`
  const start = Date.now()
  const provenance = runpodProvenance(jobId, 'unknown', timeoutMs)
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(jobId) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RunpodJobError('INVALID_POLL_CONTEXT', provenance)

  while (Date.now() - start < timeoutMs) {
    let res: Response
    try { res = await fetch(`${pollUrl}/status/${encodeURIComponent(jobId)}`, {
      cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, timeoutMs - (Date.now() - start)))),
    }) } catch { throw new RunpodJobError('POLL_NETWORK_UNKNOWN', provenance) }
    provenance.lastHttpStatus = res.status
    if (!res.ok) {
      // 401/403/404 : clé invalide ou job inconnu → inutile de re-sonder.
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new RunpodJobError(`HTTP ${res.status}`, provenance)
      }
      if (res.status !== 429 && res.status < 500) throw new RunpodJobError(`HTTP ${res.status}`, provenance)
      const retry = Number(res.headers.get('retry-after'))
      provenance.quota.retryAfterSeconds = res.headers.has('retry-after') && Number.isFinite(retry) && retry >= 0 ? retry : null
      const pause = Math.max(3000, (provenance.quota.retryAfterSeconds ?? 0) * 1000)
      if (Date.now() - start + pause >= timeoutMs) break
      await sleep(pause)
      continue
    }
    const data = (await res.json().catch(() => null)) as null | {
      id?: string
      status?: string
      error?: string
      output?: string | {
        images?: Array<string | { type?: string; data?: string }>
        video_url?: string
      }
    }

    if (!data || (data.id && data.id !== jobId) || !['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT'].includes(data.status ?? '')) throw new RunpodJobError('INVALID_POLL_RESPONSE', provenance)
    provenance.remoteStatus = data.status as RunpodRemoteStatus
    if (data.status === 'COMPLETED') {
      const output = data.output
      let raw: string | { type?: string; data?: string } | undefined
      if (typeof output === 'string') {
        raw = output
      } else if (output) {
        const first = output.images?.[0]
        if (typeof first === 'string') raw = first
        else raw = first ?? (output.video_url ? output.video_url : undefined)
      }
      if (!raw) throw new RunpodJobError('OUTPUT_MISSING', provenance)
      if (typeof raw === 'string') return raw
      if (!raw.data) throw new RunpodJobError('OUTPUT_MISSING', provenance)
      return raw.type === 's3_url'
        ? raw.data
        : `data:video/mp4;base64,${raw.data}`
    }

    if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(data.status!)) throw new RunpodJobError(`REMOTE_${data.status}`, provenance)

    if (Date.now() - start + 3000 >= timeoutMs) break
    await sleep(3000)
  }
  throw new RunpodJobError('WAIT_TIMEOUT_REMOTE_UNCHANGED', provenance)
}

export async function generateAllScenes(
  scenes: Array<{ prompt: string; duration_seconds: number }>,
  quality: '720p' | '1080p' | '4k',
  userEmail?: string | null,
  format: RunpodFormat = '16:9'
): Promise<string[]> {
  // Dimensions natives WAN par format — cohérentes avec src/lib/wan.ts.
  // NB : le palier « 4k » reste du 1280x720 natif WAN, jamais de l'UHD.
  const dimensions: Record<'720p' | '1080p' | '4k', Record<RunpodFormat, { width: number; height: number }>> = {
    '720p': { '16:9': { width: 896, height: 512 }, '9:16': { width: 512, height: 896 }, '1:1': { width: 768, height: 768 } },
    '1080p': { '16:9': { width: 1024, height: 576 }, '9:16': { width: 576, height: 1024 }, '1:1': { width: 896, height: 896 } },
    '4k': { '16:9': { width: 1280, height: 720 }, '9:16': { width: 720, height: 1280 }, '1:1': { width: 1024, height: 1024 } },
  }
  const { width, height } = dimensions[quality][format]

  const jobs = await Promise.all(
    scenes.map((scene) =>
      submitVideoJob(
        {
          prompt: scene.prompt,
          width,
          height,
          steps: 20,
          num_frames: Math.round(scene.duration_seconds * 16),
          cfg_scale: 6,
        },
        userEmail
      )
    )
  )

  const results = await Promise.all(
    jobs.map((job) => pollVideoJob(job.jobId, job.baseUrl))
  )
  return results
}
