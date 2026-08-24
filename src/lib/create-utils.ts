import type { PipelineStep } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

export function getPipelineSteps(engine: VideoEngine): PipelineStep[] {
  const engineLabel = engine === 'ltx-pro' ? 'LTX 2.3 Pro' : engine === 'ltx-fast' ? 'LTX 2.3 Fast' : 'WAN 2.2'
  return [
    { id: 'script', label: 'Script genere par Claude', status: 'pending' },
    { id: 'narration', label: 'Narration voix — ElevenLabs', status: 'pending' },
    { id: 'music', label: 'Musique de fond — Suno', status: 'pending' },
    { id: 'scenes', label: `Scenes video IA — ${engineLabel}`, status: 'pending' },
    { id: 'stock', label: 'Videos stock — Pexels', status: 'pending' },
    { id: 'assembly', label: 'Assemblage final — Shotstack', status: 'pending' },
    { id: 'thumbnail', label: 'Miniature', status: 'pending' },
  ]
}

// Manual mode wizard steps
export const MANUAL_STEPS = ['mode', 'sujet', 'script', 'medias', 'options', 'confirmation'] as const

// Niche labels
export const NICHE_LABELS: Record<string, string> = {
  faceless: 'Faceless',
  education: 'Education',
  finance: 'Finance',
  health: 'Sante',
  tech: 'Tech',
  entertainment: 'Divertissement',
  business: 'Business',
}
