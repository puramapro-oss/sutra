import type { SubtitleEntry } from '@/types'
import { askClaude } from '@/lib/claude'

// ─── Types ───────────────────────────────────────────────────────────

export type SubtitleStyle = 'classic' | 'tiktok' | 'karaoke' | 'minimal'

export interface SubtitleConfig {
  style: SubtitleStyle
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  backgroundColor: string
  position: 'top' | 'center' | 'bottom'
  fontFamily: string
  animation: 'none' | 'fade' | 'pop' | 'typewriter'
}

// ─── Constants ───────────────────────────────────────────────────────

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  style: 'tiktok',
  fontSize: 'lg',
  color: '#FFFFFF',
  backgroundColor: '#00000080',
  position: 'bottom',
  fontFamily: 'Space Grotesk',
  animation: 'pop',
}

export const SUBTITLE_STYLES: Array<{
  id: SubtitleStyle
  label: string
  description: string
  preview: string
}> = [
  {
    id: 'classic',
    label: 'Classique',
    description: 'Sous-titres complets phrase par phrase, style cinema',
    preview: 'Bienvenue dans cette video incroyable',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    description: 'Mots rapides 2-3 par ecran, style viral',
    preview: 'ATTENDEZ\nLA SUITE',
  },
  {
    id: 'karaoke',
    label: 'Karaoke',
    description: 'Mot par mot avec surlignage progressif',
    preview: 'Chaque. Mot. Compte.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Phrases cles uniquement, style epure',
    preview: 'Idee principale',
  },
]

export const SUBTITLE_FONTS: string[] = [
  'Space Grotesk',
  'Inter',
  'Montserrat',
  'Oswald',
  'Bebas Neue',
  'Poppins',
  'Roboto',
  'Playfair Display',
  'DM Sans',
  'Outfit',
]

export const SUBTITLE_COLORS: string[] = [
  '#FFFFFF',
  '#F8FAFC',
  '#FBBF24',
  '#A78BFA',
  '#34D399',
  '#F87171',
  '#60A5FA',
  '#FB923C',
  '#F472B6',
  '#2DD4BF',
]

// ─── SRT Generation ──────────────────────────────────────────────────

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function parseSRTTime(time: string): number {
  const match = time.trim().match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/)
  if (!match) return 0
  const [, h, m, s, ms] = match
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000
}

export function generateSRT(subtitles: SubtitleEntry[]): string {
  return subtitles
    .map((entry, index) => {
      const startTime = formatSRTTime(entry.start)
      const endTime = formatSRTTime(entry.end)
      return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}`
    })
    .join('\n\n')
}

export function parseSRT(srt: string): SubtitleEntry[] {
  const blocks = srt.trim().split(/\n\n+/)
  const entries: SubtitleEntry[] = []

  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 3) continue

    const timeLine = lines[1]
    const timeMatch = timeLine.match(/^([\d:,.]+)\s*-->\s*([\d:,.]+)/)
    if (!timeMatch) continue

    const start = parseSRTTime(timeMatch[1])
    const end = parseSRTTime(timeMatch[2])
    const text = lines.slice(2).join('\n').trim()

    if (text) {
      entries.push({ text, start, end })
    }
  }

  return entries
}

// ─── Translation ─────────────────────────────────────────────────────

export async function translateSubtitles(
  subtitles: SubtitleEntry[],
  targetLang: string
): Promise<SubtitleEntry[]> {
  if (subtitles.length === 0) return []

  const textsToTranslate = subtitles.map((s) => s.text)

  const prompt = `Traduis ces sous-titres en ${targetLang}. Garde exactement le meme nombre de lignes. Reponds UNIQUEMENT avec les traductions, une par ligne, sans numerotation ni prefixe.

${textsToTranslate.map((t, i) => `${i + 1}. ${t}`).join('\n')}`

  const result = await askClaude(prompt, `Tu es un traducteur professionnel. Traduis fidèlement chaque ligne en ${targetLang}. Reponds uniquement avec les traductions, une par ligne.`)

  const translatedLines = result
    .trim()
    .split('\n')
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 0)

  return subtitles.map((entry, index) => ({
    ...entry,
    text: translatedLines[index] ?? entry.text,
  }))
}

// ─── Auto Generation ─────────────────────────────────────────────────

export function autoGenerateSubtitles(
  narration: string,
  totalDuration: number,
  style: SubtitleStyle
): SubtitleEntry[] {
  if (!narration.trim()) return []

  switch (style) {
    case 'tiktok':
      return generateTikTokStyle(narration, totalDuration)
    case 'karaoke':
      return generateKaraokeStyle(narration, totalDuration)
    case 'minimal':
      return generateMinimalStyle(narration, totalDuration)
    case 'classic':
    default:
      return generateClassicStyle(narration, totalDuration)
  }
}

// ─── Style Generators ────────────────────────────────────────────────

function generateClassicStyle(narration: string, totalDuration: number): SubtitleEntry[] {
  const sentences = narration
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) return []

  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0)
  const entries: SubtitleEntry[] = []
  let currentTime = 0

  for (const sentence of sentences) {
    const proportion = sentence.length / totalChars
    const duration = Math.max(1.5, proportion * totalDuration)
    entries.push({
      text: sentence,
      start: Math.round(currentTime * 1000) / 1000,
      end: Math.round((currentTime + duration) * 1000) / 1000,
    })
    currentTime += duration
  }

  return entries
}

function generateTikTokStyle(narration: string, totalDuration: number): SubtitleEntry[] {
  const words = narration.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return []

  const chunks: string[] = []
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, Math.min(i + 3, words.length)).join(' ')
    chunks.push(chunk.toUpperCase())
  }

  const durationPerChunk = totalDuration / chunks.length
  const entries: SubtitleEntry[] = []

  for (let i = 0; i < chunks.length; i++) {
    const start = i * durationPerChunk
    const end = Math.min((i + 1) * durationPerChunk, totalDuration)
    entries.push({
      text: chunks[i],
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    })
  }

  return entries
}

function generateKaraokeStyle(narration: string, totalDuration: number): SubtitleEntry[] {
  const words = narration.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return []

  const durationPerWord = totalDuration / words.length
  const entries: SubtitleEntry[] = []

  for (let i = 0; i < words.length; i++) {
    const start = i * durationPerWord
    const end = Math.min((i + 1) * durationPerWord, totalDuration)
    entries.push({
      text: words[i],
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    })
  }

  return entries
}

function generateMinimalStyle(narration: string, totalDuration: number): SubtitleEntry[] {
  const sentences = narration
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) return []

  // Extract key phrases: first 4-6 words of each sentence
  const keyPhrases = sentences.map((sentence) => {
    const words = sentence.replace(/[.!?…]+$/, '').split(/\s+/)
    return words.slice(0, Math.min(6, words.length)).join(' ')
  })

  const durationPerPhrase = totalDuration / keyPhrases.length
  const entries: SubtitleEntry[] = []

  for (let i = 0; i < keyPhrases.length; i++) {
    const start = i * durationPerPhrase
    // Minimal style: show for 70% of the slot, leave gaps
    const end = Math.min(start + durationPerPhrase * 0.7, totalDuration)
    entries.push({
      text: keyPhrases[i],
      start: Math.round(start * 1000) / 1000,
      end: Math.round(end * 1000) / 1000,
    })
  }

  return entries
}
