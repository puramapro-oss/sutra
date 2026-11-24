'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAnalytics } from '@/hooks/useAnalytics'
import KpiCards from '@/components/analytics/KpiCards'
import EngineStats from '@/components/analytics/EngineStats'
import DailyChart from '@/components/analytics/DailyChart'
import TopVideos from '@/components/analytics/TopVideos'
import PromptHistory from '@/components/analytics/PromptHistory'

export default function AnalyticsPage() {
  const auth = useAuth()
  return <AnalyticsPageContent key={auth.profile?.id ?? 'signed-out'} auth={auth} />
}

function AnalyticsPageContent({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { profile, loading: authLoading } = auth
  const router = useRouter()

  const { loading, error, refresh, stats, recentVideos, dailyCounts, allVideos, engineStats, chartMax, chartLabels } =
    useAnalytics({
      userId: profile?.id,
      credits: profile?.credits,
    })

  const handleReuse = useCallback(
    (topic: string) => {
      router.push(`/create?topic=${encodeURIComponent(topic)}`)
    },
    [router]
  )

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

  if (error) return (
    <div role="alert" className="p-6 space-y-4" data-testid="analytics-load-error">
      <h1 className="text-xl font-semibold text-white">Statistiques indisponibles</h1>
      <p className="text-white/70">{error}</p>
      <button type="button" onClick={() => void refresh()} className="rounded-xl bg-violet-600 px-4 py-2 text-white">
        Réessayer
      </button>
    </div>
  )

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

      <KpiCards stats={stats} />
      <EngineStats engineStats={engineStats} />
      <DailyChart dailyCounts={dailyCounts} chartMax={chartMax} chartLabels={chartLabels} />
      <TopVideos videos={recentVideos} />
      <PromptHistory videos={allVideos} onReuse={handleReuse} />
    </div>
  )
}
