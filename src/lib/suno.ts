import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { boundedProviderJson } from '@/lib/provider-json'
import { sunoBaseUrl } from '@/lib/suno-config'
import { publicOrigin } from '@/lib/public-origin'
import type { MusicStyle } from '@/types'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value)
}
async function responseData(res: Response): Promise<Record<string, unknown>> {
  const body = await boundedProviderJson(res).catch(() => { throw new Error('Suno: reponse invalide (JSON)') })
  if (body.code !== 200) {
    // No provider message, raw response, URL or credentials may cross this boundary.
    if (Number.isInteger(body.code)) throw new Error(`Suno: code fournisseur ${body.code}`)
    throw new Error('Suno: reponse invalide (id absent ou invalide)')
  }
  return record(body.data)
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
}): Promise<{ id: string; audio_url: string }> {
  const apiKey = requireEnv('SUNO_API_KEY', 'generation musicale SunoAPI').trim()
  const baseUrl = sunoBaseUrl()
  const origin = publicOrigin('https://sutra.purama.dev')
  if (!origin.startsWith('https://')) throw new Error('Suno: origine callback HTTPS requise')
  const instrumental = params.instrumental ?? true
  const style = instrumental ? `${params.style}: ${params.prompt}` : params.style
  if (!Number.isFinite(params.duration) || params.duration < 10 || params.duration > 360 ||
      !params.prompt.trim() || params.prompt.length > 5000 || style.length > 1000) {
    throw new Error('Suno: parametres invalides')
  }
  const res = await fetchWithRetry(`${baseUrl}/generate`, {
    method: 'POST', redirect: 'error', timeoutMs: 30_000,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ customMode: true, instrumental, model: 'V6', style,
      ...(!instrumental ? { lyrics: params.prompt } : {}), duration: params.duration,
      callBackUrl: `${origin}/api/webhooks/suno`,
    }),
  })
  if (!res.ok) throw new Error(`Suno: ${await httpErrorMessage(res)}`)
  const data = await responseData(res)
  if (!validId(data.taskId)) throw new Error('Suno: reponse invalide (id absent ou invalide)')
  return pollSunoJob(data.taskId, apiKey, baseUrl)
}

async function pollSunoJob(
  taskId: string, apiKey: string, baseUrl: string, timeoutMs = 120_000
): Promise<{ id: string; audio_url: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let res: Response
    try { res = await fetch(`${baseUrl}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, redirect: 'error',
      signal: AbortSignal.timeout(Math.min(15_000, Math.max(1, deadline - Date.now()))),
    }) } catch { throw new Error('Suno: suivi indisponible, reconciliation requise') }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`Suno: HTTP ${res.status} (cle ou acces invalide)`)
      await sleep(Math.min(3000, Math.max(0, deadline - Date.now())))
      continue
    }
    const data = await responseData(res)
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
    await sleep(Math.min(3000, Math.max(0, deadline - Date.now())))
  }
  throw new Error('Suno: timeout, reconciliation requise')
}
