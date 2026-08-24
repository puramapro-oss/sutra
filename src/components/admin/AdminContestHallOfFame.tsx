import { motion } from 'framer-motion'
import { Award, Crown, Medal } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import GoldCard from '@/components/admin/GoldCard'
import { HallOfFameEntry } from '@/hooks/useAdminContest'

const RANK_ICONS = [Crown, Medal, Award]

interface AdminContestHallOfFameProps {
  entries: HallOfFameEntry[]
  loading: boolean
}

export function AdminContestHallOfFame({ entries, loading }: AdminContestHallOfFameProps) {
  const rankColors = ['text-amber-400', 'text-gray-300', 'text-orange-400']

  return (
    <GoldCard glow className="p-5" data-testid="admin-contest-hall-of-fame">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
          Hall of Fame
        </h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={56} width="100%" rounded="lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Award className="h-10 w-10 text-amber-400/10 mb-3" />
          <p className="text-sm text-white/30">Le Hall of Fame est vide</p>
          <p className="text-xs text-white/15 mt-1">Les gagnants de concours apparaitront ici</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const RankIcon = RANK_ICONS[entry.rank - 1] ?? Award
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <RankIcon className={cn('h-5 w-5', rankColors[entry.rank - 1] ?? 'text-white/40')} />
                  <div>
                    <p className="text-sm font-medium text-white/80">{entry.user_name}</p>
                    <p className="text-xs text-white/30">{entry.contest_label}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-400">{entry.prize_amount.toFixed(2)} EUR</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </GoldCard>
  )
}
