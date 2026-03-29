export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok || res.status < 500) return res
      if (attempt < maxRetries - 1) await sleep(Math.pow(2, attempt) * 1000)
    } catch (e) {
      if (attempt === maxRetries - 1) throw e
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
  throw new Error(`Echec apres ${maxRetries} tentatives : ${url}`)
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
