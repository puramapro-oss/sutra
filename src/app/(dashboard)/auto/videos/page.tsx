'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, Star, Send, Film, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

interface AutoVideo {
  id: string
  title: string | null
  description: string | null
  status: string
  video_final_url: string | null
  thumbnail_url: string | null
  views: number
  likes: number
  engagement_rate: number | null
  user_rating: number | null
  published_at: string | null
  created_at: string
  hashtags: string[]
  ai_reasoning: string | null
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'premium' }> = {
  planning: { label: 'En planification', variant: 'info' },
  generating_video: { label: 'Generation', variant: 'warning' },
  generating_audio: { label: 'Audio', variant: 'warning' },
  compositing: { label: 'Compositing', variant: 'warning' },
  ready: { label: 'Prete', variant: 'success' },
  pending_approval: { label: 'Validation', variant: 'warning' },
  publishing: { label: 'Publication', variant: 'premium' },
  published: { label: 'Publiee', variant: 'success' },
  failed: { label: 'Echec', variant: 'warning' },
}

export default function VideosPage() {
  const [videos, setVideos] = useState<AutoVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchVideos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto/videos?limit=100')
      const json = await res.json()
      setVideos(json.videos ?? [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  const handlePublish = useCallback(async (id: string) => {
    setActionId(id)
    try {
      const res = await fetch('/api/auto/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: id }),
      })
      const json = await res.json()
      if (json.success) toast.success('Video publiee')
      else toast.error(json.error ?? 'Echec publication')
      fetchVideos()
    } catch {
      toast.error('Erreur')
    } finally {
      setActionId(null)
    }
  }, [fetchVideos])

  const handleDelete = useCallback(async (id: string) => {
    setActionId(id)
    try {
      await fetch(`/api/auto/videos/${id}`, { method: 'DELETE' })
      setVideos((prev) => prev.filter((v) => v.id !== id))
      toast.success('Video supprimee')
    } catch {
      toast.error('Erreur')
    } finally {
      setActionId(null)
    }
  }, [])

  const handleRate = useCallback(async (id: string, rating: number) => {
    try {
      await fetch(`/api/auto/videos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_rating: rating }),
      })
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, user_rating: rating } : v)))
      toast.success('Merci !')
    } catch {
      toast.error('Erreur')
    }
  }, [])

  if (loading) return <Skeleton width="100%" height={400} rounded="xl" />

  if (!videos.length) {
    return (
      <EmptyState
        icon={Film}
        title="Aucune video auto"
        description="Active le mode autonome ou genere une video manuellement."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((v) => {
        const meta = STATUS_LABELS[v.status] ?? { label: v.status, variant: 'info' as const }
        return (
          <Card key={v.id} hover data-testid={`auto-video-${v.id}`}>
            <CardContent className="space-y-3">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-white/[0.06] flex items-center justify-center overflow-hidden">
                {v.video_final_url ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={v.video_final_url} controls className="w-full h-full object-cover" />
                ) : (
                  <Loader2 className="h-6 w-6 text-violet-300 animate-spin" />
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-white line-clamp-2">{v.title ?? 'Sans titre'}</p>
                <Badge variant={meta.variant} size="sm" className="mt-1">{meta.label}</Badge>
              </div>

              {v.status === 'published' && (
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span>{v.views ?? 0} vues</span>
                  <span>{v.likes ?? 0} likes</span>
                  {v.engagement_rate != null && <span>{v.engagement_rate}%</span>}
                </div>
              )}

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleRate(v.id, n)}
                    data-testid={`rate-${v.id}-${n}`}
                    className="p-1"
                  >
                    <Star
                      className={cn(
                        'h-4 w-4 transition-colors',
                        v.user_rating && v.user_rating >= n
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-white/20'
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {(v.status === 'ready' || v.status === 'pending_approval') && v.video_final_url && (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(v.id)}
                    loading={actionId === v.id}
                    data-testid={`publish-${v.id}`}
                  >
                    <Send className="h-3.5 w-3.5" /> Publier
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(v.id)}
                  loading={actionId === v.id}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  data-testid={`delete-${v.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
