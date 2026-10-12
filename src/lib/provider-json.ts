/** Provider metadata is bounded independently from media downloads. */
export async function boundedProviderJson(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('SUTRA_PROVIDER_INVALID_JSON')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 65_536) throw new Error('SUTRA_PROVIDER_INVALID_JSON')
      chunks.push(value)
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('SUTRA_PROVIDER_INVALID_JSON')
    return data as Record<string, unknown>
  } finally { await reader.cancel().catch(() => {}) }
}
