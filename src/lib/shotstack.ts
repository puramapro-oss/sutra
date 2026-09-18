import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'

const SHOTSTACK_BASE_URL = 'https://api.shotstack.io/edit/stage'

export type ShotstackFormat = '9:16' | '16:9' | '1:1'

interface AssembleParams {
  clips: Array<{ url: string; type: 'ia' | 'stock' }>
  voiceUrl: string
  musicUrl: string
  musicVolume: number
  subtitles: SubtitleEntry[]
  transitions: string
  format: string
  quality: string
  brandKit?: {
    intro_template?: string
    outro_template?: string
  } | null
}

interface SubtitleEntry {
  text: string
  start: number
  end: number
}

export interface AssembleResult {
  url: string
  timeline: Record<string, unknown>
  duration: number
  /** Qualité RÉELLE du rendu ('sd'|'hd') — jamais '4k' : le stage Shotstack plafonne à HD. */
  outputQuality: 'sd' | 'hd'
  /** Dimensions réelles du rendu, dérivées du format demandé. */
  outputSize: { width: number; height: number }
}

/**
 * Dimensions de sortie par format — le rendu final respecte le ratio demandé
 * (16:9 paysage, 9:16 portrait, 1:1 carré). Shotstack "stage" plafonne à 1080p
 * ("hd") : une demande 4k est rendue en HD et le résultat l'annonce
 * honnêtement via outputQuality — jamais de "4K" affiché pour du HD.
 */
function outputSizeFor(format: ShotstackFormat): { width: number; height: number } {
  if (format === '9:16') return { width: 720, height: 1280 }
  if (format === '1:1') return { width: 720, height: 720 }
  return { width: 1280, height: 720 }
}

function normalizeFormat(format: string): ShotstackFormat {
  return format === '9:16' || format === '1:1' ? format : '16:9'
}

/**
 * Qualité à annoncer après montage : le stage Shotstack plafonne à HD — une
 * demande 4k rendue en HD est honnêtement ramenée à 1080p. Source unique du
 * clamp pour /api/create et /api/production.
 */
export function actualQualityFor(requested: string, outputQuality: 'sd' | 'hd'): string {
  return requested === '4k' && outputQuality === 'hd' ? '1080p' : requested
}

export async function assembleFinalVideo(params: AssembleParams): Promise<AssembleResult> {
  const apiKey = requireEnv('SHOTSTACK_API_KEY', 'montage final Shotstack')

  const tracks = buildTracks(params)
  const timeline: Record<string, unknown> = {
    background: '#000000',
    tracks,
  }
  // Only include soundtrack when music URL is present — Shotstack rejects empty src.
  if (params.musicUrl && params.musicUrl.trim().length > 0) {
    timeline.soundtrack = {
      src: params.musicUrl,
      effect: 'fadeOut',
      volume: params.musicVolume,
    }
  }

  const outputSize = outputSizeFor(normalizeFormat(params.format))
  // Shotstack stage rend en HD maximum. Toute demande (y compris 4k) sort en
  // HD ; on le documente dans la réponse plutôt que de prétendre du 4K.
  const output = {
    format: 'mp4',
    resolution: 'hd' as const,
    size: outputSize,
    fps: 30,
  }

  const body = { timeline, output }

  const res = await fetchWithRetry(`${SHOTSTACK_BASE_URL}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Shotstack: ${await httpErrorMessage(res)}`)
  }
  const data = (await res.json()) as {
    response?: { id?: string; message?: string }
  }
  if (!data.response?.id) throw new Error(`Shotstack: ${data.response?.message ?? 'reponse invalide (id absent)'}`)

  const result = await pollShotstackRender(data.response.id, apiKey)
  return {
    url: result.url,
    timeline: body as unknown as Record<string, unknown>,
    duration: result.duration,
    outputQuality: 'hd',
    outputSize,
  }
}

async function pollShotstackRender(
  renderId: string,
  apiKey: string,
  timeoutMs = 300_000
): Promise<{ url: string; duration: number }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${SHOTSTACK_BASE_URL}/render/${renderId}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`Shotstack status: HTTP ${res.status} pour le rendu ${renderId}`)
      }
      await sleep(5000)
      continue
    }
    const data = (await res.json()) as {
      response?: { status?: string; url?: string; duration?: number; error?: string }
    }
    const status = data.response?.status

    if (status === 'done') {
      if (!data.response?.url) throw new Error('Shotstack: rendu termine sans URL')
      return {
        url: data.response.url,
        duration: data.response.duration ?? 0,
      }
    }
    if (status === 'failed') throw new Error(`Shotstack: rendu echoue - ${data.response?.error ?? 'raison inconnue'}`)
    await sleep(5000)
  }
  throw new Error('Shotstack: timeout')
}

function buildTracks(params: AssembleParams) {
  const videoClips: Array<Record<string, unknown>> = []
  let currentStart = 0

  if (params.brandKit?.intro_template) {
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.intro_template },
      start: currentStart,
      length: 3,
      transition: { in: 'fade', out: 'fade' },
    })
    currentStart += 3
  }

  for (const clip of params.clips) {
    videoClips.push({
      asset: { type: 'video', src: clip.url },
      start: currentStart,
      length: 5,
      transition: { in: params.transitions === 'crossfade' ? 'fade' : 'none' },
    })
    currentStart += 5
  }

  if (params.brandKit?.outro_template) {
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.outro_template },
      start: currentStart,
      length: 3,
      transition: { in: 'fade' },
    })
  }

  const voiceTrack = [
    {
      asset: { type: 'audio', src: params.voiceUrl },
      start: 0,
      length: currentStart,
    },
  ]

  const subtitleClips = params.subtitles.map((sub) => ({
    asset: {
      type: 'title',
      text: sub.text,
      style: 'subtitle',
      size: 'small',
    },
    start: sub.start,
    length: sub.end - sub.start,
    position: 'bottom',
  }))

  return [
    { clips: videoClips },
    { clips: voiceTrack },
    { clips: subtitleClips },
  ]
}

export function generateSubtitlesFromScript(
  narration: string,
  scenes: Array<{ duration_seconds: number }>
): SubtitleEntry[] {
  const words = narration.split(/\s+/)
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
  const wordsPerSecond = words.length / totalDuration
  const subtitles: SubtitleEntry[] = []
  const chunkSize = 8

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    const start = (i / wordsPerSecond)
    const end = Math.min(((i + chunkSize) / wordsPerSecond), totalDuration)
    subtitles.push({ text: chunk, start: Number(start.toFixed(2)), end: Number(end.toFixed(2)) })
  }

  return subtitles
}
