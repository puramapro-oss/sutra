'use client'

import { Play, Loader2, AlertTriangle } from 'lucide-react'
import { useAdminContest } from '@/hooks/useAdminContest'
import { AdminContestActive } from '@/components/admin/AdminContestActive'
import { AdminContestSubmissions } from '@/components/admin/AdminContestSubmissions'
import { AdminContestPast } from '@/components/admin/AdminContestPast'
import { AdminContestHallOfFame } from '@/components/admin/AdminContestHallOfFame'

export default function AdminContestPage() {
  const {
    contests,
    activeContest,
    submissions,
    hallOfFame,
    loading,
    error,
    judgingId,
    confirmingWinners,
    triggeringDraw,
    fetchData,
    triggerDraw,
    handleJudge,
    handleConfirmWinners,
  } = useAdminContest()

  if (error && !contests.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">Erreur de chargement</h2>
        <p className="text-white/50 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          data-testid="admin-contest-retry"
        >
          Reessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="admin-contest-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Gestion des concours</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerDraw('weekly')}
            disabled={triggeringDraw !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            data-testid="trigger-weekly-draw"
          >
            {triggeringDraw === 'weekly' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Tirage hebdo
          </button>
          <button
            onClick={() => triggerDraw('monthly')}
            disabled={triggeringDraw !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            data-testid="trigger-monthly-draw"
          >
            {triggeringDraw === 'monthly' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Tirage mensuel
          </button>
        </div>
      </div>

      <AdminContestActive
        contest={activeContest}
        loading={loading}
        confirmingWinners={confirmingWinners}
        onConfirmWinners={handleConfirmWinners}
      />

      <AdminContestSubmissions
        submissions={submissions}
        loading={loading}
        judgingId={judgingId}
        onJudge={handleJudge}
      />

      <AdminContestPast contests={contests} loading={loading} />

      <AdminContestHallOfFame entries={hallOfFame} loading={loading} />
    </div>
  )
}
