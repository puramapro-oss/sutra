import { submitVideoJob, pollVideoJob } from '@/lib/runpod'
import { generateMusic } from '@/lib/suno'
import { generateVoice } from '@/lib/elevenlabs'
import { searchVideos } from '@/lib/pexels'
import { sleep } from '@/lib/utils/api'
import type { MusicStyle } from '@/types'

export async function generateVisualWithFallback(
  prompt: string,
  _quality: string,
  userEmail?: string | null
): Promise<string> {
  // Attempt 1: RunPod + WAN 2.2 (super admin → dedicated GPU if configured)
  try {
    const { jobId, baseUrl } = await submitVideoJob({ prompt, width: 768, height: 512 }, userEmail)
    return await pollVideoJob(jobId, baseUrl, 180_000)
  } catch {
    // RunPod failed
  }

  // Attempt 2: Pexels stock
  const stock = await searchVideos(prompt)
  if (stock[0]) return stock[0].url

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
    // Suno failed — return empty string to skip music
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
    // ElevenLabs rate limited — wait and retry
    await sleep(60_000)
    return await generateVoice({ text, voice_id: voiceId })
  }
}
