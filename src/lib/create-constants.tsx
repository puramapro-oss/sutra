import { Monitor, Smartphone, Square } from 'lucide-react'
import type { Plan, VideoFormat, VideoQuality } from '@/types'

export const FORMAT_OPTIONS: { id: VideoFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: '16:9', label: '16:9', icon: <Monitor className="h-5 w-5" />, desc: 'YouTube, Desktop' },
  { id: '9:16', label: '9:16', icon: <Smartphone className="h-5 w-5" />, desc: 'TikTok, Reels' },
  { id: '1:1', label: '1:1', icon: <Square className="h-5 w-5" />, desc: 'Instagram, Feed' },
]

export const QUALITY_OPTIONS: { id: VideoQuality; label: string; minPlan: Plan }[] = [
  { id: '720p', label: '720p', minPlan: 'free' },
  { id: '1080p', label: '1080p', minPlan: 'creator' },
  { id: '4k', label: '4K', minPlan: 'empire' },
]

export const STYLE_OPTIONS = [
  { id: 'educatif', label: 'Educatif', emoji: '📚' },
  { id: 'divertissement', label: 'Divertissement', emoji: '🎬' },
  { id: 'motivation', label: 'Motivation', emoji: '🔥' },
  { id: 'storytelling', label: 'Storytelling', emoji: '📖' },
  { id: 'tutoriel', label: 'Tutoriel', emoji: '🎓' },
]
