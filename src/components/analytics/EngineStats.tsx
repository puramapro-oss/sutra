import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface EngineStatsProps {
  engineStats: Array<{
    key: string
    label: string
    color: string
    count: number
    percent: number
  }>
}

export default function EngineStats({ engineStats }: EngineStatsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
    >
      <h2 className="text-lg font-semibold text-white mb-4">Moteur prefere</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {engineStats.map((engine) => (
          <Card
            key={engine.key}
            className="bg-white/[0.02] border-white/[0.06]"
            data-testid={`engine-${engine.key}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">{engine.label}</span>
                <Badge variant={engine.percent > 0 ? 'premium' : 'default'} size="sm">
                  {engine.percent}%
                </Badge>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full bg-gradient-to-r', engine.color)}
                  initial={{ width: 0 }}
                  animate={{ width: `${engine.percent}%` }}
                  transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-white/40 mt-2">
                {engine.count} video{engine.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}
