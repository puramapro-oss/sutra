import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv, optionalEnv, isEnvSet } from '@/lib/env'
import { isSuperAdmin } from '@/lib/utils'

export type RunpodFormat = '9:16' | '16:9' | '1:1'

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
): Promise<{ jobId: string; baseUrl: string }> {
  const apiKey = requireEnv('RUNPOD_API_KEY', 'generation video WAN/RunPod')
  const baseUrl = getBaseUrl(userEmail)

  const res = await fetchWithRetry(`${baseUrl}/run`, {
    method: 'POST',
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
  })

  if (!res.ok) {
    throw new Error(`RunPod: ${await httpErrorMessage(res)}`)
  }
  const data = (await res.json()) as { id?: string; error?: string }
  if (!data.id) throw new Error(`RunPod: ${data.error ?? 'pas de job ID'}`)
  return { jobId: data.id, baseUrl }
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

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${pollUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      // 401/403/404 : clé invalide ou job inconnu → inutile de re-sonder.
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`RunPod status: HTTP ${res.status} pour le job ${jobId}`)
      }
      await sleep(3000)
      continue
    }
    const data = (await res.json()) as {
      status?: string
      error?: string
      output?: string | {
        images?: Array<string | { type?: string; data?: string }>
        video_url?: string
      }
    }

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
      if (!raw) throw new Error('RunPod: pas de video dans la reponse')
      if (typeof raw === 'string') return raw
      if (!raw.data) throw new Error('RunPod: reponse invalide (data absente)')
      return raw.type === 's3_url'
        ? raw.data
        : `data:video/mp4;base64,${raw.data}`
    }

    if (data.status === 'FAILED') {
      throw new Error(`RunPod: generation echouee - ${data.error ?? 'erreur inconnue'}`)
    }

    await sleep(3000)
  }
  throw new Error('RunPod: timeout apres 5 minutes')
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
