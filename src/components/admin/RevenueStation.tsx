import { TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react'
import dynamic from 'next/dynamic'
import { GoldCard, StationHeader, StatSkeleton } from '@/components/admin/AdminComponents'
import { cn, formatPrice } from '@/lib/utils'

const AdminRevenueChart = dynamic(
  () => import('@/components/admin/AdminRevenueChart').then((m) => m.AdminRevenueChart),
  { ssr: false, loading: () => <div className="h-48 rounded-xl bg-white/[0.02] animate-pulse" /> }
)

export interface RevenueStationProps {
  totalRevenue: number
  mrr: number
  totalApiCosts: number
  margin: string
  marginAlert: boolean
  loading: boolean
}

export function RevenueStation({
  totalRevenue,
  mrr,
  totalApiCosts,
  margin,
  marginAlert,
  loading,
}: RevenueStationProps) {
  return (
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
            <p className="text-2xl font-bold text-white">{formatPrice(totalRevenue)}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              <span>Tout temps</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">MRR</p>
            <p className="text-2xl font-bold text-amber-400">{formatPrice(mrr)}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-400/60">
              <Zap className="h-3 w-3" />
              <span>30 derniers jours</span>
            </div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-xs text-white/40 mb-1">Profit net (30j)</p>
            <p className={cn('text-2xl font-bold', marginAlert ? 'text-red-400' : 'text-emerald-400')}>
              {formatPrice(mrr - totalApiCosts)}
            </p>
            <div
              className={cn(
                'flex items-center gap-1 mt-1 text-xs',
                marginAlert ? 'text-red-400/60' : 'text-emerald-400/60'
              )}
            >
              {marginAlert ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              <span>Marge {margin}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4" data-testid="admin-revenue-chart">
        <AdminRevenueChart />
      </div>
    </GoldCard>
  )
}
