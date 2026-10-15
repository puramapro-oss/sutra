'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Film, Eye, Heart, TrendingUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAutoScheduler } from '@/hooks/useAutoScheduler'
import AutoSchedulerControl from '@/components/auto/AutoSchedulerControl'
import { requestClientJson } from '@/lib/production-intent-client'

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
  const scheduler = useAutoScheduler()
  const { config } = scheduler
  const [videos, setVideos] = useState<AutoVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [videoError, setVideoError] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const result = await requestClientJson('/api/auto/videos?limit=20')
      if (!result.ok || !Array.isArray(result.body.videos)) throw new Error('Vidéos indisponibles')
      setVideos(result.body.videos as AutoVideo[])
      setVideoError(false)
    } catch {
      setVideoError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

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
        <AutoSchedulerControl scheduler={scheduler} />
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
      <AutoSchedulerControl scheduler={scheduler} />
      <Button variant="secondary" onClick={generateNow} loading={generating} data-testid="auto-generate-now">
        <Film className="h-4 w-4" /> Generer maintenant
      </Button>
      {videoError && <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-200">
        Liste des vidéos indisponible. Les compteurs ne sont pas disponibles.
        <Button variant="secondary" onClick={fetchAll} className="mt-3">Réessayer la liste</Button>
      </div>}

      {/* Stats */}
      {!videoError && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Videos generees" value={stats.total} />
        <StatCard icon={Sparkles} label="Publiees" value={stats.published} />
        <StatCard icon={Eye} label="Vues totales" value={stats.totalViews.toLocaleString('fr-FR')} />
        <StatCard icon={TrendingUp} label="Engagement moy." value={`${stats.avgEngagement}%`} />
      </div>}

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
            <p className="text-xs text-white/70">{config ? 'Aucun planning configure.' : 'Plannings non disponibles.'}</p>
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

        {videoError ? <p className="text-sm text-white/70">Réessaie le chargement de la liste ci-dessus.</p> : videos.length === 0 ? (
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

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
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
