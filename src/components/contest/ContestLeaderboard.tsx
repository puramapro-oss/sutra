'use client'

import { Star, Crown, Medal, Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatPrice } from '@/lib/utils'

const RANK_ICONS = [Crown, Medal, Award]
const RANK_COLORS = ['text-amber-400', 'text-gray-300', 'text-amber-600']

interface LeaderboardEntry {
  user_id: string
  name: string
  score: number
  prize: number
  rank: number
}

interface ContestLeaderboardProps {
  rankings: LeaderboardEntry[]
}

export default function ContestLeaderboard({ rankings }: ContestLeaderboardProps) {
  if (!rankings || rankings.length === 0) return null

  return (
    <Card data-testid="contest-leaderboard">
      <CardContent>
        <h2 className="text-sm font-semibold text-white/60 mb-4">Classement</h2>
        <div className="space-y-2">
          {rankings.slice(0, 10).map((entry, i) => {
            const RankIcon = RANK_ICONS[i] ?? Star
            const rankColor = RANK_COLORS[i] ?? 'text-white/40'
            return (
              <div
                key={entry.user_id}
                data-testid={`leaderboard-rank-${i + 1}`}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                  i < 3 ? 'bg-white/[0.03] border border-white/[0.06]' : ''
                )}
              >
                <div className="flex items-center justify-center w-8">
                  {i < 3 ? (
                    <RankIcon className={cn('h-5 w-5', rankColor)} />
                  ) : (
                    <span className="text-sm font-mono text-white/30">#{i + 1}</span>
                  )}
                </div>
                <span className="flex-1 text-sm text-white/70">{entry.name}</span>
                <span className="text-sm font-mono text-white/50">{entry.score} pts</span>
                <Badge variant={i === 0 ? 'premium' : 'default'} size="sm">
                  {formatPrice(entry.prize)}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
