import { sleep } from '@/lib/utils/api'
import { musicResponse, MusicProviderJobError, validMusicJobId, validMusicUrl, type MusicJobContext } from './music-provider-job'

// Existing "riffusion" selection uses MusicalAPI (Lannetech), NOT official Riffusion.
// https://musicalapi.com/docs/ : POST prompt once, then POST request_id for status.
// Explicit selection only; never a fallback after another paid submission.
const RIFFUSION_BASE_URL = 'https://musicalapi.com/api'
const RIFFUSION_GENERATE_PATH = '/generate-music'
const POLL_INTERVAL_MS = 13_000 // standard plan: 5 requests/minute including submit
const POLL_TIMEOUT_MS = 180_000

export type RiffusionResult = { id: string; audio_url: string; title: string; provider: 'riffusion' }

export function isRiffusionConfigured(): boolean {
  return Boolean(process.env.RIFFUSION_API_KEY)
}

export async function generateRiffusionMusic(params: { prompt: string }): Promise<RiffusionResult> {
  const apiKey = process.env.RIFFUSION_API_KEY
  if (!apiKey) throw new Error('RIFFUSION_API_KEY not configured')
  if (!params.prompt.trim()) throw new Error('RIFFUSION_INVALID_REQUEST')
  const context: MusicJobContext = { provider: 'riffusion', timeoutMs: 208_000, jobId: null, remoteStatus: 'unknown' }
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' }
  const endpoint = `${RIFFUSION_BASE_URL}${RIFFUSION_GENERATE_PATH}`
  const initData = await musicResponse(endpoint, {
    method: 'POST', headers, body: JSON.stringify({ prompt: params.prompt }), signal: AbortSignal.timeout(15_000),
  }, context)
  if (!validMusicJobId(initData.request_id)) throw new MusicProviderJobError('INVALID_RESPONSE', context)
  const requestId = initData.request_id
  context.jobId = requestId
  if (initData.status !== 'pending' && initData.status !== 'complete' && initData.status !== 'failed') {
    throw new MusicProviderJobError('INVALID_RESPONSE', context)
  }
  context.remoteStatus = initData.status
  if (initData.status === 'failed') throw new MusicProviderJobError('NOT_COMPLETED', context)
  const waiting = AbortSignal.timeout(POLL_TIMEOUT_MS)
  try {
    for (;;) {
      await sleep(POLL_INTERVAL_MS, waiting)
      waiting.throwIfAborted()
      const pollData = await musicResponse(endpoint, {
        method: 'POST', headers, body: JSON.stringify({ request_id: requestId }),
        signal: AbortSignal.any([waiting, AbortSignal.timeout(10_000)]),
      }, context)
      if (pollData.request_id !== undefined && pollData.request_id !== requestId) {
        throw new MusicProviderJobError('INVALID_RESPONSE', context)
      }
      const status = pollData.status
      if (status !== 'pending' && status !== 'complete' && status !== 'failed') {
        throw new MusicProviderJobError('INVALID_RESPONSE', context)
      }
      context.remoteStatus = status
      if (status === 'failed') throw new MusicProviderJobError('NOT_COMPLETED', context)
      if (status !== 'complete') continue
      const data = pollData.data
      const record = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : undefined
      if (record?.task_id !== undefined && record.task_id !== requestId) throw new MusicProviderJobError('INVALID_RESPONSE', context)
      if (record?.status !== undefined && record.status !== 'complete') throw new MusicProviderJobError('INVALID_RESPONSE', context)
      const first: unknown = Array.isArray(record?.data) ? record.data[0] : record
      const track = first && typeof first === 'object' && !Array.isArray(first) ? first as Record<string, unknown> : undefined
      const url = track?.stream_audio_url || pollData.audio_url
      if (!validMusicUrl(url) || (track?.title !== undefined && typeof track.title !== 'string')) {
        throw new MusicProviderJobError('INVALID_RESPONSE', context)
      }
      return { id: requestId, audio_url: url, title: typeof track?.title === 'string' ? track.title : 'Riffusion track', provider: 'riffusion' }
    }
  } catch (error) {
    if (error instanceof MusicProviderJobError) throw error
    throw new MusicProviderJobError('TRANSPORT_OR_TIMEOUT', context)
  }
}
