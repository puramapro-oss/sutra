import type { Scene } from './index'
import { FileText, Film, Music, Subtitles, Palette } from 'lucide-react'

export interface SubtitleEntry {
  id: string
  text: string
  start: number
  end: number
}

export interface HistoryState {
  script: string
  scenes: Scene[]
  subtitles: SubtitleEntry[]
  voiceVolume: number
  musicVolume: number
}

export interface QualityOption {
  value: string
  label: string
  minPlan: 'free' | 'starter' | 'creator' | 'empire' | 'admin'
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { value: '720p', label: '720p HD', minPlan: 'free' },
  { value: '1080p', label: '1080p Full HD', minPlan: 'creator' },
  { value: '4k', label: '4K Ultra HD', minPlan: 'empire' },
]

export const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const

export const SIDE_TABS = [
  { id: 'script', label: 'Script', icon: FileText },
  { id: 'scenes', label: 'Scenes', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'subtitles', label: 'Sous-titres', icon: Subtitles },
  { id: 'brandkit', label: 'Brand Kit', icon: Palette },
] as const

export type SideTab = (typeof SIDE_TABS)[number]['id']

export const MAX_HISTORY = 50
