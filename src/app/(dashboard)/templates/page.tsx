'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, Layout, Users, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTemplates } from '@/hooks/useTemplates'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { PRESET_TEMPLATES, CATEGORIES } from '@/data/template-data'
import {
  TemplateCard,
  UserTemplateCard,
  CommunityTemplateCard,
  CategoryTabs,
  TemplateSearch,
} from '@/components/templates'
import type { UserTemplate } from '@/types'
import type { PresetTemplate } from '@/data/template-data'

const supabase = createClient()

export default function TemplatesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const {
    userTemplates,
    setUserTemplates,
    communityTemplates,
    loading,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    filteredPresets,
    categoryCounts,
    fetchTemplates,
  } = useTemplates(profile?.id)

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
  }, [setUserTemplates])

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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white" data-testid="templates-title">
              Bibliotheque de templates
            </h1>
            <p className="text-sm text-white/40 mt-1">
              {PRESET_TEMPLATES.length} modeles dans {CATEGORIES.length - 1} categories pour creer tes
              videos en un clic
            </p>
          </div>
          <Button onClick={() => router.push('/create')} data-testid="templates-create-new">
            <Plus className="h-4 w-4" />
            Creer un template
          </Button>
        </div>

        {/* Search */}
        <TemplateSearch value={searchQuery} onChange={setSearchQuery} />

        {/* Category Tabs */}
        <CategoryTabs
          activeCategory={activeCategory}
          categoryCounts={categoryCounts}
          onCategoryChange={setActiveCategory}
        />

        {/* Preset Templates Grid */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white/70">Templates predefinis</h2>
            <Badge variant="premium" size="sm">
              {filteredPresets.length}
            </Badge>
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
              <motion.div key="grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredPresets.map((template, i) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={i}
                    onApply={applyPresetTemplate}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* User Templates */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layout className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/70">Mes templates</h2>
            {userTemplates.length > 0 && (
              <Badge variant="success" size="sm">
                {userTemplates.length}
              </Badge>
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
              {userTemplates.map((template, i) => (
                <UserTemplateCard
                  key={template.id}
                  template={template}
                  index={i}
                  onApply={applyUserTemplate}
                  onDelete={deleteUserTemplate}
                />
              ))}
            </div>
          )}
        </section>

        {/* Community Templates */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white/70">Templates communautaires</h2>
            <Badge variant="info" size="sm">
              {communityTemplates.length}
            </Badge>
          </div>

          {communityTemplates.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun template communautaire"
              description="Les templates publics des autres utilisateurs apparaitront ici."
              data-testid="templates-community-empty"
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {communityTemplates.map((template, i) => (
                <CommunityTemplateCard
                  key={template.id}
                  template={template}
                  index={i}
                  onApply={applyUserTemplate}
                />
              ))}
            </div>
          )}
        </section>
      </motion.div>
    </LoadingTimeout>
  )
}
