'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layout,
  Play,
  Plus,
  Search,
  Clock,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  Users,
  Globe,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { VOICE_STYLES } from '@/lib/constants'
import type { UserTemplate, VideoFormat } from '@/types'

const supabase = createClient()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PresetTemplate {
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

// ---------------------------------------------------------------------------
// 10 categories + 30 preset templates
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 'all', label: 'Tous', icon: '🎬' },
  { id: 'pub-produit', label: 'Pub Produit', icon: '📦' },
  { id: 'ugc', label: 'UGC Simule', icon: '🤳' },
  { id: 'stories-reels', label: 'Stories/Reels', icon: '📱' },
  { id: 'youtube-faceless', label: 'YouTube Faceless', icon: '🎥' },
  { id: 'documentaire', label: 'Documentaire', icon: '🎞️' },
  { id: 'tutoriel', label: 'Tutoriel', icon: '📚' },
  { id: 'presentation', label: 'Presentation', icon: '💼' },
  { id: 'clip-musical', label: 'Clip Musical', icon: '🎵' },
  { id: 'teaser', label: 'Teaser', icon: '🔥' },
  { id: 'avant-apres', label: 'Avant/Apres', icon: '✨' },
] as const

const PRESET_TEMPLATES: PresetTemplate[] = [
  // ── Pub Produit ──────────────────────────────────────────
  {
    id: 'pub-demo-produit',
    name: 'Demo produit',
    category: 'pub-produit',
    description: 'Presentation dynamique d\'un produit avec ses fonctionnalites cles, gros plans et CTA percutant.',
    format: '1:1',
    duration: '30-60s',
    suggestedVoice: 'energetic_female',
    prompt: 'Demo produit montrant les fonctionnalites principales avec transitions fluides et texte anime',
    style: 'corporate-energique',
    icon: '📦',
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'pub-unboxing',
    name: 'Unboxing',
    category: 'pub-produit',
    description: 'Experience d\'ouverture de produit captivante avec suspense, gros plans et premiere impression authentique.',
    format: '9:16',
    duration: '45-90s',
    suggestedVoice: 'dynamic_female',
    prompt: 'Video unboxing avec suspense, gros plans sur le packaging et decouverte enthousiaste du produit',
    style: 'lifestyle-authentique',
    icon: '🎁',
    color: 'from-pink-500/20 to-rose-500/20',
  },
  {
    id: 'pub-comparatif',
    name: 'Comparatif',
    category: 'pub-produit',
    description: 'Comparaison visuelle entre deux produits avec split-screen, avantages/inconvenients et verdict final.',
    format: '16:9',
    duration: '60-120s',
    suggestedVoice: 'narrator_deep',
    prompt: 'Comparatif detaille entre deux produits avec split screen, tableau de scores et verdict argumente',
    style: 'analytique-visuel',
    icon: '⚖️',
    color: 'from-amber-500/20 to-orange-500/20',
  },
  // ── UGC Simule ───────────────────────────────────────────
  {
    id: 'ugc-temoignage',
    name: 'Temoignage',
    category: 'ugc',
    description: 'Temoignage client realiste filme en selfie avec sous-titres animes et ton authentique.',
    format: '9:16',
    duration: '30-60s',
    suggestedVoice: 'default_french_female',
    prompt: 'Temoignage client enthousiaste filmant en selfie, partageant son experience positive avec le produit',
    style: 'ugc-selfie',
    icon: '💬',
    color: 'from-green-500/20 to-emerald-500/20',
  },
  {
    id: 'ugc-routine',
    name: 'Routine',
    category: 'ugc',
    description: 'Video "ma routine quotidienne" integrant naturellement un produit dans un contexte de vie reelle.',
    format: '9:16',
    duration: '45-90s',
    suggestedVoice: 'energetic_female',
    prompt: 'Routine matinale montrant l\'utilisation naturelle du produit dans le quotidien avec transitions douces',
    style: 'lifestyle-naturel',
    icon: '☀️',
    color: 'from-yellow-500/20 to-amber-500/20',
  },
  {
    id: 'ugc-avis-client',
    name: 'Avis client',
    category: 'ugc',
    description: 'Review honnete et structure d\'un produit avec note, pour/contre et recommandation finale.',
    format: '9:16',
    duration: '30-45s',
    suggestedVoice: 'calm_male',
    prompt: 'Avis client structure avec note sur 5, points forts et points faibles, recommandation finale sincere',
    style: 'review-authentique',
    icon: '⭐',
    color: 'from-violet-500/20 to-purple-500/20',
  },
  // ── Stories/Reels ────────────────────────────────────────
  {
    id: 'stories-trend-tiktok',
    name: 'Trend TikTok',
    category: 'stories-reels',
    description: 'Contenu viral suivant les tendances du moment avec hook percutant et format vertical optimise.',
    format: '9:16',
    duration: '15-30s',
    suggestedVoice: 'dynamic_female',
    prompt: 'Video TikTok virale avec hook dans les 3 premieres secondes, musique tendance et texte dynamique',
    style: 'viral-energique',
    icon: '🔥',
    color: 'from-red-500/20 to-pink-500/20',
  },
  {
    id: 'stories-behind-scenes',
    name: 'Behind the scenes',
    category: 'stories-reels',
    description: 'Coulisses authentiques de la creation : bureau, equipe, processus de fabrication ou tournage.',
    format: '9:16',
    duration: '30-60s',
    suggestedVoice: 'calm_male',
    prompt: 'Coulisses de la creation montrant les etapes de fabrication avec un ton humain et transparent',
    style: 'backstage-intime',
    icon: '🎬',
    color: 'from-slate-500/20 to-gray-500/20',
  },
  {
    id: 'stories-quick-tip',
    name: 'Quick tip',
    category: 'stories-reels',
    description: 'Astuce rapide et actionnable en moins de 30 secondes avec texte overlay et musique catchy.',
    format: '9:16',
    duration: '15-30s',
    suggestedVoice: 'energetic_female',
    prompt: 'Astuce rapide et utile avec texte en gros, illustration visuelle et musique entrainante',
    style: 'tips-percutant',
    icon: '💡',
    color: 'from-cyan-500/20 to-teal-500/20',
  },
  // ── YouTube Faceless ─────────────────────────────────────
  {
    id: 'faceless-top10',
    name: 'Top 10',
    category: 'youtube-faceless',
    description: 'Classement top 10 avec visuels stock, voix off engageante, compteur numerote et transitions dynamiques.',
    format: '16:9',
    duration: '5-10min',
    suggestedVoice: 'narrator_deep',
    prompt: 'Top 10 des elements les plus incroyables avec voix off captivante, visuels percutants et countdown',
    style: 'listicle-cinematique',
    icon: '🏆',
    color: 'from-amber-500/20 to-yellow-500/20',
  },
  {
    id: 'faceless-mystere',
    name: 'Mystere',
    category: 'youtube-faceless',
    description: 'Narration mysterieuse avec ambiance sombre, musique suspense et revelations progressives.',
    format: '16:9',
    duration: '8-15min',
    suggestedVoice: 'narrator_deep',
    prompt: 'Video mystere avec narration suspenseful, visuels sombres et revelations progressives captivantes',
    style: 'dark-mystere',
    icon: '🔮',
    color: 'from-indigo-500/20 to-violet-500/20',
  },
  {
    id: 'faceless-faits-insolites',
    name: 'Faits insolites',
    category: 'youtube-faceless',
    description: 'Compilation de faits surprenants avec infographies animees, chiffres percutants et ton energique.',
    format: '16:9',
    duration: '5-10min',
    suggestedVoice: 'default_french_male',
    prompt: 'Faits insolites et surprenants avec infographies animees, chiffres chocs et transitions rapides',
    style: 'edutainment-fun',
    icon: '🧠',
    color: 'from-fuchsia-500/20 to-pink-500/20',
  },
  // ── Documentaire ─────────────────────────────────────────
  {
    id: 'doc-mini-doc',
    name: 'Mini-doc',
    category: 'documentaire',
    description: 'Mini documentaire cinematographique avec narration soignee, b-roll immersif et structure narrative forte.',
    format: '16:9',
    duration: '3-5min',
    suggestedVoice: 'narrator_deep',
    prompt: 'Mini documentaire avec introduction cinematographique, temoignages, b-roll immersif et conclusion forte',
    style: 'cinema-doc',
    icon: '🎞️',
    color: 'from-emerald-500/20 to-green-500/20',
  },
  {
    id: 'doc-portrait',
    name: 'Portrait',
    category: 'documentaire',
    description: 'Portrait intime d\'une personne ou marque avec interviews, moments de vie et narration emotionnelle.',
    format: '16:9',
    duration: '3-8min',
    suggestedVoice: 'calm_male',
    prompt: 'Portrait documentaire avec interview intime, images de la vie quotidienne et narration emotionnelle',
    style: 'portrait-intime',
    icon: '👤',
    color: 'from-sky-500/20 to-blue-500/20',
  },
  {
    id: 'doc-investigation',
    name: 'Investigation',
    category: 'documentaire',
    description: 'Enquete journalistique avec preuves visuelles, timeline chronologique et revelations progressives.',
    format: '16:9',
    duration: '5-15min',
    suggestedVoice: 'narrator_deep',
    prompt: 'Enquete documentaire avec preuves, timeline chronologique, temoignages et revelations choquantes',
    style: 'investigation-serieux',
    icon: '🔍',
    color: 'from-red-500/20 to-orange-500/20',
  },
  // ── Tutoriel ─────────────────────────────────────────────
  {
    id: 'tuto-pas-a-pas',
    name: 'Pas-a-pas',
    category: 'tutoriel',
    description: 'Tutoriel etape par etape avec numerotation claire, zoom sur les details et recapitulatif final.',
    format: '16:9',
    duration: '3-8min',
    suggestedVoice: 'default_french_male',
    prompt: 'Tutoriel pas-a-pas avec numerotation visuelle, gros plans sur chaque etape et recapitulatif final',
    style: 'pedagogique-clair',
    icon: '📝',
    color: 'from-blue-500/20 to-indigo-500/20',
  },
  {
    id: 'tuto-recette',
    name: 'Recette',
    category: 'tutoriel',
    description: 'Video recette appetissante avec ingredients, etapes chronologiques et resultat final en gros plan.',
    format: '9:16',
    duration: '60-90s',
    suggestedVoice: 'energetic_female',
    prompt: 'Video recette avec liste d\'ingredients, etapes de preparation filmees en overhead et resultat final gourmand',
    style: 'food-appetissant',
    icon: '🍳',
    color: 'from-orange-500/20 to-red-500/20',
  },
  {
    id: 'tuto-diy',
    name: 'DIY',
    category: 'tutoriel',
    description: 'Projet creatif do-it-yourself avec liste de materiaux, etapes illustrees et resultat avant/apres.',
    format: '9:16',
    duration: '60-120s',
    suggestedVoice: 'dynamic_female',
    prompt: 'Tutoriel DIY avec materiel necessaire, etapes de fabrication en time-lapse et resultat final impressionnant',
    style: 'craft-creatif',
    icon: '🛠️',
    color: 'from-teal-500/20 to-emerald-500/20',
  },
  // ── Presentation ─────────────────────────────────────────
  {
    id: 'pres-pitch-startup',
    name: 'Pitch startup',
    category: 'presentation',
    description: 'Pitch deck anime avec probleme, solution, marche, business model et call-to-action investisseur.',
    format: '16:9',
    duration: '60-120s',
    suggestedVoice: 'default_french_male',
    prompt: 'Pitch startup avec presentation du probleme, solution innovante, taille du marche et appel aux investisseurs',
    style: 'startup-bold',
    icon: '🚀',
    color: 'from-violet-500/20 to-purple-500/20',
  },
  {
    id: 'pres-produit',
    name: 'Presentation produit',
    category: 'presentation',
    description: 'Presentation premium d\'un produit ou service avec features, benefices et temoignages clients.',
    format: '16:9',
    duration: '60-180s',
    suggestedVoice: 'calm_male',
    prompt: 'Presentation produit elegante avec fonctionnalites cles, benefices utilisateurs et preuves sociales',
    style: 'premium-elegant',
    icon: '💎',
    color: 'from-sky-500/20 to-cyan-500/20',
  },
  {
    id: 'pres-rapport',
    name: 'Rapport',
    category: 'presentation',
    description: 'Rapport anime avec graphiques, KPIs, analyses et recommandations. Ideal pour boards et investisseurs.',
    format: '16:9',
    duration: '120-300s',
    suggestedVoice: 'narrator_deep',
    prompt: 'Rapport annuel anime avec graphiques dynamiques, KPIs cles, analyse des resultats et perspectives',
    style: 'data-corporate',
    icon: '📊',
    color: 'from-slate-500/20 to-zinc-500/20',
  },
  // ── Clip Musical ─────────────────────────────────────────
  {
    id: 'clip-lyric-video',
    name: 'Lyric video',
    category: 'clip-musical',
    description: 'Video lyrics animee avec typographie cinematique, effets visuels synchronises sur la musique.',
    format: '16:9',
    duration: '2-4min',
    suggestedVoice: 'default_french_male',
    prompt: 'Lyric video avec typographie animee, effets visuels synchronises sur le rythme et ambiance immersive',
    style: 'typo-cinematique',
    icon: '🎤',
    color: 'from-pink-500/20 to-purple-500/20',
  },
  {
    id: 'clip-visualizer',
    name: 'Visualizer',
    category: 'clip-musical',
    description: 'Visualiseur audio reactif avec ondes sonores, particules et effets lies au spectre audio.',
    format: '16:9',
    duration: '2-5min',
    suggestedVoice: 'default_french_male',
    prompt: 'Visualiseur audio avec ondes sonores animees, particules reactives et couleurs pulsant au rythme',
    style: 'audio-reactive',
    icon: '🎧',
    color: 'from-cyan-500/20 to-blue-500/20',
  },
  {
    id: 'clip-narratif',
    name: 'Clip narratif',
    category: 'clip-musical',
    description: 'Clip musical avec histoire narrative, personnages IA generes et montage cinematographique.',
    format: '16:9',
    duration: '3-5min',
    suggestedVoice: 'dynamic_female',
    prompt: 'Clip musical narratif avec histoire emotionnelle, personnages, decors cinematographiques et montage rythme',
    style: 'cinema-narratif',
    icon: '🎬',
    color: 'from-rose-500/20 to-red-500/20',
  },
  // ── Teaser ───────────────────────────────────────────────
  {
    id: 'teaser-trailer-film',
    name: 'Trailer film',
    category: 'teaser',
    description: 'Bande-annonce cinematographique avec montage rythmique, sound design puissant et reveal final.',
    format: '16:9',
    duration: '30-90s',
    suggestedVoice: 'narrator_deep',
    prompt: 'Trailer cinematographique avec montage nerveux, voix off epique, sound design percutant et reveal final',
    style: 'cinema-epique',
    icon: '🎬',
    color: 'from-red-500/20 to-amber-500/20',
  },
  {
    id: 'teaser-lancement-produit',
    name: 'Lancement produit',
    category: 'teaser',
    description: 'Teaser de lancement avec compte a rebours, build-up progressif et grande revelation produit.',
    format: '1:1',
    duration: '15-30s',
    suggestedVoice: 'energetic_female',
    prompt: 'Teaser de lancement produit avec suspense, countdown, build-up sonore et revelation spectaculaire',
    style: 'launch-hype',
    icon: '🎯',
    color: 'from-violet-500/20 to-fuchsia-500/20',
  },
  {
    id: 'teaser-evenement',
    name: 'Evenement',
    category: 'teaser',
    description: 'Teaser evenementiel avec date, lieu, speakers/artistes, ambiance et call-to-action inscription.',
    format: '9:16',
    duration: '15-30s',
    suggestedVoice: 'dynamic_female',
    prompt: 'Teaser evenement avec date, lieu, intervenants, ambiance immersive et bouton d\'inscription',
    style: 'event-premium',
    icon: '🎉',
    color: 'from-amber-500/20 to-yellow-500/20',
  },
  // ── Avant/Apres ──────────────────────────────────────────
  {
    id: 'aa-transformation',
    name: 'Transformation',
    category: 'avant-apres',
    description: 'Transformation spectaculaire avec split-screen, transition wipe et resultat final impressionnant.',
    format: '9:16',
    duration: '15-30s',
    suggestedVoice: 'energetic_female',
    prompt: 'Video transformation avec avant clairement montre, transition wipe spectaculaire et apres impressionnant',
    style: 'reveal-dramatique',
    icon: '🦋',
    color: 'from-purple-500/20 to-violet-500/20',
  },
  {
    id: 'aa-renovation',
    name: 'Renovation',
    category: 'avant-apres',
    description: 'Projet renovation avec etat initial, time-lapse des travaux et reveal final en musique.',
    format: '9:16',
    duration: '30-60s',
    suggestedVoice: 'calm_male',
    prompt: 'Renovation avec etat initial delabrant, time-lapse des travaux, musique montante et reveal final eblouissant',
    style: 'reno-timelapse',
    icon: '🏠',
    color: 'from-orange-500/20 to-amber-500/20',
  },
  {
    id: 'aa-fitness',
    name: 'Resultat fitness',
    category: 'avant-apres',
    description: 'Progression fitness avec photos avant/apres, timeline, stats et message motivationnel.',
    format: '9:16',
    duration: '15-30s',
    suggestedVoice: 'default_french_male',
    prompt: 'Transformation fitness avec photos avant/apres, timeline de progression, stats et message inspirant',
    style: 'fitness-motivation',
    icon: '💪',
    color: 'from-green-500/20 to-lime-500/20',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORMAT_ICONS: Record<VideoFormat, typeof Monitor> = {
  '16:9': Monitor,
  '9:16': Smartphone,
  '1:1': Square,
}

const FORMAT_LABELS: Record<VideoFormat, string> = {
  '16:9': 'Paysage',
  '9:16': 'Portrait',
  '1:1': 'Carre',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([])
  const [communityTemplates, setCommunityTemplates] = useState<UserTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  // ── Fetch user + community templates ────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const [userRes, communityRes] = await Promise.all([
        supabase
          .from('user_templates')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_templates')
          .select('*')
          .eq('is_public', true)
          .neq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (userRes.data) setUserTemplates(userRes.data as UserTemplate[])
      if (communityRes.data) setCommunityTemplates(communityRes.data as UserTemplate[])
    } catch {
      setUserTemplates([])
      setCommunityTemplates([])
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchTemplates()
  }, [authLoading, profile?.id, fetchTemplates])

  // ── Filter presets ──────────────────────────────────────
  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return PRESET_TEMPLATES.filter((t) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, activeCategory])

  // ── Actions ─────────────────────────────────────────────
  const usePresetTemplate = useCallback(
    (template: PresetTemplate) => {
      const params = new URLSearchParams({
        template: template.id,
        format: template.format,
        voice: template.suggestedVoice,
        style: template.style,
        prompt: template.prompt,
      })
      router.push(`/create?${params.toString()}`)
    },
    [router]
  )

  const useUserTemplate = useCallback(
    (template: UserTemplate) => {
      router.push(`/create?userTemplate=${template.id}`)
    },
    [router]
  )

  const deleteUserTemplate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('user_templates').delete().eq('id', id)
      if (error) throw error
      setUserTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success('Template supprime')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }, [])

  // ── Category count ──────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PRESET_TEMPLATES.length }
    for (const t of PRESET_TEMPLATES) {
      counts[t.category] = (counts[t.category] ?? 0) + 1
    }
    return counts
  }, [])

  // ── Skeleton ────────────────────────────────────────────
  const templatesSkeleton = (
    <div className="space-y-6" data-testid="templates-loading">
      <Skeleton width={260} height={36} rounded="lg" />
      <Skeleton width="100%" height={48} rounded="xl" />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={100} height={36} rounded="lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={220} rounded="xl" />
        ))}
      </div>
    </div>
  )

  if (authLoading) return templatesSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchTemplates} skeleton={templatesSkeleton}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="space-y-8 max-w-7xl mx-auto"
      >
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-white"
              data-testid="templates-title"
            >
              Bibliotheque de templates
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {PRESET_TEMPLATES.length} modeles dans {CATEGORIES.length - 1} categories pour creer tes videos en un clic
            </p>
          </div>
          <Button
            onClick={() => router.push('/create')}
            data-testid="templates-create-new"
          >
            <Plus className="h-4 w-4" />
            Creer un template
          </Button>
        </div>

        {/* ── Search ─────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un template par nom, categorie ou description..."
            data-testid="templates-search"
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 outline-none focus:border-violet-500/50 focus:bg-white/[0.04] transition-all"
          />
        </div>

        {/* ── Category Tabs ──────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-testid={`category-${cat.id}`}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 border shrink-0',
                activeCategory === cat.id
                  ? 'bg-violet-500/15 text-violet-400 border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
                  : 'bg-white/[0.02] text-white/40 border-white/[0.04] hover:bg-white/[0.04] hover:text-white/60'
              )}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
              {categoryCounts[cat.id] != null && (
                <span className={cn(
                  'ml-0.5 text-[10px]',
                  activeCategory === cat.id ? 'text-violet-400/60' : 'text-white/20'
                )}>
                  {categoryCounts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Preset Templates Grid ──────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white/70">
              Templates predefinis
            </h2>
            <Badge variant="premium" size="sm">{filteredPresets.length}</Badge>
          </div>

          <AnimatePresence mode="popLayout">
            {filteredPresets.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center text-sm text-white/30"
              >
                Aucun template ne correspond a ta recherche
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
              >
                {filteredPresets.map((template, i) => {
                  const FormatIcon = FORMAT_ICONS[template.format]
                  return (
                    <motion.div
                      key={template.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <Card hover data-testid={`template-${template.id}`}>
                        {/* Colored accent top */}
                        <div className={cn(
                          'h-1 w-full bg-gradient-to-r rounded-t-2xl',
                          template.color
                        )} />

                        <CardContent className="pt-4 pb-3">
                          {/* Icon + Format */}
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-2xl">{template.icon}</span>
                            <Badge variant="default" size="sm" className="gap-1">
                              <FormatIcon className="h-2.5 w-2.5" />
                              {template.format}
                            </Badge>
                          </div>

                          {/* Name */}
                          <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                            {template.name}
                          </h3>

                          {/* Description */}
                          <p className="text-[11px] sm:text-xs text-white/35 line-clamp-2 mb-3 min-h-[2.5em]">
                            {template.description}
                          </p>

                          {/* Duration + Format label */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1 text-[10px] text-white/25">
                              <Clock className="h-3 w-3" />
                              {template.duration}
                            </div>
                            <div className="text-[10px] text-white/20">
                              {FORMAT_LABELS[template.format]}
                            </div>
                          </div>

                          {/* Use button */}
                          <Button
                            size="sm"
                            onClick={() => usePresetTemplate(template)}
                            data-testid={`use-template-${template.id}`}
                            className="w-full justify-center"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Utiliser
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Mes Templates ──────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layout className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/70">
              Mes templates
            </h2>
            {userTemplates.length > 0 && (
              <Badge variant="success" size="sm">{userTemplates.length}</Badge>
            )}
          </div>

          {userTemplates.length === 0 ? (
            <EmptyState
              icon={Layout}
              title="Aucun template sauvegarde"
              description="Sauvegarde une video comme template pour la reutiliser facilement."
              data-testid="templates-user-empty"
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {userTemplates.map((template, i) => {
                const FormatIcon = FORMAT_ICONS[template.format] ?? Square
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card hover data-testid={`user-template-${template.id}`}>
                      <div className="h-1 w-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 rounded-t-2xl" />
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <Layout className="h-5 w-5 text-emerald-400/50" />
                          <Badge variant="default" size="sm" className="gap-1">
                            <FormatIcon className="h-2.5 w-2.5" />
                            {template.format}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-[11px] text-white/30 line-clamp-2 mb-3">
                            {template.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => useUserTemplate(template)}
                            data-testid={`use-user-template-${template.id}`}
                            className="flex-1 justify-center"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Utiliser
                          </Button>
                          <button
                            onClick={() => deleteUserTemplate(template.id)}
                            data-testid={`delete-user-template-${template.id}`}
                            className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Templates Communautaires ────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white/70">
              Templates communautaires
            </h2>
            {communityTemplates.length > 0 && (
              <Badge variant="info" size="sm">{communityTemplates.length}</Badge>
            )}
          </div>

          {communityTemplates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun template communautaire"
              description="Les templates publics partages par la communaute apparaitront ici."
              data-testid="templates-community-empty"
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {communityTemplates.map((template, i) => {
                const FormatIcon = FORMAT_ICONS[template.format] ?? Square
                return (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card hover data-testid={`community-template-${template.id}`}>
                      <div className="h-1 w-full bg-gradient-to-r from-blue-500/30 to-indigo-500/30 rounded-t-2xl" />
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between mb-2">
                          <Globe className="h-5 w-5 text-blue-400/50" />
                          <Badge variant="default" size="sm" className="gap-1">
                            <FormatIcon className="h-2.5 w-2.5" />
                            {template.format}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-medium text-white mb-1 line-clamp-1">
                          {template.name}
                        </h3>
                        {template.description && (
                          <p className="text-[11px] text-white/30 line-clamp-2 mb-3">
                            {template.description}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => useUserTemplate(template)}
                          data-testid={`use-community-template-${template.id}`}
                          className="w-full justify-center"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Utiliser
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </section>
      </motion.div>
    </LoadingTimeout>
  )
}
