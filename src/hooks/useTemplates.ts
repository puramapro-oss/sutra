import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  const [loadedProfile, setLoadedProfile] = useState<string | undefined>()
  const pending = useRef<AbortController | null>(null)

  const loadTemplates = useCallback(() => {
    if (!profileId) return
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    const current = () => pending.current === controller && !controller.signal.aborted
    return Promise.all([
        supabase
          .from('user_templates')
          .select('*')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false })
          .abortSignal(controller.signal),
        supabase
          .from('user_templates')
          .select('*')
          .eq('is_public', true)
          .neq('user_id', profileId)
          .order('created_at', { ascending: false })
          .limit(20)
          .abortSignal(controller.signal),
      ]).then(([userRes, communityRes]) => {
      if (!current()) return
      if (userRes.error || communityRes.error) throw new Error('Templates unavailable')
      if (userRes.data) setUserTemplates(userRes.data as UserTemplate[])
      if (communityRes.data) setCommunityTemplates(communityRes.data as UserTemplate[])
    }).catch(() => {
      if (!current()) return
      setUserTemplates([])
      setCommunityTemplates([])
    }).finally(() => {
      if (!current()) return
      setLoadedProfile(profileId)
      setLoading(false)
      pending.current = null
    })
  }, [profileId])

  const fetchTemplates = useCallback(() => {
    if (!profileId) return
    setLoading(true)
    return loadTemplates()
  }, [profileId, loadTemplates])

  useEffect(() => {
    void loadTemplates()
    return () => { pending.current?.abort(); pending.current = null }
  }, [loadTemplates])

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
    userTemplates: loadedProfile === profileId ? userTemplates : [],
    setUserTemplates,
    communityTemplates: loadedProfile === profileId ? communityTemplates : [],
    loading: !!profileId && (loading || loadedProfile !== profileId),
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    filteredPresets,
    categoryCounts,
    fetchTemplates,
  }
}
