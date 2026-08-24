import { Sparkles, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PublishScheduleSectionProps {
  schedule: 'now' | 'later'
  scheduledAt: string
  onScheduleChange: (schedule: 'now' | 'later') => void
  onScheduledAtChange: (datetime: string) => void
}

export function PublishScheduleSection({
  schedule,
  scheduledAt,
  onScheduleChange,
  onScheduledAtChange,
}: PublishScheduleSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/90">Diffusion</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="schedule-now"
          onClick={() => onScheduleChange('now')}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-all',
            schedule === 'now'
              ? 'bg-violet-500/15 border-violet-500/50'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
          )}
        >
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-white/90">Publier maintenant</span>
        </button>
        <button
          type="button"
          data-testid="schedule-later"
          onClick={() => onScheduleChange('later')}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-all',
            schedule === 'later'
              ? 'bg-violet-500/15 border-violet-500/50'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
          )}
        >
          <Calendar className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-white/90">Programmer</span>
        </button>
      </div>

      {schedule === 'later' && (
        <input
          type="datetime-local"
          data-testid="scheduled-at-input"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/90 focus:outline-none focus:border-violet-500/50"
        />
      )}
    </div>
  )
}
