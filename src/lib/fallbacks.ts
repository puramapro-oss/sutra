import { generateVideoSmart, type VideoEngine } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateRiffusionMusic, isRiffusionConfigured } from '@/lib/riffusion'
import { generateStableAudio, isStableAudioConfigured } from '@/lib/stable-audio'
import { generateVoice } from '@/lib/elevenlabs'
import { searchVideos } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { sleep } from '@/lib/utils/api'
import type { MusicStyle, Plan } from '@/types'

/**
 * Résultat d'un visuel : `source` distingue une vraie génération IA d'un clip
 * de banque d'images. Un clip Pexels n'est JAMAIS présenté comme généré par
 * WAN — la provenance reste traçable jusqu'à la DB et aux logs.
 */
export interface VisualResult {
  url: string
  engine: VideoEngine
  source: 'ai' | 'pexels-stock'
  stockMeta?: {
    id: number
    author: string | null
    authorUrl: string | null
    sourcePage: string
    width: number
    height: number
  }
}

export async function generateVisualWithFallback(
  prompt: string,
  quality: string,
  userEmail: string | null = null,
  plan: Plan = 'free',
  format = '16:9',
  strictAi = false,
  track: { userId?: string; videoId?: string; duration?: number } = {}
): Promise<VisualResult> {
  // Attempt 1: LTX (auto-falls back to WAN 2.2 internally via circuit breaker)
  try {
    const result = await generateVideoSmart(prompt, plan, userEmail, {
      quality,
      format,
      duration: track.duration,
      userId: track.userId,
      videoId: track.videoId,
    })
    const filename = `scenes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const url = await uploadToStorage(filename, result.videoBuffer, 'video/mp4')
    return { url, engine: result.engine, source: 'ai' }
  } catch (err) {
    // Mode « 100 % IA » strict (audit #18) : pas de repli stock silencieux —
    // l'utilisateur a choisi de l'IA, on remonte l'échec IA tel quel.
    if (strictAi) throw err
    // Dégradation explicite : on logge la raison (sans secret) avant de
    // tenter la banque d'images — jamais d'échec silencieux.
    console.error(
      '[fallbacks] generation IA echouee, tentative stock Pexels :',
      err instanceof Error ? err.message : String(err)
    )
  }

  // Attempt 2: Pexels stock (dernier recours, provenance explicite)
  const stockFormat = (['9:16', '16:9', '1:1'].includes(format) ? format : '16:9') as '9:16' | '16:9' | '1:1'
  const stock = await searchVideos(prompt, 3, { format: stockFormat })
  const best = stock[0]
  if (best) {
    return {
      url: best.url,
      engine: 'wan-classic',
      source: 'pexels-stock',
      stockMeta: {
        id: best.id,
        author: best.author,
        authorUrl: best.authorUrl,
        sourcePage: best.sourcePage,
        width: best.width,
        height: best.height,
      },
    }
  }

  throw new Error('Aucun service de generation video disponible (IA indisponible et stock vide)')
}

/**
 * Music generation chain — Suno → Riffusion → Stable Audio → '' (no music).
 *
 * Each provider is attempted only if its API key is configured. Failures fall
 * through to the next provider WITH a logged reason (no silent degradation).
 * If all fail, returns '' and the pipeline continues without music (Shotstack
 * omits the soundtrack track — see shotstack.ts).
 */
export async function generateMusicWithFallback(
  prompt: string,
  style: string,
  duration: number
): Promise<string> {
  const enrichedPrompt = style ? `${prompt} — style: ${style}` : prompt

  // 1. Suno (primary)
  try {
    const song = await generateMusic({
      prompt,
      style: style as MusicStyle,
      duration,
      instrumental: true,
    })
    if (song?.audio_url) return song.audio_url
  } catch (err) {
    console.error('[fallbacks] Suno echoue :', err instanceof Error ? err.message : String(err))
  }

  // 2. Riffusion (secondary)
  if (isRiffusionConfigured()) {
    try {
      const song = await generateRiffusionMusic({ prompt: enrichedPrompt })
      if (song?.audio_url) return song.audio_url
    } catch (err) {
      console.error('[fallbacks] Riffusion echoue :', err instanceof Error ? err.message : String(err))
    }
  }

  // 3. Stable Audio via Replicate (tertiary)
  if (isStableAudioConfigured()) {
    try {
      const song = await generateStableAudio({ prompt: enrichedPrompt, duration })
      if (song?.audio_url) return song.audio_url
    } catch (err) {
      console.error('[fallbacks] Stable Audio echoue :', err instanceof Error ? err.message : String(err))
    }
  }

  // All providers exhausted — render video without music (dégradation documentée)
  console.warn('[fallbacks] aucun fournisseur musique disponible — rendu sans bande-son')
  return ''
}

/**
 * Voix : 2 tentatives max, backoff court. La seconde tentative échoue avec
 * l'erreur d'origine (pas de crash silencieux, pas de sleep de 60s qui
 * dépasse le budget d'exécution serverless).
 */
export async function generateVoiceWithFallback(
  text: string,
  voiceId: string
): Promise<ArrayBuffer> {
  try {
    return await generateVoice({ text, voice_id: voiceId })
  } catch (firstErr) {
    console.error(
      '[fallbacks] ElevenLabs tentative 1 echouee, retry dans 5s :',
      firstErr instanceof Error ? firstErr.message : String(firstErr)
    )
    await sleep(5_000)
    try {
      return await generateVoice({ text, voice_id: voiceId })
    } catch (secondErr) {
      const reason = secondErr instanceof Error ? secondErr.message : String(secondErr)
      throw new Error(`Voix indisponible apres 2 tentatives : ${reason}`)
    }
  }
}
