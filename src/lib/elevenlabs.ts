import { fetchWithRetry } from '@/lib/utils/api'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!

export async function generateVoice(params: {
  text: string
  voice_id: string
  model_id?: string
  stability?: number
  similarity_boost?: number
}): Promise<ArrayBuffer> {
  const res = await fetchWithRetry(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voice_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: params.text,
        model_id: params.model_id ?? 'eleven_flash_v2_5',
        voice_settings: {
          stability: params.stability ?? 0.5,
          similarity_boost: params.similarity_boost ?? 0.75,
        },
      }),
    }
  )

  if (!res.ok) throw new Error(`ElevenLabs: ${res.status} ${res.statusText}`)
  return res.arrayBuffer()
}

export async function cloneVoice(params: {
  name: string
  audioFile: Buffer
  description?: string
}): Promise<string> {
  const form = new FormData()
  form.append('name', params.name)
  form.append('files', new Blob([new Uint8Array(params.audioFile)]), 'voice_sample.mp3')
  if (params.description) form.append('description', params.description)

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: form,
  })
  const data = await res.json()
  return data.voice_id
}

export async function listVoices(): Promise<
  Array<{ voice_id: string; name: string; preview_url: string | null }>
> {
  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  })
  const data = await res.json()
  return data.voices
}
