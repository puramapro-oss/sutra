import { fetchWithRetry, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'
import { providerBytes, providerRecord } from '@/lib/provider-response'

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
  const signal = AbortSignal.timeout(30_000)

  const res = await fetchWithRetry(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voice_id}`,
    {
      method: 'POST',
      redirect: 'error', cache: 'no-store', signal, timeoutMs: 30_000,
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
  if (res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'audio/mpeg') {
    void res.body?.cancel().catch(() => {})
    throw new Error('ElevenLabs INVALID_AUDIO')
  }
  // MP3 is the documented default. This local transport cap is not a provider quota.
  const bytes = await providerBytes(res, signal, 32 * 1024 * 1024)
    .catch(() => { throw new Error('ElevenLabs INVALID_AUDIO') })
  return Uint8Array.from(bytes).buffer
}

export async function cloneVoice(params: {
  name: string
  audioFile: Buffer
  description?: string
}): Promise<string> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY', 'clonage de voix ElevenLabs')
  const signal = AbortSignal.timeout(60_000)

  const form = new FormData()
  form.append('name', params.name)
  form.append('files', new Blob([new Uint8Array(params.audioFile)]), 'voice_sample.mp3')
  if (params.description) form.append('description', params.description)

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal, redirect: 'error', cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`ElevenLabs clonage: ${await httpErrorMessage(res)}`)
  }
  const data = await providerRecord(res, signal)
    .catch(() => { throw new Error('ElevenLabs clonage: reponse invalide') })
  if (typeof data.voice_id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(data.voice_id)) {
    throw new Error('ElevenLabs clonage: reponse invalide (voice_id absent)')
  }
  return data.voice_id
}

export async function listVoices(): Promise<
  Array<{ voice_id: string; name: string; preview_url: string | null }>
> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY', 'liste des voix ElevenLabs')
  const signal = AbortSignal.timeout(15_000)

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    signal, redirect: 'error',
    next: { revalidate: 3_600 },
  })
  if (!res.ok) {
    throw new Error(`ElevenLabs voix: ${await httpErrorMessage(res)}`)
  }
  const data = await providerRecord(res, signal, 2 * 1024 * 1024)
    .catch(() => { throw new Error('ElevenLabs voix: reponse invalide') })
  if (!Array.isArray(data.voices) || !data.voices.every(voice => voice && typeof voice.voice_id === 'string'
      && /^[A-Za-z0-9_-]{1,200}$/.test(voice.voice_id) && typeof voice.name === 'string'
      && (voice.preview_url === null || (typeof voice.preview_url === 'string' && /^https:\/\//.test(voice.preview_url))))) {
    throw new Error('ElevenLabs voix: reponse invalide (voices[] absent)')
  }
  return data.voices
}
