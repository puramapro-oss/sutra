import { SaladError } from './contracts'
export type Fetcher = typeof fetch

// Abort applies to headers AND body (also for injected streams that ignore fetch's signal).
export async function boundedBytes(response: Response, limit: number, signal: AbortSignal): Promise<Buffer> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await response.body?.cancel().catch(() => {})
    throw new SaladError('SALAD_BODY_LIMIT')
  }
  if (!response.body) throw new SaladError('SALAD_EMPTY_BODY')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new SaladError('SALAD_BODY_LIMIT')
      chunks.push(value)
    }
    return Buffer.concat(chunks, size)
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
export async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new SaladError('SALAD_CONTENT_TYPE')
  try { return JSON.parse((await boundedBytes(response, 65536, signal)).toString('utf8')) }
  catch { throw new SaladError('SALAD_INVALID_JSON') }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}
