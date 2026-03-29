import { fetchWithRetry, sleep } from '@/lib/utils/api'

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY!
const SHOTSTACK_BASE_URL = 'https://api.shotstack.io/edit/stage'

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

export async function assembleFinalVideo(
  params: AssembleParams
): Promise<{ url: string; timeline: Record<string, unknown>; duration: number }> {
  const tracks = buildTracks(params)
  const timeline = {
    soundtrack: {
      src: params.musicUrl,
      effect: 'fadeOut',
      volume: params.musicVolume,
    },
    background: '#000000',
    tracks,
  }

  const output = {
    format: 'mp4',
    resolution: params.quality === '4k' ? 'hd' : params.quality === '1080p' ? 'hd' : 'sd',
    fps: 30,
  }

  const body = { timeline, output }

  const res = await fetchWithRetry(`${SHOTSTACK_BASE_URL}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SHOTSTACK_API_KEY,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!data.response?.id) throw new Error(`Shotstack: ${data.response?.message ?? 'erreur'}`)

  const result = await pollShotstackRender(data.response.id)
  return {
    url: result.url,
    timeline: body as unknown as Record<string, unknown>,
    duration: result.duration,
  }
}

async function pollShotstackRender(
  renderId: string,
  timeoutMs = 300_000
): Promise<{ url: string; duration: number }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${SHOTSTACK_BASE_URL}/render/${renderId}`, {
      headers: { 'x-api-key': SHOTSTACK_API_KEY },
    })
    const data = await res.json()
    const status = data.response?.status

    if (status === 'done') {
      return {
        url: data.response.url,
        duration: data.response.duration ?? 0,
      }
    }
    if (status === 'failed') throw new Error('Shotstack: rendu echoue')
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
