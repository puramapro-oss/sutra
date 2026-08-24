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
import type { UserTemplate, VideoFormat } from '@/types'
import { CATEGORIES, PRESET_TEMPLATES, type PresetTemplate } from '@/data/template-data'

const supabase = createClient()

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
  const applyPresetTemplate = useCallback(
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

  const applyUserTemplate = useCallback(
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
                            onClick={() => applyPresetTemplate(template)}
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
                            onClick={() => applyUserTemplate(template)}
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
                          onClick={() => applyUserTemplate(template)}
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
