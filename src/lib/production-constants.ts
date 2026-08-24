import { Lightbulb, FileText, Film, Mic, Music, Layers, ImageIcon } from 'lucide-react'
import type { StepConfig, Template } from '@/types/production'

export const STEPS: StepConfig[] = [
  { id: 'idea', label: 'Idee', description: 'Decris ton projet', icon: Lightbulb },
  { id: 'script', label: 'Script', description: 'Claude genere le script', icon: FileText },
  { id: 'video', label: 'Video', description: 'LTX genere les scenes', icon: Film },
  { id: 'voice', label: 'Voix', description: 'ElevenLabs narration', icon: Mic },
  { id: 'music', label: 'Musique', description: 'Suno cree l\'ambiance', icon: Music },
  { id: 'assembly', label: 'Montage', description: 'Shotstack assemble', icon: Layers },
  { id: 'thumbnail', label: 'Miniature', description: 'Pollinations genere', icon: ImageIcon },
]

export const TEMPLATES: Template[] = [
  { id: 'youtube', label: 'YouTube', format: '16:9', duration: '8-12 min', description: 'Video longue, educative ou divertissante' },
  { id: 'tiktok', label: 'TikTok', format: '9:16', duration: '30-60s', description: 'Court, percutant, vertical' },
  { id: 'reel', label: 'Reel', format: '9:16', duration: '15-30s', description: 'Ultra-court, tendance Instagram' },
  { id: 'docu', label: 'Documentaire', format: '16:9', duration: '10-20 min', description: 'Narration profonde, images cinematiques' },
  { id: 'tuto', label: 'Tutoriel', format: '16:9', duration: '3-8 min', description: 'Pas a pas, ecran + narration' },
]

export const TONE_OPTIONS = ['professionnel', 'decontracte', 'dramatique', 'educatif', 'humoristique', 'inspirant']

export const MUSIC_STYLES = ['cinematic', 'lo-fi', 'epic', 'chill', 'motivational', 'dramatic', 'upbeat', 'ambient']
