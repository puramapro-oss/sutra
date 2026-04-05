'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Film,
  Zap,
  Clock,
  DollarSign,
  Search,
  RotateCcw,
  Play,
  Calendar,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface VideoRecord {
  id: string
  title: string | null
  format: string | null
  quality: string | null
  duration: number | null
  engine: string | null
  created_at: string
  script_data: { title?: string; topic?: string } | null
  status: string | null
}

interface DailyCount {
  date: string
  count: number
}

interface Stats {
  videosThisMonth: number
  totalDuration: number
  totalCost: number
  creditsUsed: number
}

const ENGINES = [
  { key: 'runway', label: 'Runway', color: 'from-violet-500 to-purple-500' },
  { key: 'pika', label: 'Pika', color: 'from-cyan-500 to-blue-500' },
  { key: 'stable', label: 'Stable Video', color: 'from-emerald-500 to-teal-500' },
]

const COST_PER_VIDEO = 0.12

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default function AnalyticsPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()

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
  const [promptSearch, setPromptSearch] = useState('')

  const fetchAnalytics = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const supabase = createClient()
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Fetch all videos for this user
      const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, format, quality, duration, engine, created_at, script_data, status')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(500)

      if (error || !videos) {
        setLoading(false)
        return
      }

      const typedVideos = videos as unknown as VideoRecord[]
      setAllVideos(typedVideos)
      setRecentVideos(typedVideos.slice(0, 5))

      // Stats: this month
      const thisMonthVideos = typedVideos.filter(
        (v) => v.created_at >= startOfMonth
      )
      const totalDuration = typedVideos.reduce(
        (sum, v) => sum + (v.duration ?? 0),
        0
      )

      setStats({
        videosThisMonth: thisMonthVideos.length,
        totalDuration,
        totalCost: typedVideos.length * COST_PER_VIDEO,
        creditsUsed: profile?.credits ?? 0,
      })

      // Daily counts (last 30 days)
      const days: DailyCount[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const count = typedVideos.filter(
          (v) => v.created_at.split('T')[0] === dateStr
        ).length
        days.push({ date: dateStr, count })
      }
      setDailyCounts(days)
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [profile?.id, profile?.credits])

  useEffect(() => {
    if (!authLoading && profile?.id) {
      fetchAnalytics()
    }
  }, [authLoading, profile?.id, fetchAnalytics])

  // Engine usage stats
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

  // Chart max
  const chartMax = useMemo(
    () => Math.max(1, ...dailyCounts.map((d) => d.count)),
    [dailyCounts]
  )

  // Chart x labels (every ~4 days)
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

  // Prompts with search
  const filteredPrompts = useMemo(() => {
    const prompts = allVideos
      .map((v) => ({
        id: v.id,
        topic:
          v.script_data?.topic ??
          v.script_data?.title ??
          v.title ??
          'Sans titre',
        date: v.created_at,
      }))
      .slice(0, 20)

    if (!promptSearch.trim()) return prompts
    const q = promptSearch.toLowerCase()
    return prompts.filter((p) => p.topic.toLowerCase().includes(q))
  }, [allVideos, promptSearch])

  const handleReuse = (topic: string) => {
    router.push(`/create?topic=${encodeURIComponent(topic)}`)
  }

  const kpis = [
    {
      label: 'Videos ce mois',
      value: stats.videosThisMonth,
      icon: Film,
      suffix: '',
      trend: stats.videosThisMonth > 0 ? 'up' as const : 'neutral' as const,
      testId: 'kpi-videos-month',
    },
    {
      label: 'Credits utilises',
      value: stats.creditsUsed,
      icon: Zap,
      suffix: '',
      trend: 'neutral' as const,
      testId: 'kpi-credits',
    },
    {
      label: 'Duree totale',
      value: stats.totalDuration,
      icon: Clock,
      suffix: 's',
      format: formatDuration,
      testId: 'kpi-duration',
    },
    {
      label: 'Cout estime',
      value: stats.totalCost,
      icon: DollarSign,
      suffix: ' EUR',
      decimals: 2,
      testId: 'kpi-cost',
    },
  ]

  if (authLoading || loading) {
    return (
      <div className="flex-1 p-6 lg:p-8 space-y-8">
        <div>
          <Skeleton height={32} width={160} className="mb-2" />
          <Skeleton height={18} width={280} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={120} rounded="xl" />
          ))}
        </div>
        <Skeleton height={300} rounded="xl" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 lg:p-8 space-y-8 max-w-7xl" data-testid="analytics-page">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-white tracking-tight">
          Analytics
        </h1>
        <p className="text-white/50 mt-1 text-sm">
          Suivez vos performances de creation video en temps reel
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <motion.div
              key={kpi.testId}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
            >
              <Card className="bg-white/[0.02] border-white/[0.06]" data-testid={kpi.testId}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Icon className="w-4.5 h-4.5 text-violet-400" />
                    </div>
                    {kpi.trend === 'up' && (
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    )}
                    {kpi.trend === 'neutral' && (
                      <div className="w-4 h-4" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white tabular-nums">
                    {kpi.format ? (
                      kpi.format(kpi.value)
                    ) : (
                      <AnimatedCounter
                        value={kpi.value}
                        suffix={kpi.suffix}
                        decimals={kpi.decimals ?? 0}
                        data-testid={`${kpi.testId}-value`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-1">{kpi.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Engine preference */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Moteur prefere</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {engineStats.map((engine) => (
            <Card
              key={engine.key}
              className="bg-white/[0.02] border-white/[0.06]"
              data-testid={`engine-${engine.key}`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">{engine.label}</span>
                  <Badge variant={engine.percent > 0 ? 'premium' : 'default'} size="sm">
                    {engine.percent}%
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full bg-gradient-to-r', engine.color)}
                    initial={{ width: 0 }}
                    animate={{ width: `${engine.percent}%` }}
                    transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-white/40 mt-2">
                  {engine.count} video{engine.count !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Daily chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Videos par jour</h2>
        <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="chart-daily">
          <CardContent className="p-5">
            {dailyCounts.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">Aucune donnee disponible</p>
            ) : (
              <div className="relative">
                {/* Bars */}
                <div className="flex items-end gap-[2px] h-40">
                  {dailyCounts.map((day, i) => {
                    const heightPercent = chartMax > 0 ? (day.count / chartMax) * 100 : 0
                    return (
                      <div
                        key={day.date}
                        className="flex-1 group relative flex flex-col justify-end"
                      >
                        <motion.div
                          className={cn(
                            'w-full rounded-t-sm transition-colors cursor-default',
                            day.count > 0
                              ? 'bg-violet-500/60 hover:bg-violet-400/80'
                              : 'bg-white/[0.04]'
                          )}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPercent, 2)}%` }}
                          transition={{ delay: 0.5 + i * 0.015, duration: 0.4 }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                          <div className="bg-[#1a1a2e] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-xl">
                            <span className="text-white/60">
                              {new Date(day.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <span className="ml-2 font-medium">
                              {day.count} video{day.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* X-axis labels */}
                <div className="relative h-6 mt-2">
                  {chartLabels.map((lbl) => {
                    const leftPercent =
                      dailyCounts.length > 1
                        ? (lbl.index / (dailyCounts.length - 1)) * 100
                        : 50
                    return (
                      <span
                        key={lbl.index}
                        className="absolute text-[10px] text-white/30 -translate-x-1/2"
                        style={{ left: `${leftPercent}%` }}
                      >
                        {lbl.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top videos */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Top videos</h2>
        <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="top-videos">
          <CardContent className="p-0 divide-y divide-white/[0.04]">
            {recentVideos.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">Aucune video creee</p>
            ) : (
              recentVideos.map((video, i) => (
                <div
                  key={video.id}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                  data-testid={`top-video-${i}`}
                >
                  {/* Thumbnail placeholder */}
                  <div className="w-12 h-8 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                    <Play className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {video.title ?? video.script_data?.title ?? 'Sans titre'}
                    </p>
                    <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {formatDate(video.created_at)}
                      {video.duration != null && (
                        <>
                          <span className="text-white/20 mx-1">|</span>
                          <Clock className="w-3 h-3" />
                          {formatDuration(video.duration)}
                        </>
                      )}
                    </p>
                  </div>
                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {video.format && (
                      <Badge variant="default" size="sm">
                        {video.format}
                      </Badge>
                    )}
                    {video.quality && (
                      <Badge variant="premium" size="sm">
                        {video.quality}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Prompt history */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Historique de prompts</h2>
        </div>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher un prompt..."
            value={promptSearch}
            onChange={(e) => setPromptSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/30 transition-all"
            data-testid="prompt-search"
          />
        </div>
        <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="prompt-history">
          <CardContent className="p-0 divide-y divide-white/[0.04]">
            {filteredPrompts.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">
                {promptSearch ? 'Aucun prompt correspondant' : 'Aucun prompt enregistre'}
              </p>
            ) : (
              filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{prompt.topic}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {formatRelativeDate(prompt.date)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReuse(prompt.topic)}
                    data-testid={`reuse-prompt-${prompt.id}`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reutiliser</span>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
