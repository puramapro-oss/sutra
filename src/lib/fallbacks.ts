import { generateVideoSmart, type VideoEngine } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { searchVideos } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { sleep } from '@/lib/utils/api'
import type { MusicStyle, Plan } from '@/types'

export async function generateVisualWithFallback(
  prompt: string,
  quality: string,
  userEmail: string | null = null,
  plan: Plan = 'free',
  format = '16:9'
): Promise<{ url: string; engine: VideoEngine }> {
  // Attempt 1: LTX (auto-falls back to WAN 2.2 internally via circuit breaker)
  try {
    const result = await generateVideoSmart(prompt, plan, userEmail, { quality, format })
    const filename = `scenes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const url = await uploadToStorage(filename, result.videoBuffer, 'video/mp4')
    return { url, engine: result.engine }
  } catch {
    // All video engines failed
  }

  // Attempt 2: Pexels stock (last resort)
  const stock = await searchVideos(prompt)
  if (stock[0]) return { url: stock[0].url, engine: 'wan-classic' }

  throw new Error('Aucun service de generation video disponible')
}

export async function generateMusicWithFallback(
  prompt: string,
  style: string,
  duration: number
): Promise<string> {
  try {
    const song = await generateMusic({
      prompt,
      style: style as MusicStyle,
      duration,
      instrumental: true,
    })
    return song.audio_url
  } catch {
    return ''
  }
}

export async function generateVoiceWithFallback(
  text: string,
  voiceId: string
): Promise<ArrayBuffer> {
  try {
    return await generateVoice({ text, voice_id: voiceId })
  } catch {
    await sleep(60_000)
    return await generateVoice({ text, voice_id: voiceId })
  }
}
