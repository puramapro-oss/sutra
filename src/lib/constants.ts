import type { Plan } from '@/types'

export const SUPER_ADMIN_EMAIL = 'matiss.frasne@gmail.com'
export const DOMAIN = 'purama.dev'
export const APP_NAME = 'SUTRA'
export const APP_SLUG = 'sutra'

export const PLAN_LIMITS: Record<Plan, {
  videos: number
  quality: string
  voices: number
  autopilot: number
  rate: number
  templates: number
  networks: number
  studio: string
}> = {
  free: { videos: 2, quality: '720p', voices: 0, autopilot: 0, rate: 5, templates: 3, networks: 0, studio: 'preview' },
  starter: { videos: 10, quality: '720p', voices: 0, autopilot: 0, rate: 15, templates: 10, networks: 1, studio: 'basic' },
  creator: { videos: 50, quality: '1080p', voices: 3, autopilot: 1, rate: 30, templates: 999, networks: 3, studio: 'full' },
  empire: { videos: 9999, quality: '4k', voices: 99, autopilot: 5, rate: 60, templates: 999, networks: 99, studio: 'full+export' },
  admin: { videos: Infinity, quality: '4k', voices: Infinity, autopilot: Infinity, rate: Infinity, templates: Infinity, networks: Infinity, studio: 'full+export' },
}

export const PLAN_PRICES = {
  starter: { monthly: 9, annual: 86 },
  creator: { monthly: 29, annual: 278 },
  empire: { monthly: 99, annual: 950 },
}

export const WALLET_MIN_WITHDRAWAL = 50
export const WALLET_MAX_WITHDRAWAL = 1000

export const REFERRAL_COMMISSIONS = {
  filleul_discount: 0.5,
  parrain_first_payment: 0.5,
  parrain_recurring: 0.1,
  parrain_own_discount: 0.1,
  milestone_bonus: 0.3,
  milestone_every: 10,
}

export const CONTEST_DISTRIBUTION = [25, 18, 14, 10, 8, 7, 6, 5, 4, 3]

export const COMPANY_INFO = {
  name: 'Purama',
  type: 'Micro-entreprise',
  tva: 'TVA non applicable, art. 293B du CGI',
  email: 'matiss.frasne@gmail.com',
}

export const NICHES = [
  'bien-etre',
  'tech',
  'finance',
  'motivation',
  'lifestyle',
  'education',
  'divertissement',
  'cuisine',
  'sport',
  'voyage',
  'science',
  'business',
] as const

export const VOICE_STYLES = [
  { id: 'default_french_male', name: 'Thomas', lang: 'fr', gender: 'male' },
  { id: 'default_french_female', name: 'Marie', lang: 'fr', gender: 'female' },
  { id: 'narrator_deep', name: 'Narrateur', lang: 'fr', gender: 'male' },
  { id: 'energetic_female', name: 'Emma', lang: 'fr', gender: 'female' },
  { id: 'calm_male', name: 'Lucas', lang: 'fr', gender: 'male' },
  { id: 'dynamic_female', name: 'Lea', lang: 'fr', gender: 'female' },
] as const

export const TIMEOUTS = {
  claude: 30_000,
  elevenlabs: 60_000,
  runpod: 300_000,
  suno: 120_000,
  shotstack: 300_000,
  pexels: 10_000,
  falai: 180_000,
} as const

export const PURAMA_APPS = [
  { name: 'JurisPurama', slug: 'jurispurama', color: '#6D28D9', description: 'Assistant juridique IA' },
  { name: 'KAIA', slug: 'kaia', color: '#06B6D4', description: 'Coach bien-etre IA' },
  { name: 'VIDA Sante', slug: 'vida', color: '#10B981', description: 'Coach sante IA' },
  { name: 'Lingora', slug: 'lingora', color: '#3B82F6', description: 'Apprentissage des langues IA' },
  { name: 'KASH', slug: 'kash', color: '#F59E0B', description: 'Coach finance IA' },
  { name: 'DONA', slug: 'dona', color: '#EC4899', description: 'Dons et solidarite' },
  { name: 'VOYA', slug: 'voya', color: '#38BDF8', description: 'Assistant voyage IA' },
  { name: 'EntreprisePilot', slug: 'pilot', color: '#6366F1', description: 'Gestion entreprise IA' },
  { name: 'Impact OS', slug: 'impact', color: '#14B8A6', description: 'Impact social IA' },
  { name: 'Purama AI', slug: 'ai', color: '#8B5CF6', description: 'IA conversationnelle' },
  { name: 'SUTRA', slug: 'sutra', color: '#8B5CF6', description: 'Generation video IA' },
]
