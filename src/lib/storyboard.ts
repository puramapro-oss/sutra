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

export function getPollinationsUrl(prompt: string, format: VideoFormat): string {
  const dims =
    format === '9:16'
      ? 'width=432&height=768'
      : format === '1:1'
        ? 'width=600&height=600'
        : 'width=768&height=432'
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${dims}&model=flux&enhance=true&nologo=true`
}
