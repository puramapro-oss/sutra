import { fetchWithRetry, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'

// Clé lue à l'appel (jamais au top-level) : erreur explicite si absente
// au lieu d'un crash à l'import, et aucun secret dans les messages.

export async function generateVoice(params: {
  text: string
  voice_id: string
  model_id?: string
  stability?: number
  similarity_boost?: number
}): Promise<ArrayBuffer> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY', 'synthese vocale ElevenLabs')

  const res = await fetchWithRetry(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voice_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
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

  if (!res.ok) {
    throw new Error(`ElevenLabs TTS: ${await httpErrorMessage(res)}`)
  }
  return res.arrayBuffer()
}

export async function cloneVoice(params: {
  name: string
  audioFile: Buffer
  description?: string
}): Promise<string> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY', 'clonage de voix ElevenLabs')

  const form = new FormData()
  form.append('name', params.name)
  form.append('files', new Blob([new Uint8Array(params.audioFile)]), 'voice_sample.mp3')
  if (params.description) form.append('description', params.description)

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    throw new Error(`ElevenLabs clonage: ${await httpErrorMessage(res)}`)
  }
  const data = (await res.json()) as { voice_id?: string }
  if (!data.voice_id) {
    throw new Error('ElevenLabs clonage: reponse invalide (voice_id absent)')
  }
  return data.voice_id
}

export async function listVoices(): Promise<
  Array<{ voice_id: string; name: string; preview_url: string | null }>
> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY', 'liste des voix ElevenLabs')

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 3_600 },
  })
  if (!res.ok) {
    throw new Error(`ElevenLabs voix: ${await httpErrorMessage(res)}`)
  }
  const data = (await res.json()) as { voices?: Array<{ voice_id: string; name: string; preview_url: string | null }> }
  if (!Array.isArray(data.voices)) {
    throw new Error('ElevenLabs voix: reponse invalide (voices[] absent)')
  }
  return data.voices
}
