import { setTimeout as delay } from 'node:timers/promises'
import type { LtxResult } from '../ltx-types'
import type { LtxJobPersistence } from '../ltx-workflow'
import { saladConfig, requireActive, type SaladConfig } from './config'
import { createSaladClient } from './client'
import { saladCheckpoint } from './checkpoint'
import { MODEL, SaladError, sha256, type DurableJournal, type VideoInput } from './contracts'
import type { Fetcher } from './http'

type ServerEnvironment = Record<string, string | undefined>
export function saladApplicationConfig(values: ServerEnvironment = process.env): { config: SaladConfig; budget: number } {
  if (values.SALAD_ENABLED !== 'true') return { config: saladConfig(), budget: 0 }
  try {
    const config = saladConfig({ enabled: true, gatewayUrl: values.SALAD_GATEWAY_URL,
      gatewayApiKey: values.SALAD_API_KEY, workerToken: values.SALAD_WORKER_TOKEN,
      qualification: JSON.parse(values.SALAD_QUALIFICATION_JSON ?? ''),
      quote: JSON.parse(values.SALAD_QUOTE_JSON ?? ''),
      requestTimeoutMs: Number(values.SALAD_REQUEST_TIMEOUT_MS),
      generationTimeoutMs: Number(values.SALAD_GENERATION_TIMEOUT_MS) })
    const budget = Number(values.SALAD_MAX_ESTIMATED_COMPUTE_USD)
    if (!Number.isFinite(budget) || budget <= 0) throw new Error()
    return { config, budget }
  } catch { throw new SaladError('SALAD_INVALID_CONFIG') }
}

// Capabilities cannot read/write a job, even accidentally.
const readOnlyJournal: DurableJournal = {
  kind: 'submission-intent',
  async load() { throw new SaladError('SALAD_READ_ONLY') },
  async reserve() { throw new SaladError('SALAD_READ_ONLY') },
  async compareAndSet() { throw new SaladError('SALAD_READ_ONLY') },
}

export type PersonalCapabilities = {
  allowed: boolean; provider: 'salad'; state: 'disabled' | 'unavailable' | 'unknown' | 'cold' | 'ready' | 'busy' | 'interrupted' | 'incompatible'
  available: boolean; reason: string | null; operations: string[]; profiles: VideoInput['profile'][]
  cost: { estimatedComputeUsd: number | null; actualUsd: null; currency: 'USD'; basis: string }
  quotaRemaining: null
}

/** `owner` comes only from authenticated server identity. No manifest/URL/key in public DTO. */
export async function saladPublicCapabilities(owner: boolean, values: ServerEnvironment = process.env, fetcher: Fetcher = fetch) {
  const personal: PersonalCapabilities = { allowed: owner, provider: 'salad', state: owner ? 'disabled' : 'unavailable',
    available: false, reason: owner ? 'SALAD_DISABLED' : 'OWNER_ONLY', operations: [], profiles: [],
    cost: { estimatedComputeUsd: null, actualUsd: null, currency: 'USD', basis: 'compute-only-excludes-idle-storage-network' }, quotaRemaining: null }
  const dto = { version: 1 as const, personal,
    client: { mode: 'api' as const, availability: 'unknown' as const, reason: 'PROVIDER_NOT_PROBED' as const } }
  if (!owner) return dto
  try {
    const { config, budget } = saladApplicationConfig(values)
    if (!config.enabled) return dto
    const caps = await createSaladClient(config, readOnlyJournal, fetcher).capabilities()
    if (sha256(JSON.stringify(caps.qualification)) !== sha256(JSON.stringify(config.qualification))
      || sha256(JSON.stringify(caps.quote)) !== sha256(JSON.stringify(config.quote))
      || caps.generationTimeoutMs !== config.generationTimeoutMs) throw new SaladError('SALAD_NOT_QUALIFIED')
    const now = Date.now()
    if (config.qualification.verifiedAt > now || config.quote.observedAt > now || config.quote.expiresAt <= now) throw new SaladError('SALAD_STALE_QUOTE')
    const estimate = config.quote.hourlyRate * config.generationTimeoutMs / 3600000
    if (estimate > budget) throw new SaladError('SALAD_ESTIMATE_EXCEEDS_BUDGET')
    personal.state = caps.state
    personal.reason = caps.state === 'ready' ? null : `SALAD_${caps.state.toUpperCase()}`
    personal.available = caps.state === 'ready'
    personal.operations = [...caps.operations]
    personal.profiles = config.qualification.profiles
    personal.cost.estimatedComputeUsd = estimate
  } catch (error) {
    personal.state = 'unavailable'
    personal.reason = error instanceof SaladError ? error.code : 'SALAD_UNAVAILABLE'
  }
  return dto
}

/** Called by the existing owner-only local route; never selects a second engine. */
export async function generateSaladVideo(params: {
  prompt: string; quality: string; format?: string; duration?: number; userId?: string; videoId?: string
  job?: LtxJobPersistence; operationKey?: string; imageUri?: string; lastFrameUri?: string; cameraMotion?: string
}, values: ServerEnvironment = process.env, fetcher: Fetcher = fetch): Promise<LtxResult> {
  const { config, budget } = saladApplicationConfig(values)
  const active = requireActive(config)
  if (params.imageUri || params.lastFrameUri || params.cameraMotion) throw new SaladError('SALAD_UNSUPPORTED_OPERATION')
  if (!params.job || !params.userId || !params.videoId) throw new SaladError('SALAD_DURABLE_CONTEXT_REQUIRED')
  const operation = params.operationKey ?? params.job.operationKey
  if (!operation) throw new SaladError('SALAD_DURABLE_CONTEXT_REQUIRED')
  const format = params.format ?? '16:9'
  if (!['16:9', '9:16', '1:1'].includes(format) || !['720p', '1080p'].includes(params.quality)) throw new SaladError('SALAD_UNSUPPORTED_PROFILE')
  const shortEdge = params.quality === '720p' ? 720 : 1080
  const ratio = format === '1:1' ? 1 : format === '16:9' ? 16 / 9 : 9 / 16
  const duration = params.duration ?? 6
  if (!Number.isFinite(duration) || duration <= 0) throw new SaladError('SALAD_INVALID_INPUT')
  // No silent quality/duration degradation. One-frame rounding is disclosed by result.duration.
  const profile = active.qualification.profiles.find(p => Math.min(p.width, p.height) >= shortEdge
    && Math.abs(p.width - p.height * ratio) <= 32 && p.num_frames / p.fps >= duration && p.num_frames / p.fps - duration <= 1 / p.fps)
  if (!profile) throw new SaladError('SALAD_UNSUPPORTED_PROFILE')
  const input = { prompt: params.prompt, profile }
  const client = createSaladClient(config, saladCheckpoint(params.job), fetcher)
  const scope = JSON.stringify([params.userId, params.videoId])
  let job = await client.submit(scope, operation, input, budget)
  // Polling is bounded; later queue runs use the persisted ID with GET only.
  const until = Math.min(job.reconcileAfter, Date.now() + 60_000)
  while (job.status === 'running' && Date.now() < until) {
    await delay(Math.min(2000, Math.max(1, until - Date.now())))
    job = await client.resume(scope, operation, input)
  }
  if (job.status !== 'succeeded') throw new SaladError('SALAD_RECONCILIATION_REQUIRED')
  const bytes = await client.download(job, input)
  return { videoBuffer: Uint8Array.from(bytes).buffer, engine: 'salad', model: MODEL,
    duration: profile.num_frames / profile.fps, resolution: `${profile.width}x${profile.height}`, provenance: job }
}
