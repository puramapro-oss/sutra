'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Video,
  Activity,
  Cpu,
  DollarSign,
  UserPlus,
  AlertTriangle,
  RefreshCw,
  Eye,
  Zap,
} from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatPrice, formatRelativeDate } from '@/lib/utils'

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

interface ActivityEvent {
  id: string
  type: string
  description: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-white/10 text-white/60',
  starter: 'bg-blue-500/15 text-blue-400',
  creator: 'bg-violet-500/15 text-violet-400',
  empire: 'bg-amber-500/15 text-amber-400',
}

const ACTIVITY_ICONS: Record<string, { icon: typeof Users; color: string }> = {
  signup: { icon: UserPlus, color: 'text-emerald-400' },
  subscription: { icon: CreditCard, color: 'text-amber-400' },
  video: { icon: Video, color: 'text-violet-400' },
  publish: { icon: Eye, color: 'text-blue-400' },
  cancel: { icon: AlertTriangle, color: 'text-red-400' },
}

const SERVICE_COSTS = [
  { name: 'Claude AI', key: 'claude', color: 'bg-violet-500' },
  { name: 'ElevenLabs', key: 'elevenlabs', color: 'bg-blue-500' },
  { name: 'RunPod', key: 'runpod', color: 'bg-emerald-500' },
  { name: 'Suno', key: 'suno', color: 'bg-pink-500' },
  { name: 'Shotstack', key: 'shotstack', color: 'bg-amber-500' },
]

function GoldCard({
  children,
  className,
  glow = false,
  ...props
}: {
  children: React.ReactNode
  className?: string
  glow?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl backdrop-blur-xl border',
        glow
          ? 'bg-amber-500/[0.04] border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.08)]'
          : 'bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {glow && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.06),_transparent_70%)] pointer-events-none" />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function StationHeader({ title, icon: Icon }: { title: string; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-amber-400" />
      <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function StatSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton height={14} width="40%" rounded="md" />
      <Skeleton height={32} width="60%" rounded="md" />
      <Skeleton height={12} width="30%" rounded="md" />
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/stats?type=activity').catch(() => null),
      ])

      if (!statsRes.ok) throw new Error('Erreur chargement stats')

      const statsData = await statsRes.json()
      setStats(statsData)

      if (activityRes?.ok) {
        const activityData = await activityRes.json()
        setActivity(activityData.events ?? [])
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
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-amber-400 hover:bg-amber-500/[0.06] transition-colors disabled:opacity-50"
          data-testid="admin-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Rafraichir
        </button>
      </div>

      {/* MRR CENTRAL */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <GoldCard glow className="p-8 text-center" data-testid="admin-mrr-card">
          <p className="text-sm font-medium text-amber-400/60 uppercase tracking-widest mb-2">
            Monthly Recurring Revenue
          </p>
          {loading ? (
            <Skeleton height={56} width={240} rounded="lg" className="mx-auto mb-3" />
          ) : (
            <div className="mb-3">
              <AnimatedCounter
                value={stats?.mrr ?? 0}
                prefix=""
                suffix=" EUR"
                decimals={2}
                className="text-5xl md:text-6xl font-bold text-amber-400"
                data-testid="admin-mrr-value"
              />
            </div>
          )}
          <div className="flex items-center justify-center gap-6 text-sm text-white/40">
            <span>
              Marge : <span className={cn('font-semibold', marginAlert ? 'text-red-400' : 'text-emerald-400')}>
                {loading ? '...' : `${margin}%`}
              </span>
              {marginAlert && !loading && (
                <AlertTriangle className="inline h-3.5 w-3.5 text-red-400 ml-1" />
              )}
            </span>
            <span className="w-px h-4 bg-white/10" />
            <span>
              Couts API : <span className="font-semibold text-white/60">
                {loading ? '...' : formatPrice(stats?.total_api_costs_30d ?? 0)}
              </span>
            </span>
          </div>
        </GoldCard>
      </motion.div>

      {/* Station REVENUS */}
      <GoldCard className="p-5" data-testid="admin-revenue-station">
        <StationHeader title="Station Revenus" icon={DollarSign} />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Revenu total</p>
              <p className="text-2xl font-bold text-white">
                {formatPrice(stats?.total_revenue ?? 0)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                <span>Tout temps</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">MRR</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatPrice(stats?.mrr ?? 0)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-amber-400/60">
                <Zap className="h-3 w-3" />
                <span>30 derniers jours</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Profit net (30j)</p>
              <p className={cn('text-2xl font-bold', marginAlert ? 'text-red-400' : 'text-emerald-400')}>
                {formatPrice((stats?.mrr ?? 0) - (stats?.total_api_costs_30d ?? 0))}
              </p>
              <div className={cn('flex items-center gap-1 mt-1 text-xs', marginAlert ? 'text-red-400/60' : 'text-emerald-400/60')}>
                {marginAlert ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                <span>Marge {margin}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Revenue chart placeholder */}
        <div className="mt-4 h-48 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center" data-testid="admin-revenue-chart">
          <div className="text-center">
            <Activity className="h-8 w-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/20">Graphique revenus 90j</p>
          </div>
        </div>
      </GoldCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Station UTILISATEURS */}
        <GoldCard className="p-5" data-testid="admin-users-station">
          <StationHeader title="Station Utilisateurs" icon={Users} />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={44} width="100%" rounded="lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Total utilisateurs</span>
                <span className="text-lg font-bold text-white" data-testid="admin-total-users">
                  {stats?.total_users ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Utilisateurs payants</span>
                <span className="text-lg font-bold text-amber-400" data-testid="admin-paying-users">
                  {stats?.paying_users ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Actifs 7j</span>
                <span className="text-lg font-bold text-white">{stats?.active_users_7d ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Taux de conversion</span>
                <span className={cn('text-lg font-bold', parseFloat(conversionRate) > 5 ? 'text-emerald-400' : 'text-amber-400')}>
                  {conversionRate}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Videos creees</span>
                <span className="text-lg font-bold text-violet-400">{stats?.total_videos ?? 0}</span>
              </div>

              {/* Plan distribution */}
              {stats?.plan_distribution && (
                <div className="pt-2">
                  <p className="text-xs text-white/30 mb-2">Distribution des plans</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(stats.plan_distribution).map(([plan, count]) => (
                      <span
                        key={plan}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border',
                          PLAN_COLORS[plan] ?? 'bg-white/10 text-white/60',
                          'border-current/20'
                        )}
                      >
                        {plan}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </GoldCard>

        {/* Station COUTS */}
        <GoldCard className="p-5" data-testid="admin-costs-station">
          <StationHeader title="Station Couts API" icon={Cpu} />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={44} width="100%" rounded="lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {SERVICE_COSTS.map((service) => {
                const estimatedCost = (stats?.total_api_costs_30d ?? 0) / SERVICE_COSTS.length
                return (
                  <div
                    key={service.key}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('h-2.5 w-2.5 rounded-full', service.color)} />
                      <span className="text-sm text-white/70">{service.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-white/80">
                      {formatPrice(estimatedCost)}
                    </span>
                  </div>
                )
              })}

              <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-400">Total couts 30j</span>
                  <span className="text-lg font-bold text-amber-400">
                    {formatPrice(stats?.total_api_costs_30d ?? 0)}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      marginAlert ? 'bg-red-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${Math.min(100, 100 - marginNumber)}%` }}
                  />
                </div>
                <p className="text-xs text-white/30 mt-1">
                  {marginAlert
                    ? 'Marge inferieure a 30% — attention'
                    : `Marge saine : ${margin}%`}
                </p>
              </div>
            </div>
          )}
        </GoldCard>
      </div>

      {/* Station PARRAINAGE */}
      <GoldCard className="p-5" data-testid="admin-referral-station">
        <StationHeader title="Station Parrainage" icon={Users} />
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={60} width="100%" rounded="lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Commissions payees</p>
              <p className="text-xl font-bold text-emerald-400">{formatPrice(0)}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-white/40 mb-1">Commissions en attente</p>
              <p className="text-xl font-bold text-amber-400">{formatPrice(0)}</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 col-span-1 sm:col-span-2">
              <p className="text-xs text-white/40 mb-2">Top 5 parrains</p>
              <p className="text-sm text-white/20">Aucun parrain pour le moment</p>
            </div>
          </div>
        )}
      </GoldCard>

      {/* FEED ACTIVITE */}
      <GoldCard className="p-5" data-testid="admin-activity-feed">
        <StationHeader title="Feed Activite" icon={Activity} />
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={48} width="100%" rounded="lg" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30">Aucune activite recente</p>
            <p className="text-xs text-white/15 mt-1">Les evenements apparaitront ici en temps reel</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activity.map((event, idx) => {
              const config = ACTIVITY_ICONS[event.type] ?? { icon: Activity, color: 'text-white/40' }
              const Icon = config.icon
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                >
                  <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
                  <p className="text-sm text-white/70 flex-1 truncate">{event.description}</p>
                  <span className="text-xs text-white/25 shrink-0">
                    {formatRelativeDate(event.created_at)}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </GoldCard>
    </div>
  )
}
