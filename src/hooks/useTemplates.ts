import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { PRESET_TEMPLATES, type PresetTemplate } from '@/data/template-data'
import type { UserTemplate } from '@/types'

const supabase = createClient()

export function useTemplates(profileId?: string) {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([])
  const [communityTemplates, setCommunityTemplates] = useState<UserTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const fetchTemplates = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    try {
      const [userRes, communityRes] = await Promise.all([
        supabase
          .from('user_templates')
          .select('*')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_templates')
          .select('*')
          .eq('is_public', true)
          .neq('user_id', profileId)
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
  }, [profileId])

  useEffect(() => {
    if (profileId) fetchTemplates()
  }, [profileId, fetchTemplates])

  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return PRESET_TEMPLATES.filter((t: PresetTemplate) => {
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [searchQuery, activeCategory])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: PRESET_TEMPLATES.length }
    for (const t of PRESET_TEMPLATES) {
      counts[t.category] = (counts[t.category] ?? 0) + 1
    }
    return counts
  }, [])

  return {
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
  }
}
