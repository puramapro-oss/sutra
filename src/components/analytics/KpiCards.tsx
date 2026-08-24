import { motion } from 'framer-motion'
import { TrendingUp, Film, Zap, Clock, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { Stats } from '@/lib/analytics'
import { formatDuration } from '@/lib/analytics'

interface KpiCardsProps {
  stats: Stats
}

export default function KpiCards({ stats }: KpiCardsProps) {
  const kpis = [
    {
      label: 'Videos ce mois',
      value: stats.videosThisMonth,
      icon: Film,
      suffix: '',
      trend: stats.videosThisMonth > 0 ? ('up' as const) : ('neutral' as const),
      testId: 'kpi-videos-month',
    },
    {
      label: 'Credits utilises',
      value: stats.creditsUsed,
      icon: Zap,
      suffix: '',
      trend: 'neutral' as const,
      testId: 'kpi-credits',
    },
    {
      label: 'Duree totale',
      value: stats.totalDuration,
      icon: Clock,
      suffix: 's',
      format: formatDuration,
      testId: 'kpi-duration',
    },
    {
      label: 'Cout estime',
      value: stats.totalCost,
      icon: DollarSign,
      suffix: ' EUR',
      decimals: 2,
      testId: 'kpi-cost',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.testId}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
          >
            <Card className="bg-white/[0.02] border-white/[0.06]" data-testid={kpi.testId}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-violet-400" />
                  </div>
                  {kpi.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                  {kpi.trend === 'neutral' && <div className="w-4 h-4" />}
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {kpi.format ? (
                    kpi.format(kpi.value)
                  ) : (
                    <AnimatedCounter
                      value={kpi.value}
                      suffix={kpi.suffix}
                      decimals={kpi.decimals ?? 0}
                      data-testid={`${kpi.testId}-value`}
                    />
                  )}
                </div>
                <p className="text-xs text-white/40 mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
