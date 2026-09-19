import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv, optionalEnv } from '@/lib/env'
import type { MusicStyle } from '@/types'

export async function generateMusic(params: {
  prompt: string
  style: MusicStyle
  duration: number
  instrumental?: boolean
}): Promise<{ id: string; audio_url: string }> {
  const apiKey = requireEnv('SUNO_API_KEY', 'generation musicale Suno')
  const baseUrl = optionalEnv('SUNO_BASE_URL', 'https://api.suno.ai/v1')

  const res = await fetchWithRetry(`${baseUrl}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      tags: params.style,
      duration: params.duration,
      make_instrumental: params.instrumental ?? true,
    }),
  })

  if (!res.ok) {
    throw new Error(`Suno: ${await httpErrorMessage(res)}`)
  }
  const data = (await res.json()) as { id?: string; error?: string }
  if (!data.id) throw new Error(`Suno: ${data.error ?? 'reponse invalide (id absent)'}`)
  return pollSunoJob(data.id, apiKey, baseUrl)
}

async function pollSunoJob(
  songId: string,
  apiKey: string,
  baseUrl: string,
  timeoutMs = 120_000
): Promise<{ id: string; audio_url: string }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${baseUrl}/songs/${songId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      // 401/403 = clé invalide → abandon immédiat plutôt que boucler 2 min.
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Suno: HTTP ${res.status} (cle ou acces invalide)`)
      }
      await sleep(3000)
      continue
    }
    const data = (await res.json()) as {
      id?: string
      status?: string
      audio_url?: string
    }
    if (data.status === 'completed') {
      if (!data.audio_url || !data.id) throw new Error('Suno: reponse invalide (audio_url absent)')
      return { id: data.id, audio_url: data.audio_url }
    }
    if (data.status === 'failed') throw new Error('Suno: generation echouee')
    await sleep(3000)
  }
  throw new Error('Suno: timeout')
}
