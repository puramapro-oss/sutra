import { useId } from 'react'
import { Sparkles, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

/** datetime-local uses the browser timezone, never a truncated UTC string. */
export function localDateTime(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 16)
}

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
  const inputId = useId()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const instant = new Date(scheduledAt)
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/90">Diffusion</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="schedule-now"
          aria-pressed={schedule === 'now'}
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
          aria-pressed={schedule === 'later'}
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
        <div className="space-y-2">
        <label htmlFor={inputId} className="block text-sm text-white/80">Date et heure de publication</label>
        <p id={`${inputId}-zone`} className="text-xs text-white/70 break-words">Fuseau de cet appareil : {timezone}</p>
        <input
          id={inputId}
          aria-describedby={`${inputId}-zone`}
          required
          type="datetime-local"
          data-testid="scheduled-at-input"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          min={localDateTime(new Date())}
          className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/90 focus:outline-none focus:border-violet-500/50"
        />
        {Number.isFinite(instant.getTime()) && <p className="text-xs text-white/70">Heure retenue : {instant.toLocaleString('fr-FR', { timeZoneName: 'longOffset' })}. Vérifie ce décalage lors du changement d’heure.</p>}
        </div>
      )}
    </div>
  )
}
