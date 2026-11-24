/** Explicit response budget including the body, even for streams ignoring fetch's signal.
 * No provider body or transport diagnostic appears in thrown errors.
 */
export async function providerBytes(response: Response, signal: AbortSignal, limit: number): Promise<Buffer> {
  const length = response.headers.get('content-length')
  if (!response.body || (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))) {
    void response.body?.cancel().catch(() => {})
    throw new Error('PROVIDER_BODY_LIMIT')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    for (;;) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error()
      chunks.push(value)
    }
    if (!size) throw new Error()
    return Buffer.concat(chunks, size)
  } catch { throw new Error('PROVIDER_BODY_UNAVAILABLE') }
  finally {
    signal.removeEventListener('abort', abort)
    // A hostile source may never settle cancel(); do not extend the response budget.
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function providerRecord(response: Response, signal: AbortSignal, limit = 65536): Promise<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse((await providerBytes(response, signal, limit)).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch { throw new Error('PROVIDER_INVALID_JSON') }
}
