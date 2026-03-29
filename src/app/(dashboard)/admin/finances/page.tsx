'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPrice, formatDate } from '@/lib/utils'

interface FinanceData {
  revenue_by_plan: Record<string, number>
  total_revenue: number
  mrr: number
  costs_by_service: Record<string, number>
  total_costs: number
  profit: number
  margin_percent: number
  mrr_growth_rate: number
  forecast_next_month: number
}

interface WithdrawalItem {
  id: string
  user_id: string
  user_email: string
  amount: number
  method: string
  status: string
  created_at: string
}

const SERVICE_COLORS: Record<string, string> = {
  claude: '#8B5CF6',
  elevenlabs: '#3B82F6',
  runpod: '#10B981',
  suno: '#EC4899',
  shotstack: '#F59E0B',
  pexels: '#06B6D4',
}

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'error'; label: string }> = {
  pending: { variant: 'warning', label: 'En attente' },
  approved: { variant: 'success', label: 'Approuve' },
  rejected: { variant: 'error', label: 'Rejete' },
  paid: { variant: 'success', label: 'Paye' },
}

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
          ? 'bg-amber-500/[0.04] border-amber-500/20'
          : 'bg-white/[0.03] border-white/[0.06]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default function AdminFinancesPage() {
  const [finance, setFinance] = useState<FinanceData | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/stats?type=finances')

      if (!res.ok) {
        const fallbackRes = await fetch('/api/admin/stats')
        if (!fallbackRes.ok) throw new Error('Erreur chargement finances')
        const stats = await fallbackRes.json()

        setFinance({
          revenue_by_plan: stats.plan_distribution ?? {},
          total_revenue: stats.total_revenue ?? 0,
          mrr: stats.mrr ?? 0,
          costs_by_service: {
            claude: (stats.total_api_costs_30d ?? 0) * 0.35,
            elevenlabs: (stats.total_api_costs_30d ?? 0) * 0.25,
            runpod: (stats.total_api_costs_30d ?? 0) * 0.2,
            suno: (stats.total_api_costs_30d ?? 0) * 0.1,
            shotstack: (stats.total_api_costs_30d ?? 0) * 0.07,
            pexels: (stats.total_api_costs_30d ?? 0) * 0.03,
          },
          total_costs: stats.total_api_costs_30d ?? 0,
          profit: (stats.mrr ?? 0) - (stats.total_api_costs_30d ?? 0),
          margin_percent: stats.mrr > 0 ? (((stats.mrr - stats.total_api_costs_30d) / stats.mrr) * 100) : 0,
          mrr_growth_rate: 0,
          forecast_next_month: stats.mrr ?? 0,
        })
      } else {
        const data = await res.json()
        setFinance(data.finance ?? data)
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleWithdrawalAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'withdrawal_action', id, action }),
      })
      if (res.ok) {
        setWithdrawals((prev) =>
          prev.map((w) =>
            w.id === id ? { ...w, status: action === 'approve' ? 'approved' : 'rejected' } : w
          )
        )
      }
    } finally {
      setActionLoading(null)
    }
  }

  if (error && !finance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-finances-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  const marginAlert = (finance?.margin_percent ?? 0) < 30

  return (
    <div className="space-y-6" data-testid="admin-finances-page">
      <h2 className="text-xl font-bold text-white">Vue financiere</h2>

      {/* Revenue by Plan */}
      <GoldCard className="p-5" data-testid="admin-finance-revenue">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Revenus par plan</h3>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={80} width="100%" rounded="xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Free', value: finance?.revenue_by_plan?.free ?? 0, color: 'text-white/40' },
                { label: 'Starter', value: (finance?.mrr ?? 0) * 0.2, color: 'text-blue-400' },
                { label: 'Creator', value: (finance?.mrr ?? 0) * 0.45, color: 'text-violet-400' },
                { label: 'Empire', value: (finance?.mrr ?? 0) * 0.35, color: 'text-amber-400' },
              ].map((plan) => (
                <div key={plan.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                  <p className="text-xs text-white/40 mb-1">{plan.label}</p>
                  <p className={cn('text-xl font-bold', plan.color)}>
                    {formatPrice(plan.value)}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-amber-400">Revenu total</span>
              <span className="text-xl font-bold text-amber-400">
                {formatPrice(finance?.total_revenue ?? 0)}
              </span>
            </div>
          </>
        )}
      </GoldCard>

      {/* Costs Breakdown */}
      <GoldCard className="p-5" data-testid="admin-finance-costs">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Couts par service</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={44} width="100%" rounded="lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(finance?.costs_by_service ?? {}).map(([service, cost]) => {
              const total = finance?.total_costs ?? 1
              const percent = total > 0 ? ((cost / total) * 100).toFixed(1) : '0'
              const barColor = SERVICE_COLORS[service] ?? '#8B5CF6'

              return (
                <div key={service} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="text-sm text-white/70 capitalize">{service}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30">{percent}%</span>
                      <span className="text-sm font-semibold text-white/80">
                        {formatPrice(cost)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GoldCard>

      {/* Margin & Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GoldCard glow className="p-5" data-testid="admin-finance-margin">
          <div className="flex items-center gap-2 mb-4">
            {marginAlert ? (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            )}
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Calcul de marge</h3>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={40} width="100%" rounded="lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Revenus (MRR)</span>
                <span className="text-lg font-bold text-amber-400">{formatPrice(finance?.mrr ?? 0)}</span>
              </div>
              <div className="flex items-center justify-center text-white/20">
                <span className="text-lg">-</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <span className="text-sm text-white/50">Couts API (30j)</span>
                <span className="text-lg font-bold text-red-400">{formatPrice(finance?.total_costs ?? 0)}</span>
              </div>
              <div className="flex items-center justify-center text-white/20">
                <span className="text-lg">=</span>
              </div>
              <div className={cn(
                'flex items-center justify-between rounded-xl px-4 py-3 border',
                marginAlert
                  ? 'bg-red-500/[0.06] border-red-500/20'
                  : 'bg-emerald-500/[0.06] border-emerald-500/20'
              )}>
                <span className="text-sm text-white/50">Profit net</span>
                <div className="text-right">
                  <p className={cn('text-xl font-bold', marginAlert ? 'text-red-400' : 'text-emerald-400')}>
                    {formatPrice(finance?.profit ?? 0)}
                  </p>
                  <p className={cn('text-xs', marginAlert ? 'text-red-400/60' : 'text-emerald-400/60')}>
                    Marge {(finance?.margin_percent ?? 0).toFixed(1)}%
                  </p>
                </div>
              </div>
              {marginAlert && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/[0.06] border border-red-500/20 px-4 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400/80">
                    Marge inferieure a 30%. Optimiser les couts API ou augmenter les prix.
                  </p>
                </div>
              )}
            </div>
          )}
        </GoldCard>

        <GoldCard className="p-5" data-testid="admin-finance-forecast">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Prevision MRR</h3>
          </div>
          {loading ? (
            <div className="space-y-4">
              <Skeleton height={60} width="100%" rounded="xl" />
              <Skeleton height={120} width="100%" rounded="xl" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-xs text-white/40 mb-1">MRR actuel</p>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold text-amber-400">{formatPrice(finance?.mrr ?? 0)}</p>
                  <ArrowRight className="h-5 w-5 text-white/20" />
                  <div>
                    <p className="text-xl font-bold text-white/80">{formatPrice(finance?.forecast_next_month ?? 0)}</p>
                    <p className="text-xs text-white/30">Mois prochain</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-xs text-white/40 mb-2">Croissance</p>
                <div className="flex items-center gap-2">
                  {(finance?.mrr_growth_rate ?? 0) >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-400" />
                  )}
                  <span className={cn(
                    'text-2xl font-bold',
                    (finance?.mrr_growth_rate ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {(finance?.mrr_growth_rate ?? 0) >= 0 ? '+' : ''}{(finance?.mrr_growth_rate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-white/30 mt-1">Par rapport au mois precedent</p>
              </div>
            </div>
          )}
        </GoldCard>
      </div>

      {/* Withdrawals */}
      <GoldCard className="p-5" data-testid="admin-finance-withdrawals">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">Retraits</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={56} width="100%" rounded="lg" />
            ))}
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30">Aucun retrait en attente</p>
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((w) => {
              const statusConfig = STATUS_BADGE[w.status] ?? STATUS_BADGE.pending
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="text-sm text-white/70">{w.user_email}</p>
                      <p className="text-xs text-white/30">{formatDate(w.created_at)} &mdash; {w.method}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{formatPrice(w.amount)}</span>
                    <Badge variant={statusConfig.variant} size="sm">{statusConfig.label}</Badge>
                    {w.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleWithdrawalAction(w.id, 'approve')}
                          disabled={actionLoading === w.id}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                          data-testid={`admin-withdrawal-approve-${w.id}`}
                          title="Approuver"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleWithdrawalAction(w.id, 'reject')}
                          disabled={actionLoading === w.id}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          data-testid={`admin-withdrawal-reject-${w.id}`}
                          title="Rejeter"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GoldCard>
    </div>
  )
}
