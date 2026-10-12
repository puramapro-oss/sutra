import { createHash } from 'node:crypto'
import { downloadMediaBytes } from './media-download'
import { boundedProviderJson } from './provider-json'
import { requireEnv } from './env'
import { LTX_REQUESTS, validateLtxRequest, type LtxCost, type LtxEndpoint, type LtxInputMedia, type LtxRequest } from './ltx-v2-contract'

export interface LtxJob {
  version: 2
  key: string
  fingerprint: string
  revision: number
  provider: 'ltx'
  endpoint: LtxEndpoint
  model: string
  id: string | null
  state: 'submitting' | 'submission_unknown' | 'rejected' | 'accepted' | 'completed' | 'failed'
  remoteStatus: 'unknown' | 'pending' | 'processing' | 'completed' | 'failed' | 'not_found'
  createdAt: string
  remoteCreatedAt: string | null
  completedAt: string | null
  cost: LtxCost
  quota: { status: 'unknown' | 'queue_limited' | 'insufficient_credits'; retryAfterSeconds: number | null; remaining: null }
  timeoutMs: number
  lastHttpStatus: number | null
  errorCode: string | null
  output?: { kind: 'video' | 'exr-zip'; url: string }
}

/** The store must be durable, scoped to an authorized workflow and implement atomic CAS.
 * A submitting/unknown record is NEVER reclaimed by age, retry count or lease expiry. */
export interface LtxJobStore {
  load(key: string): Promise<LtxJob | null>
  compareAndSet(key: string, expectedRevision: number | null, next: LtxJob): Promise<boolean>
}
export interface LtxExecution {
  store: LtxJobStore
  operationKey: string
  inputMedia?: LtxInputMedia
  signal?: AbortSignal
  timeoutMs?: number
}
export class LtxJobError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  constructor(readonly code: string, readonly job: LtxJob | null) {
    super(`${code}${job?.id ? ` (job ${job.id})` : ''}. Reprendre le suivi, ne pas resoumettre.`)
    this.name = 'LtxJobError'
  }
}

const BASE = 'https://api.ltx.io/v2'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
function validateStoredJob(job: LtxJob, execution: LtxExecution) {
  if (job.version !== 2 || job.provider !== 'ltx' || job.key !== hash(execution.operationKey) || !Object.hasOwn(LTX_REQUESTS, job.endpoint) || !Number.isInteger(job.revision) || job.revision < 0 || (job.id !== null && !/^[A-Za-z0-9_-]{1,200}$/.test(job.id))) throw new LtxJobError('LTX_INVALID_CHECKPOINT', job)
}
function timeout(value: number) {
  if (!Number.isFinite(value) || value < 1 || value > 3_600_000) throw new LtxJobError('LTX_INVALID_TIMEOUT', null)
  return Math.ceil(value)
}
function outputUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid output')
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname === 'localhost' || url.hostname.includes(':') || /^\d+\./.test(url.hostname) || !url.hostname.includes('.')) throw new Error('invalid output')
  return url.href
}
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const stop = () => { clearTimeout(timer); reject(new Error('aborted')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve() }, ms)
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/** Dependencies are injected for zero-spend contract tests. Production always uses no-store. */
export function createLtxClient(deps: { fetch?: typeof fetch; now?: () => number; sleep?: typeof delay; random?: () => number; download?: typeof downloadMediaBytes } = {}) {
  const request: typeof fetch = deps.fetch ?? ((...args) => fetch(...args))
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? delay
  const random = deps.random ?? Math.random

  async function persist(job: LtxJob, store: LtxJobStore, patch: Partial<LtxJob>): Promise<LtxJob> {
    const next = { ...job, ...patch, revision: job.revision + 1 }
    try {
      if (!await store.compareAndSet(job.key, job.revision, next)) throw new Error('conflict')
    } catch { throw new LtxJobError('LTX_CHECKPOINT_UNCONFIRMED', next) }
    return next
  }
  async function submit<E extends LtxEndpoint>(endpoint: E, input: LtxRequest<E>, execution: LtxExecution): Promise<LtxJob> {
    const { body, cost } = validateLtxRequest(endpoint, input, execution?.inputMedia)
    const apiKey = requireEnv('LTX_API_KEY', 'generation video LTX V2')
    if (!execution?.store || !execution.operationKey?.trim()) throw new LtxJobError('LTX_DURABLE_CONTEXT_REQUIRED', null)
    const timeoutMs = timeout(execution.timeoutMs ?? 300_000)
    const key = hash(execution.operationKey)
    const fingerprint = hash(canonical({ endpoint, body, media: execution.inputMedia ?? null }))
    let job: LtxJob = {
      version: 2, key, fingerprint, revision: 0, provider: 'ltx', endpoint,
      model: String(body.model ?? 'provider-selected'), id: null,
      state: 'submitting', remoteStatus: 'unknown', createdAt: new Date(now()).toISOString(),
      remoteCreatedAt: null, completedAt: null, cost,
      quota: { status: 'unknown', retryAfterSeconds: null, remaining: null },
      timeoutMs, lastHttpStatus: null, errorCode: null,
    }
    if (execution.signal?.aborted) throw new LtxJobError('LTX_WAIT_CANCELLED_REMOTE_UNCHANGED', null)
    let claimed: boolean
    try { claimed = await execution.store.compareAndSet(key, null, job) }
    catch { throw new LtxJobError('LTX_JOURNAL_UNAVAILABLE', null) }
    if (!claimed) {
      const previous = await execution.store.load(key)
      if (!previous || previous.fingerprint !== fingerprint) throw new LtxJobError('LTX_OPERATION_CONFLICT', previous)
      validateStoredJob(previous, execution)
      if (!previous.id) throw new LtxJobError('LTX_SUBMISSION_REQUIRES_RECONCILIATION', previous)
      if (previous.state === 'failed') throw new LtxJobError('LTX_REMOTE_FAILED', previous)
      return previous // Resume accepted/completed; no paid POST.
    }
    let response: Response
    let data: Record<string, unknown>
    try {
      response = await request(`${BASE}/${endpoint}`, {
        method: 'POST', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: execution.signal ? AbortSignal.any([execution.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      })
      data = await boundedProviderJson(response)
    } catch {
      job = await persist(job, execution.store, { state: 'submission_unknown', errorCode: 'LTX_SUBMISSION_UNKNOWN' })
      throw new LtxJobError('LTX_SUBMISSION_UNKNOWN', job)
    }
    if (response.status !== 202 || typeof data?.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(data.id) || !timestamp(data.created_at)) {
      const rejected = [400, 401, 402, 403, 404, 422, 429].includes(response.status)
      const retry = Number(response.headers.get('retry-after'))
      job = await persist(job, execution.store, {
        state: rejected ? 'rejected' : 'submission_unknown', lastHttpStatus: response.status,
        errorCode: rejected ? `LTX_HTTP_${response.status}` : 'LTX_SUBMISSION_UNKNOWN',
        quota: { status: response.status === 429 ? 'queue_limited' : response.status === 402 ? 'insufficient_credits' : 'unknown', retryAfterSeconds: response.headers.has('retry-after') && Number.isFinite(retry) && retry >= 0 ? retry : null, remaining: null },
      })
      throw new LtxJobError(job.errorCode!, job)
    }
    return persist(job, execution.store, { id: data.id, remoteCreatedAt: data.created_at, state: 'accepted', remoteStatus: 'unknown', lastHttpStatus: 202 })
  }

  async function poll(job: LtxJob, execution: LtxExecution, remainingMs = 15_000): Promise<LtxJob> {
    validateStoredJob(job, execution)
    if (!job.id) throw new LtxJobError('LTX_JOB_NOT_RESUMABLE', job)
    if (execution.signal?.aborted) throw new LtxJobError('LTX_WAIT_CANCELLED_REMOTE_UNCHANGED', job)
    const apiKey = requireEnv('LTX_API_KEY', 'suivi LTX V2')
    let res: Response
    let data: Record<string, unknown>
    try {
      res = await request(`${BASE}/${job.endpoint}/${encodeURIComponent(job.id)}`, {
        cache: 'no-store', redirect: 'error', headers: { Authorization: `Bearer ${apiKey}` },
        signal: execution.signal ? AbortSignal.any([execution.signal, AbortSignal.timeout(Math.max(1, Math.min(15_000, remainingMs)))]) : AbortSignal.timeout(Math.max(1, Math.min(15_000, remainingMs))),
      })
      data = await boundedProviderJson(res)
    } catch { throw new LtxJobError(execution.signal?.aborted ? 'LTX_WAIT_CANCELLED_REMOTE_UNCHANGED' : 'LTX_POLL_TRANSIENT', job) }
    if (res.status !== 200) {
      const retry = Number(res.headers.get('retry-after'))
      job = await persist(job, execution.store, {
        lastHttpStatus: res.status,
        ...(res.status === 404 && { remoteStatus: 'not_found' as const }),
        quota: { ...job.quota, retryAfterSeconds: res.headers.has('retry-after') && Number.isFinite(retry) && retry >= 0 ? retry : null },
      })
      throw new LtxJobError(res.status === 429 || res.status >= 500 ? 'LTX_POLL_TRANSIENT' : `LTX_POLL_HTTP_${res.status}`, job)
    }
    if (!data || data.id !== job.id || !timestamp(data.created_at) || !['pending', 'processing', 'completed', 'failed'].includes(String(data.status))) throw new LtxJobError('LTX_INVALID_POLL_RESPONSE', job)
    const status = data.status as LtxJob['remoteStatus']
    if ((job.state === 'completed' || job.state === 'failed') && status !== job.state) throw new LtxJobError('LTX_REMOTE_STATE_REGRESSION', job)
    const patch: Partial<LtxJob> = { remoteStatus: status, lastHttpStatus: res.status }
    if (status === 'completed' || status === 'failed') {
      if (!timestamp(data.completed_at)) throw new LtxJobError('LTX_INVALID_POLL_RESPONSE', job)
      patch.state = status
      patch.completedAt = data.completed_at
      if (status === 'completed') {
        const result = data.result as Record<string, unknown> | undefined
        const hdr = job.endpoint === 'video-to-video-hdr'
        try { patch.output = { kind: hdr ? 'exr-zip' : 'video', url: outputUrl(result?.[hdr ? 'exr_frames_url' : 'video_url']) } }
        catch { throw new LtxJobError('LTX_INVALID_OUTPUT', job) }
      } else patch.errorCode = 'LTX_REMOTE_FAILED'
    }
    return persist(job, execution.store, patch)
  }

  async function wait(initial: LtxJob, execution: LtxExecution): Promise<LtxJob> {
    validateStoredJob(initial, execution)
    let job = initial
    const deadline = now() + timeout(execution.timeoutMs ?? job.timeoutMs)
    let failures = 0
    while (now() < deadline) {
      if (execution.signal?.aborted) throw new LtxJobError('LTX_WAIT_CANCELLED_REMOTE_UNCHANGED', job)
      if (job.state === 'failed') throw new LtxJobError('LTX_REMOTE_FAILED', job)
      if (job.state === 'completed' && job.output) return job
      try { job = await poll(job, execution, deadline - now()); failures = 0 }
      catch (error) {
        if (!(error instanceof LtxJobError) || error.code !== 'LTX_POLL_TRANSIENT') throw error
        job = error.job!
        failures++
      }
      if (job.state === 'completed') return job
      if (job.state === 'failed') throw new LtxJobError('LTX_REMOTE_FAILED', job)
      const ms = Math.max(5000 + Math.floor(random() * 1000), Math.min(30_000, 5000 * 2 ** Math.min(failures, 3)), (job.quota.retryAfterSeconds ?? 0) * 1000)
      if (now() + ms >= deadline) break
      try { await sleep(ms, execution.signal) }
      catch { throw new LtxJobError('LTX_WAIT_CANCELLED_REMOTE_UNCHANGED', job) }
    }
    throw new LtxJobError('LTX_WAIT_TIMEOUT_REMOTE_UNCHANGED', job)
  }
  async function resume(execution: LtxExecution): Promise<LtxJob> {
    const job = await execution.store.load(hash(execution.operationKey))
    if (!job?.id) throw new LtxJobError('LTX_SUBMISSION_REQUIRES_RECONCILIATION', job)
    return wait(job, execution)
  }
  async function download(job: LtxJob, signal?: AbortSignal): Promise<ArrayBuffer> {
    if (job.state !== 'completed' || !job.output) throw new LtxJobError('LTX_OUTPUT_NOT_READY', job)
    try {
      const bytes = await (deps.download ?? downloadMediaBytes)(outputUrl(job.output.url), {
        kind: job.output.kind === 'exr-zip' ? 'archive' : 'video', signal,
      })
      return Uint8Array.from(bytes).buffer
    } catch { throw new LtxJobError('LTX_OUTPUT_DOWNLOAD_FAILED_RESUME_SAME_JOB', job) }
  }
  return { submit, poll, wait, resume, download }
}

export const ltxV2 = createLtxClient()
export function cancelLtxJob(job: LtxJob) {
  // Aborting local wait is supported through execution.signal. No remote DELETE exists.
  return { supported: false as const, code: 'LTX_REMOTE_CANCELLATION_UNSUPPORTED', remoteStatus: job.remoteStatus, jobId: job.id, mayStillBeBilled: true }
}
export function handleLtxWebhook(): never {
  // No documented signature/endpoint contract. Never accept an unverified callback as success.
  throw new LtxJobError('LTX_WEBHOOK_UNSUPPORTED_USE_POLLING', null)
}
