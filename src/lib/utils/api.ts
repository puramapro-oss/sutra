// Bounded HTTP retries. A key alone never proves that a provider deduplicates.
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', abort); resolve() }
    const timer = setTimeout(finish, ms)
    const abort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason ?? new Error('Requete annulee'))
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}

interface BreakerState { failures: number; openedAt: number }
const BREAKER_THRESHOLD = 5
const BREAKER_COOLDOWN_MS = 60_000
const breakers = new Map<string, BreakerState>()

function breakerKey(url: string): string {
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error()
    return parsed.origin // Never log query strings, credentials or paths.
  } catch { throw new Error('SUTRA_HTTP_INVALID_URL') }
}

export function isHostHealthy(url: string): boolean {
  const key = breakerKey(url)
  const state = breakers.get(key)
  if (!state || state.failures < BREAKER_THRESHOLD) return true
  if (Date.now() - state.openedAt > BREAKER_COOLDOWN_MS) {
    breakers.delete(key)
    return true
  }
  return false
}

function recordHostFailure(url: string): void {
  const key = breakerKey(url)
  const state = breakers.get(key) ?? { failures: 0, openedAt: 0 }
  state.failures++
  if (state.failures === BREAKER_THRESHOLD) state.openedAt = Date.now()
  breakers.set(key, state)
}

export function getBreakerStatus(): Array<{ origin: string; failures: number; open: boolean }> {
  return [...breakers.entries()].map(([origin, state]) => ({
    origin, failures: state.failures,
    open: state.failures >= BREAKER_THRESHOLD && Date.now() - state.openedAt <= BREAKER_COOLDOWN_MS,
  }))
}

/** Response bodies/statusText can echo secrets. Do not read or log them. */
export async function httpErrorMessage(res: Response): Promise<string> {
  return `HTTP ${res.status}`
}

export interface FetchOptions extends RequestInit {
  idempotencyKey?: string
  /** Opt in only after verifying this exact provider endpoint's contract. */
  providerSupportsIdempotency?: boolean
  /** Total budget, including retries/backoff; caller cancellation still wins. */
  timeoutMs?: number
}

export async function fetchWithRetry(url: string, options: FetchOptions, maxRetries = 3): Promise<Response> {
  const { idempotencyKey, providerSupportsIdempotency = false, timeoutMs, ...init } = options
  init.signal?.throwIfAborted()
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) {
    throw new Error('SUTRA_HTTP_INVALID_ATTEMPTS')
  }
  // Preserve existing long provider deadlines, with a finite upper bound.
  const budget = timeoutMs ?? (init.signal ? 600_000 : 30_000)
  if (!Number.isInteger(budget) || budget < 1 || budget > 600_000) {
    throw new Error('SUTRA_HTTP_INVALID_TIMEOUT')
  }
  const origin = breakerKey(url)
  if (!isHostHealthy(url)) throw new Error(`Service temporairement indisponible (circuit ouvert) : ${origin}`)
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (idempotencyKey !== undefined) {
    if (!idempotencyKey.trim() || idempotencyKey.length > 256) throw new Error('SUTRA_HTTP_INVALID_IDEMPOTENCY_KEY')
    const existing = headers.get('Idempotency-Key')
    if (existing !== null && existing !== idempotencyKey) throw new Error('SUTRA_HTTP_CONFLICTING_IDEMPOTENCY_KEY')
    headers.set('Idempotency-Key', idempotencyKey)
  }
  const streaming = init.body != null && typeof (init.body as { getReader?: unknown }).getReader === 'function'
  const retryAllowed = !streaming && (
    method === 'GET' || method === 'HEAD' || (Boolean(idempotencyKey) && providerSupportsIdempotency)
  )
  // Historical argument counts attempts, not extra retries. Zero means one try.
  const attempts = retryAllowed ? Math.max(1, maxRetries) : 1
  const deadline = AbortSignal.timeout(budget)
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline

  for (let attempt = 0; attempt < attempts; attempt++) {
    signal.throwIfAborted()
    let response: Response
    try { response = await fetch(url, { ...init, headers, signal }) }
    catch (error) {
      // User cancellation/deadline must never trigger another submission.
      if (signal.aborted) throw signal.reason
      if (attempt === attempts - 1) {
        recordHostFailure(url)
        throw new Error(`Echec reseau : ${origin}`, { cause: error })
      }
      await sleep(2 ** attempt * 1000 + Math.random() * 400, signal)
      continue
    }
    if (response.status < 500) {
      if (response.status !== 429) breakers.delete(origin)
      return response // Includes 4xx/429: do not resubmit a chargeable request.
    }
    // Release discarded bodies instead of retaining connections on each retry.
    try { await response.body?.cancel() } catch { /* already consumed */ }
    if (attempt < attempts - 1) await sleep(2 ** attempt * 1000 + Math.random() * 400, signal)
  }
  recordHostFailure(url)
  throw new Error(`Echec apres ${attempts} tentative(s) : ${origin}`)
}
