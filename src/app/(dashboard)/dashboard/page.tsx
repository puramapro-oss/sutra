'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Video,
  Film,
  CreditCard,
  Zap,
  Plus,
  FolderOpen,
  TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import { getGreeting, formatRelativeDate } from '@/lib/utils'
import { PLAN_LIMITS } from '@/lib/constants'
import { KPICard } from '@/components/dashboard/KPICard'
import { VideoCard } from '@/components/dashboard/VideoCard'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReferralBlock } from '@/components/home/ReferralBlock'
import { AmbassadorBlock } from '@/components/home/AmbassadorBlock'
import { CrossPromoBlock } from '@/components/home/CrossPromoBlock'
import { DashboardSkeleton } from './DashboardSkeleton'
import type { Video as VideoType, Plan } from '@/types'

const supabase = createClient()

interface DashboardData {
  userId: string
  videosThisMonth: number
  videosTotal: number
  recentVideos: VideoType[]
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, loading: authLoading, error: authError, refetch } = useAuth()
  const [loadedData, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const fetchDashboard = useCallback(async (userId: string) => {
    setLoading(true)
    setLoadError(false)
    try {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [monthResult, totalResult, recentResult] = await Promise.all([
        supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', firstOfMonth),
        supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('videos')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (monthResult.error || totalResult.error || recentResult.error) throw new Error('DASHBOARD_READ_FAILED')

      setData({
        userId,
        videosThisMonth: monthResult.count ?? 0,
        videosTotal: totalResult.count ?? 0,
        recentVideos: (recentResult.data as VideoType[]) ?? [],
      })
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (profile?.id) {
      const id = profile.id
      queueMicrotask(() => { if (active) void fetchDashboard(id) })
    }
    return () => { active = false }
  }, [profile?.id, authLoading, fetchDashboard])

  const data = loadedData?.userId === profile?.id ? loadedData : null

  const plan = (profile?.plan ?? 'free') as Plan
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const creditsRemaining = profile?.credits ?? 0

  const planLabels: Record<string, string> = {
    free: 'Gratuit',
    starter: 'Starter',
    creator: 'Creator',
    empire: 'Empire',
    enterprise: 'Enterprise',
    admin: 'Admin',
  }
  const planLabel = planLabels[plan] ?? 'Gratuit'

  if (authLoading) {
    return <DashboardSkeleton />
  }

  if (authError || !profile || loadError) {
    return <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-500/25 bg-amber-500/10 p-6 space-y-4">
      <h1 className="text-xl font-semibold">Le tableau de bord n’a pas pu être chargé</h1>
      <p className="text-sm text-white/70">Tes données n’ont pas pu être vérifiées. Réessaie lorsque la connexion est rétablie.</p>
      <Button onClick={() => profile && !authError ? fetchDashboard(profile.id) : refetch()}>Réessayer</Button>
    </div>
  }

  return (
    <LoadingTimeout
      loading={loading || !data}
      onRetry={() => profile?.id && fetchDashboard(profile.id)}
      skeleton={<DashboardSkeleton />}
    >
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      {/* Greeting */}
      <div>
        <h1
          data-testid="dashboard-greeting"
          className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]"
        >
          {getGreeting()}, {profile?.name?.split(' ')[0] ?? 'Createur'} !
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Voici un apercu de ton activite video.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Video}
          label="Videos ce mois"
          value={data?.videosThisMonth ?? 0}
          trend={
            data && data.videosThisMonth > 0
              ? { direction: 'up', value: `${data.videosThisMonth}` }
              : undefined
          }
          data-testid="kpi-videos-month"
        />
        <KPICard
          icon={Film}
          label="Videos totales"
          value={data?.videosTotal ?? 0}
          data-testid="kpi-videos-total"
        />
        <KPICard
          icon={CreditCard}
          label="Plan actuel"
          value={planLabel}
          data-testid="kpi-plan"
        />
        <KPICard
          icon={Zap}
          label="Credits restants"
          value={creditsRemaining}
          trend={
            planLimits.videos !== 9999 && planLimits.videos !== Infinity
              ? {
                  direction:
                    creditsRemaining > planLimits.videos * 0.5
                      ? 'up'
                      : creditsRemaining > planLimits.videos * 0.2
                        ? 'neutral'
                        : 'down',
                  value: `${planLimits.videos - creditsRemaining} utilises`,
                }
              : undefined
          }
          data-testid="kpi-credits"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          data-testid="quick-action-create"
          variant="primary"
          size="lg"
          onClick={() => router.push('/create')}
        >
          <Plus className="h-5 w-5" />
          Creer une video
        </Button>
        <Button
          data-testid="quick-action-library"
          variant="secondary"
          size="lg"
          onClick={() => router.push('/library')}
        >
          <FolderOpen className="h-5 w-5" />
          Voir mes videos
        </Button>
      </div>

      {/* Plan limit warning */}
      {plan !== 'admin' && data && data.videosThisMonth >= planLimits.videos * 0.8 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3"
        >
          <TrendingUp className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              Tu approches de ta limite mensuelle
            </p>
            <p className="text-xs text-amber-400/60 mt-0.5">
              {data.videosThisMonth}/{planLimits.videos} videos utilisees ce mois.{' '}
              <button
                onClick={() => router.push('/pricing')}
                className="underline hover:text-amber-300 transition-colors"
              >
                Passer au plan superieur
              </button>
            </p>
          </div>
        </motion.div>
      )}

      {/* Recent Videos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
            Videos recentes
          </h2>
          {data && data.recentVideos.length > 0 && (
            <button
              onClick={() => router.push('/library')}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              Tout voir
            </button>
          )}
        </div>

        {data && data.recentVideos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {data.recentVideos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <VideoCard video={video} />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Film}
            title="Aucune video pour le moment"
            description="Cree ta premiere video en quelques clics grace a l'IA de SUTRA."
            action={{
              label: 'Creer ma premiere video',
              onClick: () => router.push('/create'),
            }}
            data-testid="empty-videos"
          />
        )}
      </div>
      <section aria-label="Parrainage et écosystème" className="grid grid-cols-1 gap-4" data-testid="v7-home-blocks">
        <ReferralBlock />
        <AmbassadorBlock />
        <CrossPromoBlock />
      </section>
    </motion.div>
    </LoadingTimeout>
  )
}
