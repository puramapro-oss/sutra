import type { VideoFormat } from '@/types'
import { VOICE_STYLES } from '@/lib/constants'

export interface PresetTemplate {
  id: string
  name: string
  category: string
  description: string
  format: VideoFormat
  duration: string
  suggestedVoice: (typeof VOICE_STYLES)[number]['id']
  prompt: string
  style: string
  icon: string
  color: string
}
