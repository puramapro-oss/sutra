import { fetchWithRetry, sleep, httpErrorMessage } from '@/lib/utils/api'
import { requireEnv } from '@/lib/env'

const SHOTSTACK_BASE_URL = 'https://api.shotstack.io/edit/stage'

export type ShotstackFormat = '9:16' | '16:9' | '1:1'

/**
 * Un clip de montage : `kind` distingue vidéo et photo (une photo devient un
 * ASSET image Shotstack avec durée — jamais un asset vidéo, audit #5) et
 * `duration` alimente l'horloge de montage commune (audit #4).
 */
export interface AssembleClip {
  url: string
  type: 'ia' | 'stock'
  kind?: 'video' | 'photo'
  duration?: number
}

interface AssembleParams {
  clips: Array<{ url: string; type: 'ia' | 'stock' } & Partial<AssembleClip>>
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
  /** Qualité RÉELLE du rendu ('sd'|'hd') — le stage Shotstack plafonne à HD. */
  outputQuality: 'sd' | 'hd'
  /** Dimensions réelles du rendu, dérivées du format + de la qualité demandés. */
  outputSize: { width: number; height: number }
}

/**
 * Dimensions de sortie PAR QUALITÉ et format — alignées sur la grille LTX
 * (docs.ltx.io) : 720p → 1280×720 / 720×1280 / 720×720, 1080p → 1920×1080 /
 * 1080×1920 / 1080×1080, 4k → 3840×2160 / 2160×3840 / 2160×2160.
 * Une génération 4K n'est PLUS exportée en 720p (audit #1). Le carré est
 * obtenu par output.size carré (recadrage centré côté Shotstack).
 */
function outputSizeFor(format: ShotstackFormat, quality: string): { width: number; height: number } {
  const q = quality === '4k' ? '4k' : quality === '1080p' ? '1080p' : '720p'
  const SIZES: Record<string, Record<ShotstackFormat, { width: number; height: number }>> = {
    '720p': {
      '16:9': { width: 1280, height: 720 },
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 720, height: 720 },
    },
    '1080p': {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1': { width: 1080, height: 1080 },
    },
    '4k': {
      '16:9': { width: 3840, height: 2160 },
      '9:16': { width: 2160, height: 3840 },
      '1:1': { width: 2160, height: 2160 },
    },
  }
  return SIZES[q][format]
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

const DEFAULT_CLIP_DURATION = 5

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

  const outputSize = outputSizeFor(normalizeFormat(params.format), params.quality)
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

/** URL qui finit par une extension d'image → asset image, pas vidéo. */
function looksLikePhoto(url: string): boolean {
  return /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url)
}

/** Transitions normalisées : 'fade'/'crossfade' → fade, tout le reste → none. */
function transitionFor(requested: string): { in: string; out?: string } {
  const norm = requested.toLowerCase()
  if (norm === 'fade' || norm === 'crossfade' || norm === 'fondu') {
    return { in: 'fade' }
  }
  return { in: 'none' }
}

function clipAsset(clip: AssembleParams['clips'][number]): { type: string; src: string } {
  const kind = clip.kind ?? (looksLikePhoto(clip.url) ? 'photo' : 'video')
  // Une photo devient un asset IMAGE (durée portée par le clip) — jamais un
  // asset vidéo (audit #5 : le type du média doit survivre jusqu'au montage).
  return { type: kind === 'photo' ? 'image' : 'video', src: clip.url }
}

/**
 * Horloge de montage commune (audit #4) :
 *   - chaque clip dure SA durée réelle (duration par clip, 5s par défaut)
 *   - l'intro décale voix ET sous-titres de sa longueur
 *   - la piste voix couvre la durée totale des clips (intro + scènes + outro)
 *   - les sous-titres sont décalés d'autant, bornés à la fin du montage
 */
function buildTracks(params: AssembleParams) {
  const videoClips: Array<Record<string, unknown>> = []
  let introLength = 0

  if (params.brandKit?.intro_template) {
    introLength = 3
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.intro_template },
      start: 0,
      length: introLength,
      transition: { in: 'fade', out: 'fade' },
    })
  }

  let cursor = introLength
  for (const clip of params.clips) {
    const length = Math.max(1, clip.duration ?? DEFAULT_CLIP_DURATION)
    videoClips.push({
      asset: clipAsset(clip),
      start: cursor,
      length,
      transition: transitionFor(params.transitions),
    })
    cursor += length
  }

  if (params.brandKit?.outro_template) {
    videoClips.push({
      asset: { type: 'video', src: params.brandKit.outro_template },
      start: cursor,
      length: 3,
      transition: { in: 'fade' },
    })
    cursor += 3
  }

  const totalLength = cursor

  const voiceTrack = [
    {
      // La voix démarre APRÈS l'intro et couvre tout le corps du montage.
      asset: { type: 'audio', src: params.voiceUrl },
      start: introLength,
      length: Math.max(1, totalLength - introLength),
    },
  ]

  const subtitleClips = params.subtitles
    .map((sub) => ({
      asset: {
        type: 'title',
        text: sub.text,
        style: 'subtitle',
        size: 'small',
      },
      start: introLength + sub.start,
      length: Math.max(0.5, Math.min(sub.end - sub.start, totalLength - (introLength + sub.start))),
      position: 'bottom',
    }))
    // Aucun sous-titre après la fin du montage (contrôle des fins de pistes).
    .filter((c) => c.start < totalLength)

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
