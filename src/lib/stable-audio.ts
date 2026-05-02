// ---------------------------------------------------------------------------
// Stable Audio 2.5 (Stability AI) via Replicate REST API.
//
// Used as **tertiary** music provider in fallbacks.ts when Suno + Riffusion
// are both down.
//
// Endpoint: POST https://api.replicate.com/v1/models/stability-ai/stable-audio-2.5/predictions
//   with `Prefer: wait` header for synchronous response (up to 60s).
// Reference: https://replicate.com/docs/reference/http
//
// Env: REPLICATE_API_TOKEN (optional — provider gracefully skipped when unset)
// ---------------------------------------------------------------------------

const REPLICATE_BASE_URL = 'https://api.replicate.com/v1'
const STABLE_AUDIO_MODEL = 'stability-ai/stable-audio-2.5'

export type StableAudioResult = {
  audio_url: string
  provider: 'stable-audio'
}

interface PredictionResponse {
  id?: string
  status?: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | string
  output?: string | string[] | null
  error?: string | null
}

export function isStableAudioConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN)
}

export async function generateStableAudio(params: {
  prompt: string
  duration?: number // seconds, default 30
}): Promise<StableAudioResult> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured')

  const { prompt, duration = 30 } = params

  const res = await fetch(
    `${REPLICATE_BASE_URL}/models/${STABLE_AUDIO_MODEL}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=60',
      },
      body: JSON.stringify({
        input: {
          prompt,
          duration,
        },
      }),
      signal: AbortSignal.timeout(70_000),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Stable Audio failed: HTTP ${res.status} ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as PredictionResponse

  if (data.status === 'failed' || data.status === 'canceled') {
    throw new Error(`Stable Audio: ${data.error ?? data.status}`)
  }

  // Output is typically a single URL (string) or array — normalize.
  const output = Array.isArray(data.output) ? data.output[0] : data.output
  if (!output || typeof output !== 'string') {
    throw new Error('Stable Audio: no output URL (still processing — increase Prefer: wait?)')
  }

  return { audio_url: output, provider: 'stable-audio' }
}
