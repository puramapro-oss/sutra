import { Users } from 'lucide-react'
import { GoldCard, StationHeader } from '@/components/admin/AdminComponents'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-white/10 text-white/60',
  starter: 'bg-blue-500/15 text-blue-400',
  creator: 'bg-violet-500/15 text-violet-400',
  empire: 'bg-amber-500/15 text-amber-400',
}

export interface UsersStationProps {
  totalUsers: number
  payingUsers: number
  activeUsers7d: number
  conversionRate: string
  totalVideos: number
  planDistribution: Record<string, number> | null
  loading: boolean
}

export function UsersStation({
  totalUsers,
  payingUsers,
  activeUsers7d,
  conversionRate,
  totalVideos,
  planDistribution,
  loading,
}: UsersStationProps) {
  return (
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
              {totalUsers}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <span className="text-sm text-white/50">Utilisateurs payants</span>
            <span className="text-lg font-bold text-amber-400" data-testid="admin-paying-users">
              {payingUsers}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <span className="text-sm text-white/50">Actifs 7j</span>
            <span className="text-lg font-bold text-white">{activeUsers7d}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <span className="text-sm text-white/50">Taux de conversion</span>
            <span
              className={cn(
                'text-lg font-bold',
                parseFloat(conversionRate) > 5 ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {conversionRate}%
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <span className="text-sm text-white/50">Videos creees</span>
            <span className="text-lg font-bold text-violet-400">{totalVideos}</span>
          </div>

          {planDistribution && (
            <div className="pt-2">
              <p className="text-xs text-white/30 mb-2">Distribution des plans</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(planDistribution).map(([plan, count]) => (
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
  )
}
