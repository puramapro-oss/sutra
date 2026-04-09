'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Ticket, Trophy, Clock, Coins, Users, CalendarDays, Gift } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatDate, formatPrice } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface Draw {
  id: string
  draw_date: string
  pool_amount: number
  status: string
}

interface Winner {
  rank: number
  amount_won: number
  user: { name: string; avatar_url: string | null }
}

const ticketSources = [
  { source: 'Inscription', tickets: '+1' },
  { source: 'Parrainage', tickets: '+2' },
  { source: 'Mission completee', tickets: '+1' },
  { source: 'Partage social', tickets: '+1' },
  { source: 'Avis store', tickets: '+3' },
  { source: 'Challenge reussi', tickets: '+2' },
  { source: 'Streak 7 jours', tickets: '+1' },
  { source: 'Streak 30 jours', tickets: '+5' },
  { source: 'Abonnement actif', tickets: '+5/mois' },
  { source: '500 points', tickets: '= 1 ticket' },
]

export default function LotteryPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentDraw, setCurrentDraw] = useState<Draw | null>(null)
  const [userTickets, setUserTickets] = useState(0)
  const [pastWinners, setPastWinners] = useState<Winner[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lottery')
      if (res.ok) {
        const data = await res.json()
        setCurrentDraw(data.currentDraw || null)
        setUserTickets(data.userTickets || 0)
        setPastWinners(data.pastWinners || [])
      }
    } catch { /* empty */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Ticket className="w-7 h-7 text-amber-400" />
          Tirage Mensuel
        </h1>
        <p className="text-white/50 mt-1">10 gagnants chaque mois — 4% du chiffre d&apos;affaires redistribue</p>
      </div>

      {/* Current Draw */}
      <Card className="glass border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-violet-500/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                {currentDraw ? 'Prochain tirage' : 'Tirage a venir'}
              </h2>
              {currentDraw && (
                <p className="text-white/50 text-sm mt-1">
                  <CalendarDays className="w-4 h-4 inline mr-1" />
                  {formatDate(currentDraw.draw_date)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-6">
              {currentDraw && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">
                    {formatPrice(currentDraw.pool_amount)}
                  </div>
                  <div className="text-xs text-white/40">Cagnotte</div>
                </div>
              )}
              <div className="text-center glass rounded-xl px-4 py-2">
                <div className="text-2xl font-bold text-white">
                  <AnimatedCounter value={userTickets} />
                </div>
                <div className="text-xs text-white/40">Tes tickets</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prize Distribution */}
      <Card className="glass">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Repartition des gains
          </h2>
          <div className="space-y-2">
            {[
              { rank: '1er', pct: '1.2%' },
              { rank: '2eme', pct: '0.8%' },
              { rank: '3eme', pct: '0.6%' },
              { rank: '4eme', pct: '0.4%' },
              { rank: '5-10eme', pct: '0.2% chacun' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className={cn(
                  'font-medium',
                  i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-white/60'
                )}>
                  {r.rank}
                </span>
                <span className="text-white/80">{r.pct} du CA</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How to Get Tickets */}
      <Card className="glass">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Ticket className="w-5 h-5 text-violet-400" />
            Comment gagner des tickets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ticketSources.map((ts, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03]">
                <span className="text-sm text-white/70">{ts.source}</span>
                <Badge variant="info" className="text-xs">{ts.tickets}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Past Winners */}
      {pastWinners.length > 0 && (
        <Card className="glass">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Derniers gagnants</h2>
            <div className="space-y-2">
              {pastWinners.map((w, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      w.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                      w.rank === 2 ? 'bg-gray-500/20 text-gray-300' :
                      w.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/5 text-white/40'
                    )}>
                      {w.rank}
                    </span>
                    <span className="text-white/80">{w.user?.name || 'Createur'}</span>
                  </div>
                  <span className="font-semibold text-white">{formatPrice(w.amount_won)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
