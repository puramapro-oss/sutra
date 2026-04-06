'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Play, Pause, Loader2, Film, Eye, Heart, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface AutoConfig {
  id: string
  is_active: boolean
  schedules: Array<{ id: string; name: string; frequency: string; time: string }>
  publish_platforms: string[]
  auto_publish: boolean
  require_approval_before_publish: boolean
}

interface AutoVideo {
  id: string
  title: string | null
  status: string
  thumbnail_url: string | null
  video_final_url: string | null
  views: number
  likes: number
  engagement_rate: number | null
  published_at: string | null
  scheduled_for: string | null
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'premium' }> = {
  planning: { label: 'En planification', variant: 'info' },
  generating_video: { label: 'Generation video', variant: 'warning' },
  generating_audio: { label: 'Generation audio', variant: 'warning' },
  compositing: { label: 'Compositing', variant: 'warning' },
  ready: { label: 'Prete', variant: 'success' },
  pending_approval: { label: 'Validation requise', variant: 'warning' },
  publishing: { label: 'Publication', variant: 'premium' },
  published: { label: 'Publiee', variant: 'success' },
  failed: { label: 'Echec', variant: 'warning' },
}

export default function AutoPage() {
  const [config, setConfig] = useState<AutoConfig | null>(null)
  const [videos, setVideos] = useState<AutoVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toggling, setToggling] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, vidRes] = await Promise.all([
        fetch('/api/auto/config'),
        fetch('/api/auto/videos?limit=20'),
      ])
      const cfgJson = await cfgRes.json()
      const vidJson = await vidRes.json()
      if (cfgJson.config) setConfig(cfgJson.config)
      if (vidJson.videos) setVideos(vidJson.videos)
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleActive = useCallback(async () => {
    if (!config) return
    setToggling(true)
    try {
      const res = await fetch('/api/auto/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !config.is_active }),
      })
      const json = await res.json()
      if (json.config) {
        setConfig(json.config)
        toast.success(json.config.is_active ? 'Mode autonome active' : 'Mode autonome desactive')
      }
    } catch {
      toast.error('Erreur')
    } finally {
      setToggling(false)
    }
  }, [config])

  const generateNow = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/auto/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (json.video) {
        toast.success('Video generee !')
        fetchAll()
      } else {
        toast.error(json.error ?? 'Echec')
      }
    } catch {
      toast.error('Erreur generation')
    } finally {
      setGenerating(false)
    }
  }, [fetchAll])

  if (loading) {
    return (
      <div className="space-y-6" data-testid="auto-loading">
        <Skeleton width="100%" height={140} rounded="xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={120} rounded="xl" />
          ))}
        </div>
      </div>
    )
  }

  const stats = {
    total: videos.length,
    published: videos.filter((v) => v.status === 'published').length,
    totalViews: videos.reduce((s, v) => s + (v.views ?? 0), 0),
    avgEngagement:
      videos.filter((v) => v.engagement_rate).length > 0
        ? (
            videos.reduce((s, v) => s + (v.engagement_rate ?? 0), 0) /
            videos.filter((v) => v.engagement_rate).length
          ).toFixed(2)
        : '0.00',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Master toggle */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${
              config?.is_active
                ? 'bg-violet-500/20 border-violet-500/40'
                : 'bg-white/[0.04] border-white/[0.08]'
            }`}>
              <Sparkles className={`h-5 w-5 ${config?.is_active ? 'text-violet-300' : 'text-white/40'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white" data-testid="auto-status">
                {config?.is_active ? 'Actif' : 'Inactif'}
              </h2>
              <p className="text-sm text-white/40">
                {config?.is_active
                  ? 'SUTRA produit selon ton planning.'
                  : 'Active pour lancer la production automatique.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={generateNow}
              loading={generating}
              data-testid="auto-generate-now"
            >
              <Film className="h-4 w-4" />
              Generer maintenant
            </Button>
            <Button
              onClick={toggleActive}
              loading={toggling}
              data-testid="auto-toggle"
            >
              {config?.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {config?.is_active ? 'Mettre en pause' : 'Activer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Videos generees" value={stats.total} />
        <StatCard icon={Sparkles} label="Publiees" value={stats.published} />
        <StatCard icon={Eye} label="Vues totales" value={stats.totalViews.toLocaleString('fr-FR')} />
        <StatCard icon={TrendingUp} label="Engagement moy." value={`${stats.avgEngagement}%`} />
      </div>

      {/* Schedules summary */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Plannings actifs</h3>
            <Link href="/auto/schedules" className="text-xs text-violet-300 hover:text-violet-200">
              Gerer
            </Link>
          </div>
          {config?.schedules?.length ? (
            <div className="space-y-2">
              {config.schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <p className="text-sm text-white">{s.name}</p>
                    <p className="text-xs text-white/40">{s.frequency} - {s.time}</p>
                  </div>
                  <Badge variant="info" size="sm">{s.frequency}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40">Aucun planning configure.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent videos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Dernieres videos</h3>
          <Link href="/auto/videos" className="text-xs text-violet-300 hover:text-violet-200">
            Tout voir
          </Link>
        </div>

        {videos.length === 0 ? (
          <EmptyState
            icon={Film}
            title="Aucune video generee"
            description="Lance une generation manuelle ou attends ton premier planning."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.slice(0, 6).map((v) => {
              const meta = STATUS_LABELS[v.status] ?? { label: v.status, variant: 'info' as const }
              return (
                <Card key={v.id} hover data-testid={`auto-video-${v.id}`}>
                  <CardContent className="space-y-3">
                    <div className="aspect-video rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-white/[0.06] flex items-center justify-center overflow-hidden">
                      {v.video_final_url ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={v.video_final_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <Loader2 className="h-6 w-6 text-violet-300 animate-spin" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white line-clamp-2">{v.title ?? 'Sans titre'}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant={meta.variant} size="sm">{meta.label}</Badge>
                        {v.engagement_rate != null && (
                          <span className="text-xs text-white/40 flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {v.engagement_rate}%
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-white/40">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}
