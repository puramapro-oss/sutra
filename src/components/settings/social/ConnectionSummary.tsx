import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export interface ConnectionSummaryProps {
  connectedCount: number
  totalPlatforms: number
  progressPct: number
}

export function ConnectionSummary({
  connectedCount,
  totalPlatforms,
  progressPct,
}: ConnectionSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.4 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 sm:p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/60">Statut de connexion</p>
            <p className="text-lg font-semibold" data-testid="connected-count">
              {connectedCount} / {totalPlatforms} comptes connectes
            </p>
          </div>
        </div>
        <Badge variant="premium">{progressPct}%</Badge>
      </div>
      <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500"
        />
      </div>
    </motion.div>
  )
}
