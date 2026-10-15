import { createVideoSchema } from '@/lib/validators'
import { productionJobId } from '@/lib/production-intent-client'

export type CreateIntent = {
  version: 1
  userId: string
  requestId: string
  body: string
  jobId?: string
  cancelRequested: boolean
}

export const createIntentKey = (userId: string) => `sutra:create-intent:v1:${userId}`

/** Owner and tab scoped receipt. Reading it never submits a generation. */
export function readCreateIntent(userId: string): CreateIntent | null {
  const raw = sessionStorage.getItem(createIntentKey(userId))
  if (!raw) return null
  const value = JSON.parse(raw) as CreateIntent
  if (value.version !== 1 || value.userId !== userId || !productionJobId(value.requestId) ||
    typeof value.body !== 'string' || !createVideoSchema.safeParse(JSON.parse(value.body)).success ||
    typeof value.cancelRequested !== 'boolean' || (value.jobId !== undefined && !productionJobId(value.jobId))) {
    throw new Error('Recu de creation invalide')
  }
  return value
}

export function saveCreateIntent(userId: string, intent: CreateIntent | null) {
  if (intent) sessionStorage.setItem(createIntentKey(userId), JSON.stringify(intent))
  else sessionStorage.removeItem(createIntentKey(userId))
}

/** Return only fixed classification markers, never server/provider diagnostics. */
export function createFailureNotice(status: number, body: Record<string, unknown>): string | undefined {
  const code = typeof body.code === 'string' ? body.code : body.error
  if (status === 402 || (status === 403 && code === 'SUTRA_GENERATION_FAILED') ||
    ['SUTRA_QUOTA_EXHAUSTED', 'SALAD_ESTIMATE_EXCEEDS_BUDGET', 'SALAD_STALE_QUOTE'].includes(String(code))) {
    return 'Quota ou budget atteint.'
  }
  if (code === 'SALAD_UNSUPPORTED_PROFILE' || code === 'SALAD_UNSUPPORTED_OPERATION') return 'SALAD_UNSUPPORTED_PROFILE'
  if (['SUTRA_LOCAL_NOT_CONFIGURED', 'SUTRA_LOCAL_FAILED', 'SUTRA_SALAD_NOT_CONFIGURED',
    'SUTRA_SALAD_DISABLED', 'SUTRA_SALAD_UNAVAILABLE', 'SALAD_DISABLED', 'SALAD_INVALID_CONFIG',
    'SALAD_NOT_QUALIFIED', 'SALAD_CAPABILITIES_UNREACHABLE', 'SALAD_CAPABILITIES_HTTP',
    'SALAD_ENGINE_BUSY'].includes(String(code))) return 'SALAD_UNAVAILABLE'
  return undefined
}
