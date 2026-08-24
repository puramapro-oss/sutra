'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatPrice } from '@/lib/utils'

interface Contest {
  id: string
  type: 'weekly' | 'monthly'
  period_label: string
  prize_pool_amount: number
  rankings: { user_id: string; name: string; score: number; prize: number }[] | null
}

interface PastContestsSectionProps {
  contests: Contest[]
}

export default function PastContestsSection({ contests }: PastContestsSectionProps) {
  const [expandedContest, setExpandedContest] = useState<string | null>(null)

  if (contests.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Concours passes</h2>
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className="h-8 w-8 text-white/15 mx-auto mb-2" />
            <p className="text-sm text-white/30">Aucun concours passe</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-white/60 mb-3">Concours passes</h2>
      <div className="space-y-2">
        {contests.map((c) => (
          <Card key={c.id} data-testid={`past-contest-${c.id}`}>
            <button
              onClick={() => setExpandedContest(expandedContest === c.id ? null : c.id)}
              className="w-full"
            >
              <CardContent className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-white/70">{c.period_label}</span>
                  <Badge variant={c.type === 'weekly' ? 'info' : 'premium'} size="sm">
                    {c.type === 'weekly' ? 'Hebdo' : 'Mensuel'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/40">{formatPrice(c.prize_pool_amount)}</span>
                  {expandedContest === c.id ? (
                    <ChevronUp className="h-4 w-4 text-white/30" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/30" />
                  )}
                </div>
              </CardContent>
            </button>
            <AnimatePresence>
              {expandedContest === c.id && c.rankings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 space-y-1.5">
                    {c.rankings.slice(0, 10).map((r, i) => (
                      <div
                        key={r.user_id}
                        className="flex items-center justify-between text-sm py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-white/30 w-6">#{i + 1}</span>
                          <span className="text-white/60">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/30">{r.score} pts</span>
                          <span className="text-xs font-medium text-emerald-400">
                            {formatPrice(r.prize)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </div>
  )
}
