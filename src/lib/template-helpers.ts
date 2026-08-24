import { Monitor, Smartphone, Square } from 'lucide-react'
import type { VideoFormat } from '@/types'

export const FORMAT_ICONS: Record<VideoFormat, typeof Monitor> = {
  '16:9': Monitor,
  '9:16': Smartphone,
  '1:1': Square,
}

export const FORMAT_LABELS: Record<VideoFormat, string> = {
  '16:9': 'Paysage',
  '9:16': 'Portrait',
  '1:1': 'Carre',
}
