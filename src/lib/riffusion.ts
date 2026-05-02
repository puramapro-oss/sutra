import { sleep } from '@/lib/utils/api'

// ---------------------------------------------------------------------------
// Riffusion (musicalapi.com gateway) — Music generation provider.
//
// Used as **secondary** music provider in fallbacks.ts when Suno is down.
// Endpoint reference: https://musicalapi.com/docs/ (private beta gateway,
//   formerly riffusionapi.com — domain redirect 301).
//
// Async pattern: POST { prompt } → request_id → poll same endpoint with
// { request_id } until status === 'complete' (or 'failed').
//
// Env: RIFFUSION_API_KEY (optional — provider gracefully skipped when unset)
// ---------------------------------------------------------------------------

const RIFFUSION_BASE_URL = 'https://musicalapi.com/api'
const RIFFUSION_GENERATE_PATH = '/generate-music'
const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 180_000 // 3 min

export type RiffusionResult = {
  audio_url: string
  title: string
  provider: 'riffusion'
}

interface InitialResponse {
  request_id?: string
  status?: 'pending' | 'complete' | 'failed' | string
  text?: string
  model?: string
}

interface PollResponse {
  status?: 'pending' | 'complete' | 'failed' | string
  audio_url?: string
  data?: {
    stream_audio_url?: string
    title?: string
  }
  error?: string
}

export function isRiffusionConfigured(): boolean {
  return Boolean(process.env.RIFFUSION_API_KEY)
}

export async function generateRiffusionMusic(params: {
  prompt: string
}): Promise<RiffusionResult> {
  const apiKey = process.env.RIFFUSION_API_KEY
  if (!apiKey) throw new Error('RIFFUSION_API_KEY not configured')

  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
    accept: 'application/json',
  }

  const initRes = await fetch(`${RIFFUSION_BASE_URL}${RIFFUSION_GENERATE_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: params.prompt }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!initRes.ok) {
    throw new Error(`Riffusion init failed: HTTP ${initRes.status}`)
  }
  const initData = (await initRes.json()) as InitialResponse
  const requestId = initData.request_id
  if (!requestId) {
    throw new Error('Riffusion init: no request_id returned')
  }

  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS)
    const pollRes = await fetch(`${RIFFUSION_BASE_URL}${RIFFUSION_GENERATE_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request_id: requestId }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!pollRes.ok) continue

    const pollData = (await pollRes.json()) as PollResponse
    const status = pollData.status

    if (status === 'complete') {
      const url = pollData.data?.stream_audio_url ?? pollData.audio_url
      if (!url) throw new Error('Riffusion complete but no audio URL')
      return {
        audio_url: url,
        title: pollData.data?.title ?? 'Riffusion track',
        provider: 'riffusion',
      }
    }
    if (status === 'failed') {
      throw new Error(`Riffusion failed: ${pollData.error ?? 'unknown'}`)
    }
  }

  throw new Error('Riffusion timeout (>3 min)')
}
