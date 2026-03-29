import { fetchWithRetry, sleep } from '@/lib/utils/api'
import type { MusicStyle } from '@/types'

const SUNO_API_KEY = process.env.SUNO_API_KEY!
const SUNO_BASE_URL = process.env.SUNO_BASE_URL ?? 'https://api.suno.ai/v1'

export async function generateMusic(params: {
  prompt: string
  style: MusicStyle
  duration: number
  instrumental?: boolean
}): Promise<{ id: string; audio_url: string }> {
  const res = await fetchWithRetry(`${SUNO_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUNO_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      tags: params.style,
      duration: params.duration,
      make_instrumental: params.instrumental ?? true,
    }),
  })

  const data = await res.json()
  if (!data.id) throw new Error(`Suno: ${data.error ?? 'echec generation'}`)
  return pollSunoJob(data.id)
}

async function pollSunoJob(
  songId: string,
  timeoutMs = 120_000
): Promise<{ id: string; audio_url: string }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${SUNO_BASE_URL}/songs/${songId}`, {
      headers: { Authorization: `Bearer ${SUNO_API_KEY}` },
    })
    const data = await res.json()
    if (data.status === 'completed') return { id: data.id, audio_url: data.audio_url }
    if (data.status === 'failed') throw new Error('Suno: generation echouee')
    await sleep(3000)
  }
  throw new Error('Suno: timeout')
}
