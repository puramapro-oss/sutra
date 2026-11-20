// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Scene {
  id: string
  visual_prompt: string
  description: string
  duration_seconds: number
  transition: 'fade' | 'cut' | 'slide' | 'zoom'
}

export type VideoFormat = '16:9' | '9:16' | '1:1'
export type DurationTarget = 'short' | 'medium' | 'long'
export const MAX_STORYBOARD_IDEA_LENGTH = 5000

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FORMAT_OPTIONS: { id: VideoFormat; label: string; icon: string; desc: string }[] = [
  { id: '16:9', label: '16:9', icon: 'Monitor', desc: 'YouTube, Desktop' },
  { id: '9:16', label: '9:16', icon: 'Smartphone', desc: 'TikTok, Reels' },
  { id: '1:1', label: '1:1', icon: 'Square', desc: 'Instagram, Feed' },
]

export const DURATION_OPTIONS: { id: DurationTarget; label: string; desc: string }[] = [
  { id: 'short', label: 'Court', desc: '~30s' },
  { id: 'medium', label: 'Moyen', desc: '~2 min' },
  { id: 'long', label: 'Long', desc: '5 min+' },
]

export const TRANSITIONS: { id: Scene['transition']; label: string }[] = [
  { id: 'fade', label: 'Fondu' },
  { id: 'cut', label: 'Cut' },
  { id: 'slide', label: 'Slide' },
  { id: 'zoom', label: 'Zoom' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** A detailed creative brief can exceed the cinema project's 500-character title. */
export function storyboardProjectTitle(idea: string): string {
  const title = idea.trim()
  if (title.length <= 500) return title || 'Projet cinéma SUTRA'
  const firstLine = title.split(/\r?\n/, 1)[0].trim()
  const characters = Array.from(firstLine.length >= 3 ? firstLine : title.replace(/\s+/g, ' '))
  return characters.length > 100 ? `${characters.slice(0, 99).join('').trimEnd()}…` : characters.join('')
}

/** Accept the JSON object directly or in one Markdown code block from a chat tool. */
export function parseStoryboardJson(text: string): unknown {
  const raw = text.trim()
  const fenced = /^```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```$/i.exec(raw)
  return JSON.parse(fenced?.[1] ?? raw)
}

export function getPollinationsUrl(prompt: string, format: VideoFormat): string {
  // Classic preview: best effort, logo, <=768² pixels and 45s/IP rate limit.
  // nofeed excludes the public feed; the provider still receives the URL prompt.
  const dims =
    format === '9:16'
      ? 'width=432&height=768'
      : format === '1:1'
        ? 'width=600&height=600'
        : 'width=768&height=432'
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${dims}&nofeed=true`
}
