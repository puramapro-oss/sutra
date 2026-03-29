'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Layout,
  Play,
  Bookmark,
  BookmarkCheck,
  Eye,
  Plus,
  Search,
  Film,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { UserTemplate, VideoFormat } from '@/types'

const supabase = createClient()

interface PresetTemplate {
  id: string
  name: string
  description: string
  format: VideoFormat
  thumbnail: string
  category: string
  useCount: number
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'youtube-educatif',
    name: 'YouTube Educatif',
    description: 'Format long explicatif avec narration, illustrations IA et sous-titres animes.',
    format: '16:9',
    thumbnail: '/templates/youtube-edu.webp',
    category: 'YouTube',
    useCount: 12400,
  },
  {
    id: 'tiktok-viral',
    name: 'TikTok Viral',
    description: 'Format court vertical avec hook puissant, transitions rapides et texte dynamique.',
    format: '9:16',
    thumbnail: '/templates/tiktok-viral.webp',
    category: 'TikTok',
    useCount: 28900,
  },
  {
    id: 'short-motivation',
    name: 'Short Motivation',
    description: 'Video motivationnelle courte avec musique epique et citations inspirantes.',
    format: '9:16',
    thumbnail: '/templates/short-motivation.webp',
    category: 'Short',
    useCount: 8700,
  },
  {
    id: 'faceless-top10',
    name: 'Faceless Top 10',
    description: 'Video faceless style top 10/classement avec visuels stock et voix off.',
    format: '16:9',
    thumbnail: '/templates/faceless-top10.webp',
    category: 'Faceless',
    useCount: 15200,
  },
  {
    id: 'pub-produit',
    name: 'Pub Produit',
    description: 'Publicite produit courte avec mise en scene, features et CTA percutant.',
    format: '1:1',
    thumbnail: '/templates/pub-produit.webp',
    category: 'Marketing',
    useCount: 6300,
  },
]

const CATEGORIES = ['Tous', 'YouTube', 'TikTok', 'Short', 'Faceless', 'Marketing'] as const

export default function TemplatesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('Tous')
  const [savedTemplates, setSavedTemplates] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (authLoading || !profile) return

    async function fetchTemplates() {
      setLoading(true)
      const { data } = await supabase
        .from('user_templates')
        .select('*')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })

      if (data) setUserTemplates(data as UserTemplate[])
      setLoading(false)
    }

    fetchTemplates()
  }, [authLoading, profile])

  const filteredPresets = PRESET_TEMPLATES.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'Tous' || t.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const useTemplate = useCallback(
    (templateId: string) => {
      router.push(`/create?template=${templateId}`)
    },
    [router]
  )

  const useUserTemplate = useCallback(
    (template: UserTemplate) => {
      router.push(`/create?userTemplate=${template.id}`)
    },
    [router]
  )

  const toggleSave = useCallback(
    async (templateId: string) => {
      setSavedTemplates((prev) => {
        const next = new Set(prev)
        if (next.has(templateId)) {
          next.delete(templateId)
          toast.success('Template retire des favoris')
        } else {
          next.add(templateId)
          toast.success('Template sauvegarde !')
        }
        return next
      })
    },
    []
  )

  const deleteUserTemplate = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      setUserTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success('Template supprime')
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }, [])

  const formatFormatLabel = useCallback((format: VideoFormat) => {
    const map: Record<VideoFormat, string> = { '16:9': 'Paysage', '9:16': 'Portrait', '1:1': 'Carre' }
    return map[format] ?? format
  }, [])

  if (loading || authLoading) {
    return (
      <div className="space-y-6" data-testid="templates-loading">
        <Skeleton width={200} height={32} rounded="lg" />
        <Skeleton width="100%" height={48} rounded="xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={240} rounded="xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="templates-title">
            Templates
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Demarre rapidement avec des modeles pre-configures
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => router.push('/create')}
          data-testid="templates-create-new"
        >
          <Plus className="h-4 w-4" />
          Video vierge
        </Button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un template..."
            data-testid="templates-search"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 outline-none focus:border-violet-500/60 transition-colors"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              data-testid={`category-${cat}`}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                activeCategory === cat
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'bg-white/[0.02] text-white/40 hover:text-white/60'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Preset templates */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">
          Templates populaires
        </h2>
        {filteredPresets.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/30">
            Aucun template ne correspond a ta recherche
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPresets.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card hover data-testid={`template-${template.id}`}>
                  {/* Thumbnail */}
                  <div className="relative h-36 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-b border-white/[0.06] overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="h-10 w-10 text-white/10" />
                    </div>
                    {/* Format badge */}
                    <Badge variant="default" size="sm" className="absolute top-3 left-3">
                      {template.format}
                    </Badge>
                    {/* Save button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSave(template.id)
                      }}
                      data-testid={`save-template-${template.id}`}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                    >
                      {savedTemplates.has(template.id) ? (
                        <BookmarkCheck className="h-4 w-4 text-violet-400" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-white">{template.name}</h3>
                      <Badge variant="info" size="sm">{template.category}</Badge>
                    </div>
                    <p className="text-xs text-white/40 line-clamp-2 mb-3">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-white/25">
                        <Eye className="h-3 w-3" />
                        {template.useCount.toLocaleString('fr-FR')} utilisations
                      </div>
                      <Button
                        size="sm"
                        onClick={() => useTemplate(template.id)}
                        data-testid={`use-template-${template.id}`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Utiliser
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* User's saved templates */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">
          Mes templates
          {userTemplates.length > 0 && (
            <span className="text-white/30 font-normal ml-1">({userTemplates.length})</span>
          )}
        </h2>
        {userTemplates.length === 0 ? (
          <EmptyState
            icon={Layout}
            title="Aucun template sauvegarde"
            description="Sauvegarde une video comme template pour la reutiliser plus tard."
            data-testid="templates-user-empty"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userTemplates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card hover data-testid={`user-template-${template.id}`}>
                  <div className="relative h-28 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-b border-white/[0.06] flex items-center justify-center">
                    <Layout className="h-8 w-8 text-white/10" />
                    <Badge variant="success" size="sm" className="absolute top-3 left-3">
                      {formatFormatLabel(template.format)}
                    </Badge>
                  </div>
                  <CardContent className="py-3">
                    <h3 className="text-sm font-medium text-white mb-1">{template.name}</h3>
                    {template.description && (
                      <p className="text-xs text-white/30 line-clamp-1 mb-3">{template.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => useUserTemplate(template)}
                        data-testid={`use-user-template-${template.id}`}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Utiliser
                      </Button>
                      <button
                        onClick={() => deleteUserTemplate(template.id)}
                        data-testid={`delete-user-template-${template.id}`}
                        className="px-2 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
