import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import GoldCard from '@/components/admin/GoldCard'
import { Contest } from '@/hooks/useAdminContest'

interface AdminContestPastProps {
  contests: Contest[]
  loading: boolean
}

export function AdminContestPast({ contests, loading }: AdminContestPastProps) {
  const completedContests = contests.filter((c) => c.status === 'completed')

  return (
    <GoldCard className="p-5" data-testid="admin-contest-past">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
          Concours passes
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} width="100%" rounded="lg" />
          ))}
        </div>
      ) : completedContests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-white/10 mb-3" />
          <p className="text-sm text-white/30">Aucun concours termine</p>
        </div>
      ) : (
        <div className="space-y-2">
          {completedContests.map((contest) => (
            <div
              key={contest.id}
              className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-white/70">{contest.period_label}</p>
                <p className="text-xs text-white/30">
                  {contest.total_submissions} soumissions &mdash; {contest.prize_pool_amount.toFixed(2)} EUR
                </p>
              </div>
              <Badge variant="default" size="sm">Termine</Badge>
            </div>
          ))}
        </div>
      )}
    </GoldCard>
  )
}
