import { createHash } from 'node:crypto'
import { providerRecord } from './provider-response'
import {
  HIGGSFIELD_CINEMA_ENDPOINT, HIGGSFIELD_STATUSES, HiggsfieldError,
  compareHiggsfieldUsd, isHiggsfieldHttpsUrl, isHiggsfieldTerminalStatus,
  parseHiggsfieldUsd, validateHiggsfieldCinemaRequest, validateHiggsfieldIdempotencyKey,
  type HiggsfieldCinemaRequest, type HiggsfieldStatus, type HiggsfieldRequestOptions,
  type HiggsfieldCallOptions, type HiggsfieldEstimate, type HiggsfieldSubmissionOptions,
  type HiggsfieldRequestHandle, type HiggsfieldSubmissionReceipt, type HiggsfieldPollResult,
} from './higgsfield-contract'
export type {
  HiggsfieldRequestOptions, HiggsfieldCallOptions, HiggsfieldEstimate,
  HiggsfieldSubmissionIntent, HiggsfieldBudget, HiggsfieldSubmissionOptions,
  HiggsfieldRequestHandle, HiggsfieldSubmissionReceipt, HiggsfieldPollResult,
} from './higgsfield-contract'

/**
 * Server-only, NON-ROUTED adapter. No existing LTX pipeline, quota, or job journal
 * calls this module. Before routing it, the caller must atomically persist an
 * intent (key + fingerprint), reserve its budget, and persist the accepted handle.
 * In-memory quote/key guards below are NOT a durable store or a billing receipt.
 *
 * Contract: https://docs.higgsfield.ai/docs/concepts/idempotency
 * Estimates: https://docs.higgsfield.ai/docs/concepts/billing-and-retention
 */
const API_ORIGIN = 'https://api.higgsfield.ai'
// Local path-safety bound; the public API does not promise UUID-only IDs.
const REQUEST_ID = /^[A-Za-z0-9_-]{1,255}$/
const FINGERPRINT = /^[0-9a-f]{64}$/

function requireServer() {
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
    throw new HiggsfieldError('HIGGSFIELD_SERVER_ONLY')
  }
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}'
  }
  return JSON.stringify(value)
}
function requestSettings(options: HiggsfieldRequestOptions = {}) {
  const expiresAfterSeconds = options.expiresAfterSeconds
  if (expiresAfterSeconds !== undefined &&
    (!Number.isInteger(expiresAfterSeconds) || expiresAfterSeconds < 3600 || expiresAfterSeconds > 604800)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_RETENTION')
  }
  return { expiresAfterSeconds }
}
function prepare(input: unknown, options: HiggsfieldRequestOptions = {}) {
  const body = validateHiggsfieldCinemaRequest(input)
  const settings = requestSettings(options)
  // Do not inject schema defaults: omitted fields and explicit values differ for
  // provider idempotency. Array order and signed media URL strings remain intact.
  const fingerprint = createHash('sha256').update(canonical({
    endpoint: HIGGSFIELD_CINEMA_ENDPOINT,
    body,
    webhook: null,
    expiresAfterSeconds: settings.expiresAfterSeconds ?? null,
  })).digest('hex')
  return { body, fingerprint, ...settings }
}

/** Persist this fingerprint together with the caller's key before any paid POST. */
export function higgsfieldRequestFingerprint(input: unknown, options: HiggsfieldRequestOptions = {}): string {
  requireServer()
  return prepare(input, options).fingerprint
}

function requestUrl(value: unknown, requestId: string, action: 'status' | 'cancel'): string {
  if (!REQUEST_ID.test(requestId) || !isHiggsfieldHttpsUrl(value)) throw new HiggsfieldError('HIGGSFIELD_INVALID_REQUEST_HANDLE')
  const url = new URL(value)
  if (url.origin !== API_ORIGIN || url.pathname !== '/requests/' + requestId + '/' + action || url.search) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_REQUEST_HANDLE')
  }
  return url.href
}
function validateHandle(handle: HiggsfieldRequestHandle): HiggsfieldRequestHandle {
  if (!handle || typeof handle.requestId !== 'string' || !REQUEST_ID.test(handle.requestId)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_REQUEST_HANDLE')
  }
  return {
    requestId: handle.requestId,
    statusUrl: requestUrl(handle.statusUrl, handle.requestId, 'status'),
    cancelUrl: requestUrl(handle.cancelUrl, handle.requestId, 'cancel'),
  }
}
function statusValue(value: unknown): HiggsfieldStatus {
  if (typeof value !== 'string' || !HIGGSFIELD_STATUSES.includes(value as HiggsfieldStatus)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_RESPONSE')
  }
  return value as HiggsfieldStatus
}
function retryAfter(response: Response): number | undefined {
  const value = response.headers.get('retry-after')
  if (value === null || !/^\d+$/.test(value)) return undefined
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : undefined
}
function discardBody(response: Response) {
  // A remote stream's cancel hook must not extend the request deadline.
  try { void response.body?.cancel().catch(() => {}) } catch { /* No provider error text is exposed. */ }
}

export interface HiggsfieldClientOptions {
  /** Complete copied credential, without a Key/Bearer prefix. Server configuration only. */
  credentials: string
  fetch?: typeof fetch
  now?: () => number
  requestTimeoutMs?: number
  /** Local freshness policy, not a provider price guarantee. Default: one minute. */
  maxEstimateAgeMs?: number
}

export function createHiggsfieldClient(options: HiggsfieldClientOptions) {
  requireServer()
  if (!options || typeof options.credentials !== 'string' || !/^[!-~]{1,4096}$/.test(options.credentials)) {
    throw new HiggsfieldError('HIGGSFIELD_CREDENTIALS_REQUIRED')
  }
  const credentials = options.credentials
  const request = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const now = options.now ?? Date.now
  const timeoutMs = options.requestTimeoutMs ?? 30_000
  const quoteLifetimeMs = options.maxEstimateAgeMs ?? 60_000
  if (![timeoutMs, quoteLifetimeMs].every(n => Number.isSafeInteger(n) && n > 0 && n <= 3_600_000)) {
    throw new HiggsfieldError('HIGGSFIELD_INVALID_CLIENT_OPTIONS')
  }
  const quotes = new WeakSet<HiggsfieldEstimate>()
  const quoteKeys = new WeakMap<HiggsfieldEstimate, string>()
  const seenIntents = new Map<string, { fingerprint: string; requestId?: string }>()

  function clock() {
    const value = now()
    if (!Number.isSafeInteger(value) || value < 0) throw new HiggsfieldError('HIGGSFIELD_INVALID_CLOCK')
    return value
  }
  async function http(
    url: string, method: 'GET' | 'POST', operation: 'estimate' | 'submit' | 'poll' | 'cancel',
    input?: { body?: HiggsfieldCinemaRequest; idempotencyKey?: string; expiresAfterSeconds?: number; signal?: AbortSignal },
  ) {
    requireServer()
    if (input?.signal?.aborted) throw new HiggsfieldError('HIGGSFIELD_LOCAL_ABORT_REMOTE_UNCHANGED')
    const headers: Record<string, string> = { Authorization: 'Key ' + credentials }
    if (input?.body) headers['Content-Type'] = 'application/json'
    if (input?.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey
    if (input?.expiresAfterSeconds !== undefined) headers['Hf-Expires-After'] = String(input.expiresAfterSeconds)
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = input?.signal ? AbortSignal.any([timeoutSignal, input.signal]) : timeoutSignal
    let response: Response
    try {
      response = await request(url, {
        method, headers, body: input?.body ? JSON.stringify(input.body) : undefined,
        signal, cache: 'no-store', redirect: 'error', credentials: 'omit',
      })
    } catch {
      throw new HiggsfieldError('HIGGSFIELD_NETWORK_ERROR', { submissionUncertain: operation === 'submit' })
    }
    let redirected = response.redirected
    if (response.url) {
      try { redirected ||= new URL(response.url).origin !== API_ORIGIN }
      catch { redirected = true }
    }
    if (redirected) {
      discardBody(response)
      throw new HiggsfieldError('HIGGSFIELD_REDIRECT_REJECTED', { submissionUncertain: operation === 'submit' })
    }
    if (!response.ok) {
      const details = {
        httpStatus: response.status,
        submissionUncertain: operation === 'submit' && ![400, 401, 403, 404, 422, 429].includes(response.status),
        retryAfterSeconds: retryAfter(response),
      }
      discardBody(response)
      throw new HiggsfieldError('HIGGSFIELD_HTTP_ERROR', details)
    }
    return { response, signal }
  }
  async function json(response: Response, signal: AbortSignal, submissionUncertain = false) {
    try {
      // Reuse the existing 64 KiB bounded reader; the HTTP deadline also covers
      // body consumption and streams that ignore the fetch signal.
      return await providerRecord(response, signal)
    } catch { /* Do not expose parser errors or response bodies. */ }
    throw new HiggsfieldError('HIGGSFIELD_INVALID_RESPONSE', { submissionUncertain })
  }

  async function estimate(input: unknown, execution: HiggsfieldCallOptions = {}): Promise<HiggsfieldEstimate> {
    const prepared = prepare(input, execution)
    const { response, signal } = await http(API_ORIGIN + '/estimate/' + HIGGSFIELD_CINEMA_ENDPOINT, 'POST', 'estimate', {
      body: prepared.body, signal: execution.signal,
    })
    if (response.status !== 200) {
      discardBody(response)
      throw new HiggsfieldError('HIGGSFIELD_INVALID_ESTIMATE_RESPONSE', { httpStatus: response.status })
    }
    const data = await json(response, signal)
    let usd: string
    try { usd = parseHiggsfieldUsd(data.usd) }
    catch { throw new HiggsfieldError('HIGGSFIELD_INVALID_ESTIMATE_RESPONSE') }
    const issuedAtMs = clock()
    const quote: HiggsfieldEstimate = Object.freeze({
      kind: 'estimate', currency: 'USD', usd, fingerprint: prepared.fingerprint,
      issuedAtMs, expiresAtMs: issuedAtMs + quoteLifetimeMs, actualUsd: null,
    })
    quotes.add(quote)
    return quote
  }

  async function submit(input: unknown, execution: HiggsfieldSubmissionOptions): Promise<HiggsfieldSubmissionReceipt> {
    requireServer()
    if (!execution?.budget) throw new HiggsfieldError('HIGGSFIELD_BUDGET_REQUIRED')
    if (execution.budget.approved !== true) throw new HiggsfieldError('HIGGSFIELD_BUDGET_NOT_AUTHORIZED')
    let budgetUsd: string
    try { budgetUsd = parseHiggsfieldUsd(execution.budget.maxUsd) }
    catch { throw new HiggsfieldError('HIGGSFIELD_INVALID_BUDGET') }
    const prepared = prepare(input, execution)
    const quote = execution.estimate
    // Quotes cannot be accepted from browser JSON, forged, or reused after a
    // process restart. Re-estimate after restart; keep the persisted key/intent.
    if (!quote || !quotes.has(quote)) throw new HiggsfieldError('HIGGSFIELD_ESTIMATE_REQUIRED')
    if (quote.fingerprint !== prepared.fingerprint) throw new HiggsfieldError('HIGGSFIELD_ESTIMATE_MISMATCH')
    const time = clock()
    if (time < quote.issuedAtMs || time >= quote.expiresAtMs) throw new HiggsfieldError('HIGGSFIELD_ESTIMATE_EXPIRED')
    if (compareHiggsfieldUsd(quote.usd, budgetUsd) > 0) throw new HiggsfieldError('HIGGSFIELD_BUDGET_EXCEEDED')
    if (!execution.intent || !FINGERPRINT.test(execution.intent.fingerprint) ||
      execution.intent.fingerprint !== prepared.fingerprint) {
      throw new HiggsfieldError('HIGGSFIELD_DURABLE_INTENT_REQUIRED')
    }
    const key = validateHiggsfieldIdempotencyKey(execution.intent.idempotencyKey)
    const known = seenIntents.get(key)
    if (known && known.fingerprint !== prepared.fingerprint) throw new HiggsfieldError('HIGGSFIELD_IDEMPOTENCY_CONFLICT')
    const quoteKey = quoteKeys.get(quote)
    if (quoteKey && quoteKey !== key) throw new HiggsfieldError('HIGGSFIELD_ESTIMATE_ALREADY_USED')
    if (execution.signal?.aborted) throw new HiggsfieldError('HIGGSFIELD_LOCAL_ABORT_REMOTE_UNCHANGED')
    const intent: { fingerprint: string; requestId?: string } = known ?? { fingerprint: prepared.fingerprint }
    seenIntents.set(key, intent)
    quoteKeys.set(quote, key)
    // One transport attempt only. The caller may explicitly replay this exact
    // persisted intent after reconciliation; this adapter never creates a key.
    const { response, signal } = await http(API_ORIGIN + '/' + HIGGSFIELD_CINEMA_ENDPOINT, 'POST', 'submit', {
      body: prepared.body, idempotencyKey: key,
      expiresAfterSeconds: prepared.expiresAfterSeconds, signal: execution.signal,
    })
    const data = await json(response, signal, true)
    const requestId = typeof data.request_id === 'string' && REQUEST_ID.test(data.request_id) ? data.request_id : undefined
    try {
      if ((response.status !== 200 && response.status !== 202) || !requestId) throw new Error('invalid receipt')
      const status = statusValue(data.status)
      const handle = validateHandle({
        requestId, statusUrl: data.status_url as string, cancelUrl: data.cancel_url as string,
      })
      const expiresAfter = data.expires_after
      if (expiresAfter !== undefined && (!Number.isInteger(expiresAfter) ||
        Number(expiresAfter) < 3600 || Number(expiresAfter) > 604800)) throw new Error('invalid retention')
      if (intent.requestId && intent.requestId !== requestId) throw new Error('changed request identity')
      intent.requestId = requestId
      return Object.freeze({
        ...handle, status, fingerprint: prepared.fingerprint,
        expiresAfterSeconds: expiresAfter === undefined ? null : Number(expiresAfter),
      })
    } catch {
      throw new HiggsfieldError('HIGGSFIELD_INVALID_SUBMISSION_RESPONSE', {
        submissionUncertain: true, httpStatus: response.status, requestId,
      })
    }
  }

  /** One read only; the caller schedules backoff and persists results. Never submits. */
  async function poll(original: HiggsfieldRequestHandle, execution: { signal?: AbortSignal } = {}): Promise<HiggsfieldPollResult> {
    const handle = validateHandle(original)
    const { response, signal } = await http(handle.statusUrl, 'GET', 'poll', { signal: execution.signal })
    if (response.status !== 200) {
      discardBody(response)
      throw new HiggsfieldError('HIGGSFIELD_INVALID_POLL_RESPONSE', { httpStatus: response.status })
    }
    const data = await json(response, signal)
    try {
      if (data.request_id !== handle.requestId) throw new Error('request identity mismatch')
      const status = statusValue(data.status)
      if (data.status_url !== undefined) requestUrl(data.status_url, handle.requestId, 'status')
      if (data.cancel_url !== undefined) requestUrl(data.cancel_url, handle.requestId, 'cancel')
      const expiresAt = data.expires_at
      if (expiresAt !== undefined && expiresAt !== null &&
        (typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)))) throw new Error('invalid expiry')
      let videoUrl: string | null = null
      if (status === 'completed') {
        const video = record(data.video)
        if (!video || !isHiggsfieldHttpsUrl(video.url)) throw new Error('missing video')
        videoUrl = video.url
      }
      return Object.freeze({
        requestId: handle.requestId, status, terminal: isHiggsfieldTerminalStatus(status),
        videoUrl, expiresAt: expiresAt == null ? null : expiresAt as string,
      })
    } catch {
      throw new HiggsfieldError('HIGGSFIELD_INVALID_POLL_RESPONSE', { requestId: handle.requestId })
    }
  }

  /** The API accepts cancellation only while queued. Poll again to reconcile. */
  async function cancel(original: HiggsfieldRequestHandle, execution: { signal?: AbortSignal } = {}) {
    const handle = validateHandle(original)
    const { response } = await http(handle.cancelUrl, 'POST', 'cancel', { signal: execution.signal })
    if (response.status !== 202) {
      discardBody(response)
      throw new HiggsfieldError('HIGGSFIELD_INVALID_CANCEL_RESPONSE', { httpStatus: response.status })
    }
    discardBody(response)
    return Object.freeze({ requestId: handle.requestId, acknowledged: true, needsStatusCheck: true } as const)
  }

  // No automatic retry, wait loop, webhook receiver, output download, or deletion.
  // The existing durable media pipeline must own those lifecycle decisions.
  return { estimate, submit, poll, cancel }
}
