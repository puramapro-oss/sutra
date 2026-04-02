import { fetchWithRetry, sleep } from '@/lib/utils/api'
import { isSuperAdmin } from '@/lib/utils'

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID!
const RUNPOD_POD_URL = process.env.RUNPOD_POD_URL ?? ''

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

function getBaseUrl(userEmail?: string | null): string {
  // Super admin uses dedicated GPU pod if configured
  if (userEmail && isSuperAdmin(userEmail) && RUNPOD_POD_URL) {
    return RUNPOD_POD_URL.replace(/\/$/, '')
  }
  // Everyone else (and super admin fallback) uses serverless
  return `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`
}

export async function submitVideoJob(
  req: VideoGenRequest,
  userEmail?: string | null
): Promise<{ jobId: string; baseUrl: string }> {
  const baseUrl = getBaseUrl(userEmail)

  const res = await fetchWithRetry(`${baseUrl}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RUNPOD_API_KEY}`,
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

  const data = await res.json()
  if (!data.id) throw new Error(`RunPod: ${data.error ?? 'pas de job ID'}`)
  return { jobId: data.id, baseUrl }
}

export async function pollVideoJob(
  jobId: string,
  baseUrl?: string,
  timeoutMs = 300_000
): Promise<string> {
  const pollUrl = baseUrl ?? `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${pollUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    })
    const data = await res.json()

    if (data.status === 'COMPLETED') {
      const output = data.output?.images?.[0] ?? data.output?.video_url ?? data.output
      if (!output) throw new Error('RunPod: pas de video dans la reponse')
      if (typeof output === 'string') return output
      return output.type === 's3_url'
        ? output.data
        : `data:video/mp4;base64,${output.data}`
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
  userEmail?: string | null
): Promise<string[]> {
  const dimensions = {
    '720p': { width: 768, height: 512 },
    '1080p': { width: 1024, height: 576 },
    '4k': { width: 1280, height: 720 },
  }
  const { width, height } = dimensions[quality]

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
