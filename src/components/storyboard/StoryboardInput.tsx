import { motion } from 'framer-motion'
import { Sparkles, Monitor, Smartphone, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { VideoFormat, DurationTarget } from '@/lib/storyboard'
import { FORMAT_OPTIONS, DURATION_OPTIONS } from '@/lib/storyboard'

interface StoryboardInputProps {
  idea: string
  format: VideoFormat
  durationTarget: DurationTarget
  isGenerating: boolean
  error: string | null
  onIdeaChange: (idea: string) => void
  onFormatChange: (format: VideoFormat) => void
  onDurationChange: (duration: DurationTarget) => void
  onGenerate: () => void
}

const ICON_MAP = {
  Monitor,
  Smartphone,
  Square,
}

export default function StoryboardInput({
  idea,
  format,
  durationTarget,
  isGenerating,
  error,
  onIdeaChange,
  onFormatChange,
  onDurationChange,
  onGenerate,
}: StoryboardInputProps) {
  return (
    <motion.div
      className={cn(
        'bg-white/[0.02] border border-white/[0.06] rounded-xl backdrop-blur-xl p-6 space-y-5'
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
    >
      {/* Textarea */}
      <div>
        <label htmlFor="idea" className="block text-sm font-medium text-white/60 mb-2">
          Idee de video
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          placeholder="Decris ton idee de video..."
          rows={3}
          className={cn(
            'w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-3',
            'text-white placeholder:text-white/30 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40',
            'transition-all duration-200'
          )}
        />
      </div>

      {/* Format selector */}
      <div>
        <label className="block text-sm font-medium text-white/60 mb-2">Format</label>
        <div className="flex gap-3">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = ICON_MAP[opt.icon as keyof typeof ICON_MAP]
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFormatChange(opt.id)}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200',
                  format === opt.id
                    ? 'bg-violet-500/15 border-violet-500/40 text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/5'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-white/40">{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Duration target */}
      <div>
        <label className="block text-sm font-medium text-white/60 mb-2">Duree cible</label>
        <div className="flex gap-3">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onDurationChange(opt.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200',
                durationTarget === opt.id
                  ? 'bg-violet-500/15 border-violet-500/40 text-white'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/5'
              )}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-white/40">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={onGenerate}
        disabled={!idea.trim() || isGenerating}
        loading={isGenerating}
        size="lg"
        className="w-full"
        data-testid="generate-storyboard-btn"
      >
        <Sparkles className="h-5 w-5" />
        {isGenerating ? 'Generation en cours...' : 'Generer le storyboard'}
      </Button>

      {error && (
        <motion.p
          className="text-red-400 text-sm text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}
    </motion.div>
  )
}
