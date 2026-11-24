import { generateVideoSmart, type VideoEngine, type LtxJobPersistence } from '@/lib/ltx'
import { generateMusic } from '@/lib/suno'
import { generateRiffusionMusic, isRiffusionConfigured } from '@/lib/riffusion'
import { generateStableAudio, isStableAudioConfigured } from '@/lib/stable-audio'
import { generateVoice } from '@/lib/elevenlabs'
import { searchVideos } from '@/lib/pexels'
import { uploadToStorage } from '@/lib/storage'
import { isEnvSet } from '@/lib/env'
import { selectEngine } from './ltx-utils'
import { shouldUseLocalEngine } from './local-engine'
import { SaladError } from './salad/contracts'
import type { LtxResult } from './ltx-types'
import { LtxJobError, type LtxExecution } from './ltx-v2'
import { RunpodJobError } from './runpod'
import { MusicProviderJobError } from './music-provider-job'
import type { MusicStyle, Plan } from '@/types'

/**
 * Résultat d'un visuel : `source` distingue une vraie génération IA d'un clip
 * de banque d'images. Un clip Pexels n'est JAMAIS présenté comme généré par
 * WAN — la provenance reste traçable jusqu'à la DB et aux logs.
 */
export interface VisualResult {
  url: string
  engine: VideoEngine | 'pexels-stock'
  provenance?: LtxResult['provenance']
  fallbackReason?: 'selected_provider_not_configured'
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
  track: { userId?: string; videoId?: string; duration?: number; job?: LtxJobPersistence; jobId?: string; operationKey?: string; execution?: LtxExecution } = {}
): Promise<VisualResult> {
  const selected = selectEngine(plan, userEmail)
  const configured = selected.engine === 'wan-classic'
    ? isEnvSet('RUNPOD_API_KEY') && isEnvSet('RUNPOD_ENDPOINT_ID')
    : isEnvSet('LTX_API_KEY')
  // Stock is eligible only BEFORE any paid call, when explicitly permitted by
  // strictAi=false and the selected provider is known to be unconfigured.
  if (shouldUseLocalEngine(userEmail) || configured || strictAi || track.job?.current || track.execution) {
    const result = await generateVideoSmart(prompt, plan, userEmail, {
      quality, format, duration: track.duration, userId: track.userId,
      videoId: track.videoId, job: track.job, jobId: track.jobId, operationKey: track.operationKey, execution: track.execution,
    })
    const filename = `scenes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    try {
      const url = await uploadToStorage(filename, result.videoBuffer, 'video/mp4')
      return { url, engine: result.engine, source: 'ai', provenance: result.provenance }
    } catch {
      // A storage failure happens AFTER a paid generation. Keep its identity;
      // never let a generic queue retry start a new WAN generation.
      if (result.provenance?.provider === 'salad') throw new SaladError('SALAD_UPLOAD_FAILED_RESUME_SAME_JOB')
      if (result.provenance?.provider === 'runpod') throw new RunpodJobError('UPLOAD_FAILED_RESUME_SAME_JOB', result.provenance)
      if (result.provenance?.provider === 'ltx') throw new LtxJobError('LTX_UPLOAD_FAILED_RESUME_SAME_JOB', result.provenance)
      throw new ProviderOperationError(result.engine, 300_000)
    }
  }

  // Preflight stock selection with explicit provenance.
  const stockFormat = (['9:16', '16:9', '1:1'].includes(format) ? format : '16:9') as '9:16' | '16:9' | '1:1'
  const stock = await searchVideos(prompt, 3, { format: stockFormat })
  const best = stock[0]
  if (best) {
    return {
      url: best.url,
      engine: 'pexels-stock',
      source: 'pexels-stock',
      fallbackReason: 'selected_provider_not_configured',
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

/** Existing queue classification recognizes "non autorise" as permanent.
 * Keep the typed flags for integrations that can distinguish read-only resume
 * from paid resubmission. No raw provider response or input is logged. */
export class ProviderOperationError extends Error {
  readonly retrySubmission = false
  readonly fallbackAllowed = false
  readonly remoteStatus = 'unknown'
  readonly jobId = null
  readonly cost = { estimated: null, actual: null, status: 'not_reported' } as const
  readonly quota = { remaining: null }
  constructor(readonly provider: string, readonly timeoutMs: number) {
    super(`PROVIDER_RESULT_UNKNOWN (${provider}): resoumission non autorisee; reconciliation requise`)
    this.name = 'ProviderOperationError'
  }
}

export type MusicProvider = 'suno' | 'riffusion' | 'stable-audio'
export interface MusicResult {
  url: string
  provider: MusicProvider
  jobId: string | null
  remoteStatus: 'completed'
  timeoutMs: number
  cost: { estimated: null; actual: null; status: 'not_reported' }
  quota: { remaining: null }
  // These pre-existing gateway/model contracts need their own live qualification.
  contractStatus: 'legacy_not_live_verified'
}

/** Explicit selection BEFORE submission. Gateways are not interchangeable and
 * cannot be silently reported as Suno by legacy callers returning only a URL. */
export async function generateMusicWithProvenance(prompt: string, style: string, duration: number, provider: MusicProvider): Promise<MusicResult> {
  if (!prompt.trim() || !Number.isFinite(duration) || duration <= 0) throw new Error('MUSIC_INVALID_REQUEST')
  const enrichedPrompt = style ? `${prompt} — style: ${style}` : prompt
  let song: { audio_url: string; id?: string }
  const timeoutMs = provider === 'suno' ? 168_000 : provider === 'riffusion' ? 208_000 : 70_000
  const configured = provider === 'suno' ? isEnvSet('SUNO_API_KEY') : provider === 'riffusion' ? isRiffusionConfigured() : provider === 'stable-audio' && isStableAudioConfigured()
  if (!configured) throw new Error('MUSIC_PROVIDER_NOT_CONFIGURED: fournisseur non configure')
  try {
    if (provider === 'suno' && isEnvSet('SUNO_API_KEY')) {
      song = await generateMusic({ prompt, style: style as MusicStyle, duration, instrumental: true })
    } else if (provider === 'riffusion' && isRiffusionConfigured()) {
      song = await generateRiffusionMusic({ prompt: enrichedPrompt })
    } else if (provider === 'stable-audio' && isStableAudioConfigured()) {
      song = await generateStableAudio({ prompt: enrichedPrompt, duration })
    } else {
      throw new Error('MUSIC_PROVIDER_NOT_CONFIGURED: fournisseur demande indisponible')
    }
    if (!song?.audio_url) throw new Error('missing output')
  } catch (error) {
    if (error instanceof MusicProviderJobError) throw error
    throw new ProviderOperationError(provider, timeoutMs)
  }
  return { url: song.audio_url, provider, jobId: song.id ?? null, remoteStatus: 'completed', timeoutMs,
    cost: { estimated: null, actual: null, status: 'not_reported' }, quota: { remaining: null }, contractStatus: 'legacy_not_live_verified' }
}

/** Compatibility API: existing consumers label this URL as Suno. Therefore only
 * Suno is eligible here; alternate providers require the provenance-aware API. */
export async function generateMusicWithFallback(prompt: string, style: string, duration: number): Promise<string> {
  return (await generateMusicWithProvenance(prompt, style, duration, 'suno')).url
}

/** One paid TTS request. An uncertain result is non-retryable for existing workers. */
export async function generateVoiceWithProvenance(text: string, voiceId: string) {
  if (!Boolean(process.env.ELEVENLABS_API_KEY?.trim())) throw new Error('ELEVENLABS_API_KEY non configuree — voix impossible a generer pour cette video')
  try {
    const audioBuffer = await generateVoice({ text, voice_id: voiceId })
    if (!audioBuffer.byteLength) throw new Error('empty output')
    return { audioBuffer, provider: 'elevenlabs' as const, remoteStatus: 'completed' as const, jobId: null, timeoutMs: 30_000,
      cost: { estimated: null, actual: null, status: 'not_reported' as const }, quota: { remaining: null } }
  } catch { throw new ProviderOperationError('elevenlabs', 30_000) }
}
export async function generateVoiceWithFallback(text: string, voiceId: string): Promise<ArrayBuffer> {
  return (await generateVoiceWithProvenance(text, voiceId)).audioBuffer
}
