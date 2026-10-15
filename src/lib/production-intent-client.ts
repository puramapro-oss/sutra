import { productionSchema } from '@/lib/production-schema'

export type DurableStep = 'script' | 'video' | 'voice' | 'music' | 'assembly' | 'all'
export type ProductionIntent = {
  version: 1
  userId: string
  requestId: string
  step: DurableStep
  body: string
  jobId?: string
  cancelRequested: boolean
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const productionIntentKey = (userId: string) => `sutra:production-intent:v1:${userId}`

/** Tab-scoped recovery; no auth token, no automatic replay on mount. */
export function readProductionIntent(userId: string): ProductionIntent | null {
  const raw = sessionStorage.getItem(productionIntentKey(userId))
  if (!raw) return null
  const value = JSON.parse(raw) as ProductionIntent
  const body = productionSchema.safeParse(JSON.parse(value.body))
  if (value.version !== 1 || value.userId !== userId || !uuid.test(value.requestId) ||
    !body.success || body.data.requestId !== value.requestId || body.data.step !== value.step ||
    !['script', 'video', 'voice', 'music', 'assembly', 'all'].includes(value.step) ||
    typeof value.cancelRequested !== 'boolean' || (value.jobId !== undefined && !uuid.test(value.jobId))) {
    throw new Error('Reçu de production illisible. Contacte le support avant de relancer.')
  }
  return value
}

export function saveProductionIntent(userId: string, intent: ProductionIntent | null) {
  if (intent) sessionStorage.setItem(productionIntentKey(userId), JSON.stringify(intent))
  else sessionStorage.removeItem(productionIntentKey(userId))
}

/** Deadline covers both headers and body; a timeout never proves a remote failure. */
export async function requestClientJson(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (init.signal?.aborted) controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Réponse non confirmée.')
    return { ok: response.ok, status: response.status, body: body as Record<string, unknown> }
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

export function productionJobId(value: unknown): string | undefined {
  return typeof value === 'string' && uuid.test(value) ? value : undefined
}

export function waitForProductionStatus(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Suivi interrompu')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 5000)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}
