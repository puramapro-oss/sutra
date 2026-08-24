import { motion } from 'framer-motion'
import { Activity, UserPlus, CreditCard, Video, Eye, AlertTriangle, type LucideIcon } from 'lucide-react'
import { GoldCard, StationHeader } from '@/components/admin/AdminComponents'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, formatRelativeDate } from '@/lib/utils'

const ACTIVITY_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  signup: { icon: UserPlus, color: 'text-emerald-400' },
  subscription: { icon: CreditCard, color: 'text-amber-400' },
  video: { icon: Video, color: 'text-violet-400' },
  publish: { icon: Eye, color: 'text-blue-400' },
  cancel: { icon: AlertTriangle, color: 'text-red-400' },
}

export interface ActivityEvent {
  id: string
  type: string
  description: string
  created_at: string
  metadata: Record<string, unknown> | null
}

export interface ActivityFeedProps {
  activity: ActivityEvent[]
  loading: boolean
}

export function ActivityFeed({ activity, loading }: ActivityFeedProps) {
  return (
    <GoldCard className="p-5" data-testid="admin-activity-feed">
      <StationHeader title="Feed Activite" icon={Activity} />
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={48} width="100%" rounded="lg" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-10 w-10 text-white/10 mb-3" />
          <p className="text-sm text-white/30">Aucune activite recente</p>
          <p className="text-xs text-white/15 mt-1">Les evenements apparaitront ici en temps reel</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {activity.map((event, idx) => {
            const config = ACTIVITY_ICONS[event.type] ?? { icon: Activity, color: 'text-white/40' }
            const Icon = config.icon
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3"
              >
                <Icon className={cn('h-4 w-4 shrink-0', config.color)} />
                <p className="text-sm text-white/70 flex-1 truncate">{event.description}</p>
                <span className="text-xs text-white/25 shrink-0">{formatRelativeDate(event.created_at)}</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </GoldCard>
  )
}
