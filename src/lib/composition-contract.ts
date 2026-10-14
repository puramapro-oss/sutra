import { FfmpegCompositorError } from './ffmpeg-io.ts'
import { getResolution, type SubtitleEntry } from './ffmpeg-filters.ts'

/** Absence is allowed only when the brief says optional. A supplied asset must render. */
export type MediaRequirement = 'optional' | 'required' | 'disabled'
export type CompositionRequirements = Partial<Record<'voice' | 'music' | 'subtitles' | 'intro' | 'outro' | 'logo', MediaRequirement>>
export interface MediaLineage {
  /** URLs of the actual generation and enhancement outputs, never guessed from a preset. */
  nativeUrl?: string
  enhancedUrl?: string
  generation?: { kind: 'native' | 'upscaled'; evidence: string }
}
export interface CompositionContract {
  clips: Array<{ url: string; durationSeconds?: number; kind?: 'video' | 'photo'; lineage?: MediaLineage }>
  voiceUrl?: string | null
  musicUrl?: string | null
  voiceVolume?: number
  musicVolume?: number
  watermarkUrl?: string | null
  watermarkText?: string | null
  introUrl?: string | null
  outroUrl?: string | null
  introOutroDurationSeconds?: number
  subtitles?: SubtitleEntry[]
  requirements?: CompositionRequirements
  transitions?: string
  format: string
  quality: string
}

export function compositionPlan(input: CompositionContract) {
  const reject = (reason: string): never => { throw new FfmpegCompositorError(reason, 'validation') }
  if (!['16:9', '9:16', '1:1'].includes(input.format) || !['720p', '1080p', '4k'].includes(input.quality)) reject('Format ou qualite de rendu invalide')
  if (!input.clips.length) reject('Aucun clip a assembler')
  const duration = (value: number) => {
    if (!Number.isFinite(value) || value < 1 / 30) reject('Duree invalide : minimum une image a 30 FPS')
    return Math.round(value * 30) / 30
  }
  const durations = input.clips.map(c => {
    if (!c.url?.trim()) reject('URL de clip absente')
    return duration(c.durationSeconds ?? 5)
  })
  const intro = input.introUrl ? duration(input.introOutroDurationSeconds ?? 3) : 0
  const outro = input.outroUrl ? duration(input.introOutroDurationSeconds ?? 3) : 0
  const body = durations.reduce((a, b) => a + b, 0)
  const total = intro + body + outro
  const volume = input.musicVolume ?? 0.25
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) reject('Volume musique hors de [0, 1]')
  const voiceVolume = input.voiceVolume ?? 1
  if (!Number.isFinite(voiceVolume) || voiceVolume < 0 || voiceVolume > 1) reject('Volume voix hors de [0, 1]')
  const present = {
    voice: Boolean(input.voiceUrl?.trim()) && voiceVolume > 0, music: Boolean(input.musicUrl?.trim()) && volume > 0,
    subtitles: Boolean(input.subtitles?.length), intro: Boolean(intro), outro: Boolean(outro),
    logo: Boolean(input.watermarkUrl?.trim() || input.watermarkText?.trim()),
  }
  for (const [key, requirement] of Object.entries(input.requirements ?? {})) {
    if (!Object.hasOwn(present, key) || !['required', 'optional', 'disabled'].includes(requirement)) reject('Exigence media inconnue')
    if (requirement === 'required' && !present[key as keyof typeof present]) reject(`Brief : ${key} obligatoire mais absent`)
    const supplied = key === 'music' ? Boolean(input.musicUrl?.trim()) : key === 'voice' ? Boolean(input.voiceUrl?.trim()) : present[key as keyof typeof present]
    if (requirement === 'disabled' && supplied) reject(`Brief : ${key} desactive mais fourni`)
  }
  let previousEnd = 0
  const subtitles = (input.subtitles ?? []).map(s => {
    if (!s.text.trim() || !Number.isFinite(s.start) || !Number.isFinite(s.end) ||
        s.start < 0 || s.end <= s.start || s.end > body + 0.001 || s.start < previousEnd) reject('Sous-titres invalides, superposes ou hors du corps du montage')
    // A positive interval can still lie entirely between two output frames.
    if (s.end - s.start < 1 / 30 - 1e-9) reject('Sous-titre trop court : minimum une image a 30 FPS')
    previousEnd = s.end
    // Strip control characters and markup: text must remain literal in both renderers.
    const text = s.text.replace(/[\u0000-\u001f]/g, ' ').replace(/[<>{}]/g, '')
    if (!text.trim()) reject('Sous-titre vide apres normalisation')
    return { text, start: s.start + intro, end: s.end + intro }
  })
  const [width, height] = getResolution(input.format, input.quality).split('x').map(Number)
  return { durations, intro, outro, body, total, subtitles, width, height,
    audioRequired: Boolean(present.voice || present.music), fps: 30 }
}

export type CompositionPlan = ReturnType<typeof compositionPlan>
