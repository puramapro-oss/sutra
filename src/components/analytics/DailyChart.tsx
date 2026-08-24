import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import type { DailyCount } from '@/lib/analytics'

interface DailyChartProps {
  dailyCounts: DailyCount[]
  chartMax: number
  chartLabels: { index: number; label: string }[]
}

export default function DailyChart({ dailyCounts, chartMax, chartLabels }: DailyChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.4 }}
    >
      <h2 className="text-lg font-semibold text-white mb-4">Videos par jour</h2>
      <Card className="bg-white/[0.02] border-white/[0.06]" data-testid="chart-daily">
        <CardContent className="p-5">
          {dailyCounts.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">Aucune donnee disponible</p>
          ) : (
            <div className="relative">
              <div className="flex items-end gap-[2px] h-40">
                {dailyCounts.map((day, i) => {
                  const heightPercent = chartMax > 0 ? (day.count / chartMax) * 100 : 0
                  return (
                    <div key={day.date} className="flex-1 group relative flex flex-col justify-end">
                      <motion.div
                        className={cn(
                          'w-full rounded-t-sm transition-colors cursor-default',
                          day.count > 0
                            ? 'bg-violet-500/60 hover:bg-violet-400/80'
                            : 'bg-white/[0.04]'
                        )}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(heightPercent, 2)}%` }}
                        transition={{ delay: 0.5 + i * 0.015, duration: 0.4 }}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                        <div className="bg-[#1a1a2e] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs text-white whitespace-nowrap shadow-xl">
                          <span className="text-white/60">
                            {new Date(day.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          <span className="ml-2 font-medium">
                            {day.count} video{day.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="relative h-6 mt-2">
                {chartLabels.map((lbl) => {
                  const leftPercent =
                    dailyCounts.length > 1 ? (lbl.index / (dailyCounts.length - 1)) * 100 : 50
                  return (
                    <span
                      key={lbl.index}
                      className="absolute text-[10px] text-white/30 -translate-x-1/2"
                      style={{ left: `${leftPercent}%` }}
                    >
                      {lbl.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
