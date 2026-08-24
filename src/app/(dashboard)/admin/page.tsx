'use client'

import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { RefreshButton } from '@/components/admin/RefreshButton'
import { MRRCard } from '@/components/admin/MRRCard'
import { RevenueStation } from '@/components/admin/RevenueStation'
import { UsersStation } from '@/components/admin/UsersStation'
import { CostsStation } from '@/components/admin/CostsStation'
import { ReferralStation } from '@/components/admin/ReferralStation'
import { ActivityFeed, type ActivityEvent } from '@/components/admin/ActivityFeed'

interface AdminStats {
  total_users: number
  paying_users: number
  total_videos: number
  active_users_7d: number
  total_revenue: number
  mrr: number
  total_api_costs_30d: number
  plan_distribution: Record<string, number>
}

interface ServiceCosts {
  services: Record<string, number>
}

interface ReferralStats {
  commissions_paid: number
  commissions_pending: number
  top_partners: { code: string; referrals: number; commissions: number }[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [serviceCosts, setServiceCosts] = useState<ServiceCosts | null>(null)
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, activityRes, costsRes, refRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/stats?type=activity').catch(() => null),
        fetch('/api/admin/stats?type=service_costs').catch(() => null),
        fetch('/api/admin/stats?type=referral_stats').catch(() => null),
      ])

      if (!statsRes.ok) throw new Error('Erreur chargement stats')

      const statsData = await statsRes.json()
      setStats(statsData)

      if (activityRes?.ok) {
        const activityData = await activityRes.json()
        setActivity(activityData.events ?? [])
      }
      if (costsRes?.ok) {
        const costsData = await costsRes.json()
        setServiceCosts({ services: costsData.services ?? {} })
      }
      if (refRes?.ok) {
        const refData = await refRes.json()
        setReferralStats({
          commissions_paid: refData.commissions_paid ?? 0,
          commissions_pending: refData.commissions_pending ?? 0,
          top_partners: refData.top_partners ?? [],
        })
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const conversionRate = stats
    ? stats.total_users > 0
      ? ((stats.paying_users / stats.total_users) * 100).toFixed(1)
      : '0.0'
    : '0.0'

  const margin = stats
    ? stats.mrr > 0
      ? (((stats.mrr - stats.total_api_costs_30d) / stats.mrr) * 100).toFixed(0)
      : '0'
    : '0'

  const marginNumber = parseFloat(margin)
  const marginAlert = marginNumber < 30

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <RefreshButton onClick={handleRefresh} refreshing={refreshing} />

      <MRRCard
        mrr={stats?.mrr ?? null}
        margin={margin}
        marginAlert={marginAlert}
        totalApiCosts={stats?.total_api_costs_30d ?? 0}
        loading={loading}
      />

      <RevenueStation
        totalRevenue={stats?.total_revenue ?? 0}
        mrr={stats?.mrr ?? 0}
        totalApiCosts={stats?.total_api_costs_30d ?? 0}
        margin={margin}
        marginAlert={marginAlert}
        loading={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UsersStation
          totalUsers={stats?.total_users ?? 0}
          payingUsers={stats?.paying_users ?? 0}
          activeUsers7d={stats?.active_users_7d ?? 0}
          conversionRate={conversionRate}
          totalVideos={stats?.total_videos ?? 0}
          planDistribution={stats?.plan_distribution ?? null}
          loading={loading}
        />

        <CostsStation
          serviceCosts={serviceCosts?.services ?? null}
          totalApiCosts={stats?.total_api_costs_30d ?? 0}
          margin={margin}
          marginNumber={marginNumber}
          marginAlert={marginAlert}
          loading={loading}
        />
      </div>

      <ReferralStation
        commissionsPaid={referralStats?.commissions_paid ?? 0}
        commissionsPending={referralStats?.commissions_pending ?? 0}
        topPartners={referralStats?.top_partners ?? []}
        loading={loading}
      />

      <ActivityFeed activity={activity} loading={loading} />
    </div>
  )
}
