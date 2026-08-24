import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { VideoRecord, DailyCount, Stats } from '@/lib/analytics'
import { COST_PER_VIDEO, ENGINES } from '@/lib/analytics'

interface UseAnalyticsProps {
  userId?: string
  credits?: number
}

export function useAnalytics({ userId, credits }: UseAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    videosThisMonth: 0,
    totalDuration: 0,
    totalCost: 0,
    creditsUsed: 0,
  })
  const [recentVideos, setRecentVideos] = useState<VideoRecord[]>([])
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([])
  const [allVideos, setAllVideos] = useState<VideoRecord[]>([])

  const fetchAnalytics = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, format, quality, duration, engine, created_at, script_data, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error || !videos) {
        setLoading(false)
        return
      }

      const typedVideos = videos as unknown as VideoRecord[]
      setAllVideos(typedVideos)
      setRecentVideos(typedVideos.slice(0, 5))

      const thisMonthVideos = typedVideos.filter((v) => v.created_at >= startOfMonth)
      const totalDuration = typedVideos.reduce((sum, v) => sum + (v.duration ?? 0), 0)

      setStats({
        videosThisMonth: thisMonthVideos.length,
        totalDuration,
        totalCost: typedVideos.length * COST_PER_VIDEO,
        creditsUsed: credits ?? 0,
      })

      const days: DailyCount[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const count = typedVideos.filter((v) => v.created_at.split('T')[0] === dateStr).length
        days.push({ date: dateStr, count })
      }
      setDailyCounts(days)
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [userId, credits])

  useEffect(() => {
    if (userId) {
      fetchAnalytics()
    }
  }, [userId, fetchAnalytics])

  const engineStats = useMemo(() => {
    if (allVideos.length === 0) {
      return ENGINES.map((e) => ({ ...e, count: 0, percent: 0 }))
    }
    const counts: Record<string, number> = {}
    for (const v of allVideos) {
      const eng = v.engine?.toLowerCase() ?? 'runway'
      counts[eng] = (counts[eng] ?? 0) + 1
    }
    const total = allVideos.length
    return ENGINES.map((e) => ({
      ...e,
      count: counts[e.key] ?? 0,
      percent: total > 0 ? Math.round(((counts[e.key] ?? 0) / total) * 100) : 0,
    }))
  }, [allVideos])

  const chartMax = useMemo(() => Math.max(1, ...dailyCounts.map((d) => d.count)), [dailyCounts])

  const chartLabels = useMemo(() => {
    if (dailyCounts.length === 0) return []
    const step = Math.max(1, Math.floor(dailyCounts.length / 7))
    const labels: { index: number; label: string }[] = []
    for (let i = 0; i < dailyCounts.length; i += step) {
      const d = new Date(dailyCounts[i].date)
      labels.push({
        index: i,
        label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      })
    }
    return labels
  }, [dailyCounts])

  return {
    loading,
    stats,
    recentVideos,
    dailyCounts,
    allVideos,
    engineStats,
    chartMax,
    chartLabels,
  }
}
