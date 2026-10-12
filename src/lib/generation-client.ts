/** 202 acknowledges durable work; only a done receipt means completed media. */
export async function awaitJobResult(response: Response, signal: AbortSignal,
  io = { fetch: ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)), delay: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)) }) {
  let result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Generation indisponible')
  if (response.status === 202) {
    if (!result.jobId) throw new Error('Identifiant de tache manquant')
    const jobId = result.jobId
    for (let attempt = 0; attempt < 120; attempt++) {
      signal.throwIfAborted()
      await io.delay(5000)
      signal.throwIfAborted()
      const status = await io.fetch(`/api/video/status/${encodeURIComponent(jobId)}`, { signal, cache: 'no-store' })
      result = await status.json()
      if (!status.ok) throw new Error('Suivi indisponible. La tache reste dans la bibliotheque.')
      if (result.status === 'done') break
      if (!['queued', 'processing'].includes(result.status)) throw new Error('Generation interrompue ou a reconcilier. Consulte la bibliotheque.')
    }
    if (result.status !== 'done') throw new Error('Generation toujours en cours. Consulte la bibliotheque.')
  }
  return result
}

export async function awaitGeneration(response: Response, signal: AbortSignal, io?: Parameters<typeof awaitJobResult>[2]): Promise<string> {
  const result = await awaitJobResult(response, signal, io)
  const id = result.video?.id ?? result.videoId
  if (typeof id !== 'string' || !id) throw new Error('Identifiant video manquant')
  return id
}
