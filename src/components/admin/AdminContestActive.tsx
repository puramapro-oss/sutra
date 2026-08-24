import { Trophy, CheckCircle, Loader2, Play, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import GoldCard from '@/components/admin/GoldCard'
import { Contest } from '@/hooks/useAdminContest'

const STATUS_CONFIG = {
  open: { variant: 'success' as const, label: 'Ouvert', icon: Play },
  judging: { variant: 'warning' as const, label: 'Evaluation', icon: Clock },
  completed: { variant: 'default' as const, label: 'Termine', icon: CheckCircle },
}

interface AdminContestActiveProps {
  contest: Contest | null
  loading: boolean
  confirmingWinners: boolean
  onConfirmWinners: () => void
}

export function AdminContestActive({
  contest,
  loading,
  confirmingWinners,
  onConfirmWinners,
}: AdminContestActiveProps) {
  return (
    <GoldCard glow className="p-5" data-testid="admin-contest-active">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
          Concours actif
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton height={60} width="100%" rounded="xl" />
          <Skeleton height={40} width="60%" rounded="lg" />
        </div>
      ) : contest ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-white">{contest.period_label}</p>
              <p className="text-xs text-white/40">
                {formatDate(contest.period_start)} &mdash; {formatDate(contest.period_end)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_CONFIG[contest.status].variant} size="md">
                {STATUS_CONFIG[contest.status].label}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <p className="text-xs text-white/40 mb-1">Soumissions</p>
              <p className="text-xl font-bold text-white">{contest.total_submissions}</p>
            </div>
            <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-3 text-center">
              <p className="text-xs text-amber-400/60 mb-1">Pool de prix</p>
              <p className="text-xl font-bold text-amber-400">
                {contest.prize_pool_amount.toFixed(2)} EUR
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <p className="text-xs text-white/40 mb-1">Type</p>
              <p className="text-xl font-bold text-white capitalize">{contest.type}</p>
            </div>
          </div>

          {contest.status === 'judging' && (
            <button
              onClick={onConfirmWinners}
              disabled={confirmingWinners}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-50"
              data-testid="admin-contest-confirm-winners"
            >
              {confirmingWinners ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirmer les gagnants
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-10 w-10 text-white/10 mb-3" />
          <p className="text-sm text-white/30">Aucun concours actif</p>
          <p className="text-xs text-white/15 mt-1">Les concours sont crees automatiquement par le CRON</p>
        </div>
      )}
    </GoldCard>
  )
}
