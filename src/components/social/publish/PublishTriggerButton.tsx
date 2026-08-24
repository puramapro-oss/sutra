import { Share2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface PublishTriggerButtonProps {
  videoId: string
  variant: 'primary' | 'secondary' | 'compact'
  onClick: () => void
}

export function PublishTriggerButton({ videoId, variant, onClick }: PublishTriggerButtonProps) {
  const triggerLabel = 'Publier partout'

  if (variant === 'compact') {
    return (
      <button
        type="button"
        data-testid={`publish-everywhere-${videoId}`}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        aria-label={triggerLabel}
        className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/50 hover:text-violet-400 transition-colors flex items-center gap-1"
      >
        <Share2 className="h-3.5 w-3.5" />
        <Sparkles className="h-3 w-3" />
      </button>
    )
  }

  return (
    <Button
      variant={variant === 'secondary' ? 'secondary' : 'primary'}
      size="md"
      data-testid={`publish-everywhere-${videoId}`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <Share2 className="h-4 w-4" />
      {triggerLabel}
      <Sparkles className="h-4 w-4" />
    </Button>
  )
}
