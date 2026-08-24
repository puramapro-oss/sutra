import { Wand2, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PublishCaptionSectionProps {
  captionMode: 'auto' | 'custom'
  customCaption: string
  autoHashtags: boolean
  onCaptionModeChange: (mode: 'auto' | 'custom') => void
  onCustomCaptionChange: (caption: string) => void
  onAutoHashtagsChange: (enabled: boolean) => void
}

export function PublishCaptionSection({
  captionMode,
  customCaption,
  autoHashtags,
  onCaptionModeChange,
  onCustomCaptionChange,
  onAutoHashtagsChange,
}: PublishCaptionSectionProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/90">Caption</h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="caption-mode-auto"
          onClick={() => onCaptionModeChange('auto')}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-all',
            captionMode === 'auto'
              ? 'bg-violet-500/15 border-violet-500/50'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
          )}
        >
          <Wand2 className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-white/90 text-left">Caption automatique IA</span>
        </button>
        <button
          type="button"
          data-testid="caption-mode-custom"
          onClick={() => onCaptionModeChange('custom')}
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl border transition-all',
            captionMode === 'custom'
              ? 'bg-violet-500/15 border-violet-500/50'
              : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
          )}
        >
          <Hash className="h-4 w-4 text-violet-400" />
          <span className="text-xs text-white/90 text-left">Caption personnalisee</span>
        </button>
      </div>

      {captionMode === 'custom' && (
        <textarea
          data-testid="custom-caption-input"
          value={customCaption}
          onChange={(e) => onCustomCaptionChange(e.target.value)}
          placeholder="Ecris ta caption..."
          rows={3}
          maxLength={2200}
          className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
        />
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoHashtags}
          onChange={(e) => onAutoHashtagsChange(e.target.checked)}
          className="h-4 w-4 rounded accent-violet-500"
          data-testid="auto-hashtags-toggle"
        />
        <span className="text-xs text-white/70">Ajouter hashtags viraux automatiquement</span>
      </label>
    </div>
  )
}
