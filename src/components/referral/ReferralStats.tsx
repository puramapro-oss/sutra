'use client'

import { Users, TrendingUp, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'

interface ReferralStatsProps {
  activeFilleuls: number
  totalCommissions: number
  pendingCommissions: number
}

export default function ReferralStats({ activeFilleuls, totalCommissions, pendingCommissions }: ReferralStatsProps) {
  const stats = [
    {
      icon: Users,
      label: 'Filleuls actifs',
      value: activeFilleuls,
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
      icon: TrendingUp,
      label: 'Commissions gagnees',
      value: totalCommissions,
      prefix: '',
      suffix: ' EUR',
      decimals: 2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      icon: Clock,
      label: 'En attente',
      value: pendingCommissions,
      prefix: '',
      suffix: ' EUR',
      decimals: 2,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center border', stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-white/40">{stat.label}</p>
                <p className="text-xl font-bold text-white">
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals ?? 0}
                  />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
