'use client'

import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { formatPrice } from '@/lib/utils'
import { CONTEST_DISTRIBUTION } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useCountdown } from '@/hooks/useCountdown'

interface Contest {
  id: string
  type: 'weekly' | 'monthly'
  period_label: string
  period_end: string
  prize_pool_amount: number
  total_submissions: number
}

interface ContestBannerProps {
  contest: Contest
  userEntries: number
}

export default function ContestBanner({ contest, userEntries }: ContestBannerProps) {
  const countdown = useCountdown(contest.period_end)

  return (
    <Card data-testid="contest-banner">
      <CardContent className="py-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 border border-amber-500/30 flex items-center justify-center">
            <Trophy className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Concours {contest.type === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
            </h2>
            <p className="text-sm text-white/40">{contest.period_label}</p>
          </div>
          <Badge variant="premium" className="ml-auto">
            {formatPrice(contest.prize_pool_amount)} a gagner
          </Badge>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-center gap-4 py-4" data-testid="contest-countdown">
          {[
            { value: countdown.days, label: 'Jours' },
            { value: countdown.hours, label: 'Heures' },
            { value: countdown.minutes, label: 'Min' },
            { value: countdown.seconds, label: 'Sec' },
          ].map((unit) => (
            <div key={unit.label} className="text-center">
              <div className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                <span className="text-2xl font-bold text-white font-mono tabular-nums">
                  {String(unit.value).padStart(2, '0')}
                </span>
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">{unit.label}</p>
            </div>
          ))}
        </div>

        {/* Prize distribution */}
        <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <p className="text-xs text-white/30 mb-2">Distribution des prix (Top 10)</p>
          <div className="flex gap-1">
            {CONTEST_DISTRIBUTION.map((pct, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 text-center py-1.5 rounded-md text-[10px] font-medium',
                  i === 0
                    ? 'bg-amber-500/20 text-amber-400'
                    : i < 3
                      ? 'bg-violet-500/10 text-violet-400'
                      : 'bg-white/[0.03] text-white/30'
                )}
              >
                #{i + 1} {pct}%
              </div>
            ))}
          </div>
        </div>

        {/* User entries count */}
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-violet-400 font-mono">
              <AnimatedCounter value={userEntries} className="" />
            </p>
            <p className="text-[10px] text-white/30">Tes places</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-lg font-bold text-white/60 font-mono">{contest.total_submissions}</p>
            <p className="text-[10px] text-white/30">Participants</p>
          </div>
        </div>
        <p className="text-[10px] text-white/20 text-center mt-2">
          +1 place par inscription, +1 par parrainage
        </p>
      </CardContent>
    </Card>
  )
}
