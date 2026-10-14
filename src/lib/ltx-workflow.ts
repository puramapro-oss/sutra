import { fetchWithRetry, sleep } from './utils/api'
import { createHash } from 'node:crypto'
import { requireEnv } from './env'
import { downloadVideoBytes } from './media-download'
const LTX_BASE = 'https://api.ltx.io/v2'
const LTX_TIMEOUT = 180_000
export interface LtxJobState {
  endpoint: string
  fingerprint: string
  started: true
  id?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  v2?: import('./ltx-v2').LtxJob
  requestId?: string
  salad?: import('./salad/contracts').Job
}
export interface LtxJobPersistence {
  current?: LtxJobState
  save: (state: LtxJobState) => Promise<void>
  /** Shared identity for wrappers of one scene in the same lease-owned steps. */
  readonly serializationKey?: object
  readonly operationKey?: string
}
export class LtxJobError extends Error {
  constructor(message: string, readonly jobId?: string) { super(message); this.name = 'LtxJobError' }
}

const journalScopes = new WeakMap<Record<string, unknown>, Map<string, object>>()

/** Store intent BEFORE the non-idempotent POST and ID BEFORE polling/downloading.
 * Each wrapper retains its own lease-fenced callback, but reads the current slot
 * and shares serialization with other wrappers of that slot in this worker. */
export function durableLtxJob(steps: Record<string, unknown>, key: string,
  checkpoint?: (key: string, value: unknown) => Promise<void>): LtxJobPersistence {
  let scopes = journalScopes.get(steps)
  if (!scopes) { scopes = new Map(); journalScopes.set(steps, scopes) }
  let serializationKey = scopes.get(key)
  if (!serializationKey) { serializationKey = {}; scopes.set(key, serializationKey) }
  return {
    serializationKey,
    operationKey: key,
    get current() { return steps[key] as LtxJobState | undefined },
    set current(state) { steps[key] = state },
    async save(state) {
      if (!checkpoint) throw new LtxJobError('SUTRA_LTX_DURABLE_CHECKPOINT_REQUIRED')
      await checkpoint(key, state)
      steps[key] = state
    },
  }
}

function validJobId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
}

async function ltxJson(response: Response): Promise<Record<string, unknown>> {
  // Provider JSON is small. A proxy returning a file/HTML must not be buffered indefinitely.
  const reader = response.body?.getReader()
  if (!reader) throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 65_536) throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE')
      chunks.push(value)
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data as Record<string, unknown>
  } catch { throw new LtxJobError('SUTRA_LTX_INVALID_RESPONSE') }
  finally { await reader.cancel().catch(() => {}) }
}

// ---------------------------------------------------------------------------
// Core API calls
// ---------------------------------------------------------------------------

export async function resumeLegacyLtx(
  endpoint: string,
  body: Record<string, unknown>,
  persistence?: LtxJobPersistence,
): Promise<ArrayBuffer> {
  if (!persistence?.current?.id) throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: legacy job ID required')
  const apiKey = requireEnv('LTX_API_KEY', 'generation video LTX (plans payants)')
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  let state: LtxJobState = persistence?.current ?? { endpoint, fingerprint, started: true }
  if (state.endpoint !== endpoint || state.fingerprint !== fingerprint) throw new LtxJobError('SUTRA_LTX_RESUME_CONFLICT')
  if (persistence?.current && !validJobId(state.id)) throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: LTX soumis sans identifiant confirme')
  if (state.status === 'failed') throw new LtxJobError('SUTRA_LTX_JOB_FAILED', state.id)
  const save = async (next: LtxJobState) => {
    await persistence?.save(next)
    if (persistence) persistence.current = next
    state = next
  }
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
  const signal = AbortSignal.timeout(LTX_TIMEOUT)
  try {
    while (true) {
      const response = await fetchWithRetry(`${LTX_BASE}${endpoint}/${encodeURIComponent(state.id!)}`, {
        method: 'GET', headers, redirect: 'error', signal, timeoutMs: 30_000,
      }, 3)
      if (!response.ok) throw new LtxJobError(`SUTRA_LTX_POLL_HTTP_${response.status}`, state.id)
      const data = await ltxJson(response)
      if (data.id !== state.id || !['pending', 'processing', 'completed', 'failed'].includes(String(data.status))) {
        throw new LtxJobError('SUTRA_LTX_INVALID_JOB_STATUS', state.id)
      }
      if (data.status !== state.status) await save({ ...state, status: data.status as LtxJobState['status'] })
      if (data.status === 'failed') throw new LtxJobError('SUTRA_LTX_JOB_FAILED', state.id)
      if (data.status === 'completed') {
        const result = data.result as { video_url?: unknown } | undefined
        if (typeof result?.video_url !== 'string') throw new LtxJobError('SUTRA_LTX_MISSING_OUTPUT', state.id)
        const bytes = await downloadVideoBytes(result.video_url)
        return Uint8Array.from(bytes).buffer
      }
      await sleep(5_000 + Math.random() * 1_000, signal)
    }
  } catch (error) {
    if (error instanceof LtxJobError) throw error
    // No prompt, URL, credential or provider response is exposed in errors.
    throw new LtxJobError('SUTRA_RECONCILIATION_REQUIRED: generation LTX interrompue', state.id)
  }
}
