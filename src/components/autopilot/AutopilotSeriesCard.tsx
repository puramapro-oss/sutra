'use client'

import { motion } from 'framer-motion'
import { Clock, Settings, Trash2, PlayCircle, Camera } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { AutopilotSeries } from '@/types'

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88A2.89 2.89 0 019.49 12.4v-3.5a6.37 6.37 0 00-6.38 6.38 6.37 6.37 0 006.38 6.38 6.37 6.37 0 006.38-6.38V9.42a8.16 8.16 0 004.72 1.49V7.46a4.85 4.85 0 01-1-.77z" />
  </svg>
)

const NETWORK_OPTIONS = [
  { id: 'youtube', label: 'YouTube', icon: PlayCircle },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { id: 'instagram', label: 'Instagram', icon: Camera },
] as const

interface AutopilotSeriesCardProps {
  series: AutopilotSeries
  index: number
  togglingId: string | null
  deletingId: string | null
  onToggle: (series: AutopilotSeries) => void
  onDelete: (id: string) => void
}

export default function AutopilotSeriesCard({
  series,
  index,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
}: AutopilotSeriesCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card hover data-testid={`series-card-${series.id}`}>
        <CardContent>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{series.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="premium" size="sm" className="capitalize">{series.niche}</Badge>
                <Badge variant={series.frequency === 'daily' ? 'warning' : 'info'} size="sm">
                  {series.frequency === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                </Badge>
              </div>
            </div>
            <button
              onClick={() => onToggle(series)}
              disabled={togglingId === series.id}
              data-testid={`series-toggle-${series.id}`}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                series.is_active ? 'bg-violet-500' : 'bg-white/10'
              )}
            >
              <motion.div
                animate={{ x: series.is_active ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
              />
            </button>
          </div>

          {/* Networks */}
          <div className="flex items-center gap-2 mb-3">
            {series.networks.map((n) => {
              const net = NETWORK_OPTIONS.find((no) => no.id === n)
              if (!net) return null
              const Icon = net.icon
              return (
                <div
                  key={n}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-xs text-white/50"
                >
                  <Icon />
                  {net.label}
                </div>
              )
            })}
          </div>

          {/* Info */}
          <div className="flex items-center justify-between text-xs text-white/30">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {series.next_run_at
                ? `Prochain: ${new Date(series.next_run_at).toLocaleDateString('fr-FR')}`
                : 'Non programme'}
            </div>
            <div className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              {series.approval_mode === 'auto' ? 'Auto' : 'Manuelle'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(series.id)}
              loading={deletingId === series.id}
              data-testid={`series-delete-${series.id}`}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
