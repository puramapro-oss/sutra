import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { providerRecord } from '@/lib/provider-response'
import { sunoBaseUrl } from '@/lib/suno-config'
import { publicOrigin } from '@/lib/public-origin'
import type { MusicStyle } from '@/types'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value)
}
async function responseData(res: Response, signal: AbortSignal): Promise<Record<string, unknown>> {
  const body = await providerRecord(res, signal).catch(() => { throw new Error('Suno: reponse invalide (JSON)') })
  if (body.code !== 200) {
    // No provider message, raw response, URL or credentials may cross this boundary.
    if (Number.isInteger(body.code)) throw new Error(`Suno: code fournisseur ${body.code}`)
    throw new Error('Suno: reponse invalide (id absent ou invalide)')
  }
  return record(body.data)
}

export interface SunoJobState { taskId: string }
export interface SunoJobPort {
  current?: SunoJobState | null
  /** Must commit the task ID durably before resolving; never an in-memory ACK in production. */
  onSubmitted(state: SunoJobState): Promise<void>
  timeoutMs?: number
  /** Local waiting only; SunoAPI offers no documented remote cancellation here. */
  signal?: AbortSignal
}
export class SunoJobError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  constructor(message: string, readonly taskId: string | null) {
    super(message)
    this.name = 'SunoJobError'
  }
}

/** SunoAPI is a third-party supplier, distinct from Suno's own platform API.
 * Contract: docs.sunoapi.org/suno-api/generate-music (checked 2026-10-13).
 * A submission has no documented idempotency guarantee: POST is never retried.
 * The production pipeline persists its intent before invoking this adapter.
 */
export async function generateMusic(params: {
  prompt: string
  style: MusicStyle
  duration: number
  instrumental?: boolean
}, job?: SunoJobPort): Promise<{ id: string; audio_url: string }> {
  const apiKey = requireEnv('SUNO_API_KEY', 'generation musicale SunoAPI').trim()
  const baseUrl = sunoBaseUrl()
  const timeoutMs = job?.timeoutMs ?? 120_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000
    || (job && typeof job.onSubmitted !== 'function')
    || (job?.current != null && !validId(job.current.taskId))) {
    throw new SunoJobError('Suno: contexte de reprise invalide', null)
  }
  // The caller owns the immutable intent -> task binding. Never POST on a resume.
  if (job?.current) return pollSunoJob(job.current.taskId, apiKey, baseUrl, timeoutMs, job.signal)
  const origin = publicOrigin('https://sutra.purama.dev')
  if (!origin.startsWith('https://')) throw new Error('Suno: origine callback HTTPS requise')
  const instrumental = params.instrumental ?? true
  const style = instrumental ? `${params.style}: ${params.prompt}` : params.style
  if (!Number.isFinite(params.duration) || params.duration < 10 || params.duration > 360 ||
      !params.prompt.trim() || params.prompt.length > 5000 || style.length > 1000) {
    throw new Error('Suno: parametres invalides')
  }
  const deadline = AbortSignal.timeout(30_000)
  const signal = job?.signal ? AbortSignal.any([job.signal, deadline]) : deadline
  let res: Response
  try { res = await fetchWithRetry(`${baseUrl}/generate`, {
    method: 'POST', redirect: 'error', cache: 'no-store', timeoutMs: 30_000, signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ customMode: true, instrumental, model: 'V6', style,
      ...(!instrumental ? { lyrics: params.prompt } : {}), duration: params.duration,
      callBackUrl: `${origin}/api/webhooks/suno`,
    }),
  }) } catch { throw new SunoJobError('Suno: soumission incertaine, reconciliation requise', null) }
  if (!res.ok) throw new SunoJobError(`Suno: ${await httpErrorMessage(res)}`, null)
  const data = await responseData(res, signal).catch(error => { throw new SunoJobError(error.message, null) })
  if (!validId(data.taskId)) throw new SunoJobError('Suno: reponse invalide (id absent ou invalide)', null)
  if (job) {
    try { await job.onSubmitted({ taskId: data.taskId }) }
    catch { throw new SunoJobError('Suno: checkpoint indisponible, reconciliation requise', data.taskId) }
  }
  return pollSunoJob(data.taskId, apiKey, baseUrl, timeoutMs, job?.signal)
}

async function pollSunoJob(
  taskId: string, apiKey: string, baseUrl: string, timeoutMs = 120_000, callerSignal?: AbortSignal
): Promise<{ id: string; audio_url: string }> {
  const deadline = Date.now() + timeoutMs
  const budget = AbortSignal.timeout(timeoutMs)
  const waiting = callerSignal ? AbortSignal.any([callerSignal, budget]) : budget
  try {
    while (Date.now() < deadline) {
      waiting.throwIfAborted()
      let res: Response
      const signal = AbortSignal.any([waiting, AbortSignal.timeout(Math.min(15_000, Math.max(1, deadline - Date.now())))])
      try { res = await fetch(`${baseUrl}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` }, redirect: 'error', cache: 'no-store', signal,
      }) } catch { throw new Error('Suno: suivi indisponible, reconciliation requise') }
      if (!res.ok) {
        void res.body?.cancel().catch(() => {})
        if (res.status !== 429 && res.status < 500) throw new Error(`Suno: HTTP ${res.status} (acces ou tache indisponible)`)
        await sleep(Math.min(3000, Math.max(0, deadline - Date.now())), waiting)
        continue
      }
      const data = await responseData(res, signal)
      if (data.taskId !== taskId) throw new Error('Suno: reponse invalide (tache incoherente)')
      if (data.status === 'SUCCESS') {
        const result = record(data.response)
        const song = record(Array.isArray(result.sunoData) ? result.sunoData[0] : undefined)
        let audio: URL | undefined
        try { if (typeof song.audio_url === 'string') audio = new URL(song.audio_url) } catch { /* rejected below */ }
        if (result.taskId !== taskId || !validId(song.id) || !audio || audio.protocol !== 'https:' ||
            audio.username || audio.password || audio.hash || String(song.audio_url).length > 8192) {
          throw new Error('Suno: reponse invalide (audio_url ou id absent)')
        }
        return { id: song.id, audio_url: String(song.audio_url) }
      }
      if (['CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR'].includes(String(data.status))) {
        throw new Error('Suno: generation echouee')
      }
      if (!['PENDING', 'TEXT_SUCCESS', 'FIRST_SUCCESS'].includes(String(data.status))) {
        throw new Error('Suno: reponse invalide (statut inconnu)')
      }
      await sleep(Math.min(3000, Math.max(0, deadline - Date.now())), waiting)
    }
    throw new Error('Suno: timeout, reconciliation requise')
  } catch (error) {
    // Only our own fixed diagnostics cross the boundary; aborted reasons may contain secrets.
    const message = !waiting.aborted && error instanceof Error && error.message.startsWith('Suno:')
      ? error.message : 'Suno: attente interrompue, reconciliation requise'
    throw new SunoJobError(message, taskId)
  }
}
