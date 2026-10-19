import { musicResponse, MusicProviderJobError, validMusicJobId, validMusicUrl, type MusicJobContext } from './music-provider-job'

// Explicitly selected Stable Audio 2.5 via Replicate; never an automatic fallback.
// https://replicate.com/stability-ai/stable-audio-2.5/api/schema
// Prefer: wait=60 is an HTTP wait, not proof that the prediction completed.
const REPLICATE_BASE_URL = 'https://api.replicate.com/v1'
const STABLE_AUDIO_MODEL = 'stability-ai/stable-audio-2.5'

export type StableAudioResult = { id: string; audio_url: string; provider: 'stable-audio' }

export function isStableAudioConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN)
}

export async function generateStableAudio(params: {
  prompt: string
  duration?: number // seconds, default 30; documented range 1..190
}): Promise<StableAudioResult> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured')
  const { prompt, duration = 30 } = params
  if (!prompt.trim() || !Number.isInteger(duration) || duration < 1 || duration > 190) {
    throw new Error('STABLE_AUDIO_INVALID_REQUEST')
  }
  const context: MusicJobContext = { provider: 'stable-audio', timeoutMs: 70_000, jobId: null, remoteStatus: 'unknown' }
  const data = await musicResponse(`${REPLICATE_BASE_URL}/models/${STABLE_AUDIO_MODEL}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input: { prompt, duration } }), signal: AbortSignal.timeout(context.timeoutMs),
  }, context)
  if (!validMusicJobId(data.id)) throw new MusicProviderJobError('INVALID_RESPONSE', context)
  context.jobId = data.id
  if (data.status !== 'starting' && data.status !== 'processing' && data.status !== 'succeeded' && data.status !== 'failed' && data.status !== 'canceled') {
    throw new MusicProviderJobError('INVALID_RESPONSE', context)
  }
  context.remoteStatus = data.status
  if (data.status !== 'succeeded') throw new MusicProviderJobError('NOT_COMPLETED', context)
  const output = Array.isArray(data.output) ? data.output[0] : data.output
  if (!validMusicUrl(output)) throw new MusicProviderJobError('INVALID_RESPONSE', context)
  return { id: data.id, audio_url: output, provider: 'stable-audio' }
}
