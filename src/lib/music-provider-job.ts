import { providerRecord } from './provider-response'

type MusicJobStatus = 'unknown' | 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled' | 'pending' | 'complete'
export type MusicJobContext = {
  provider: 'stable-audio' | 'riffusion'
  timeoutMs: number
  jobId: string | null
  remoteStatus: MusicJobStatus
}

/** Known remote identity survives wrapper failures. Never authorizes paid replay. */
export class MusicProviderJobError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  readonly cost = { estimated: null, actual: null, status: 'not_reported' } as const
  readonly quota = { remaining: null }
  readonly provider: MusicJobContext['provider']
  readonly timeoutMs: number
  readonly jobId: string | null
  readonly remoteStatus: MusicJobStatus
  constructor(readonly code: 'HTTP' | 'TRANSPORT_OR_TIMEOUT' | 'INVALID_RESPONSE' | 'NOT_COMPLETED', context: MusicJobContext, readonly httpStatus?: number) {
    super(`MUSIC_${code}${httpStatus === undefined ? '' : ` HTTP ${httpStatus}`}: resoumission non autorisee; reconciliation requise`)
    this.name = 'MusicProviderJobError'
    this.provider = context.provider
    this.timeoutMs = context.timeoutMs
    this.jobId = context.jobId
    this.remoteStatus = context.remoteStatus
  }
}

export function validMusicJobId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value)
}

export function validMusicUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && (!url.port || url.port === '443')
  } catch { return false }
}

/** One HTTP operation, bounded through the body; raw diagnostics never escape. */
export async function musicResponse(url: string, init: RequestInit & { signal: AbortSignal }, context: MusicJobContext) {
  let response: Response
  try { response = await fetch(url, { ...init, redirect: 'error', cache: 'no-store' }) }
  catch { throw new MusicProviderJobError('TRANSPORT_OR_TIMEOUT', context) }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    throw new MusicProviderJobError('HTTP', context, response.status)
  }
  try { return await providerRecord(response, init.signal) }
  catch { throw new MusicProviderJobError(init.signal.aborted ? 'TRANSPORT_OR_TIMEOUT' : 'INVALID_RESPONSE', context) }
}
