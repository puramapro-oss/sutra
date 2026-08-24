import { Button } from '@/components/ui/Button'
import { type SocialPlatform } from '@/lib/zernio'

export interface PublishModalFooterProps {
  onCancel: () => void
  onPublish: () => void
  publishing: boolean
  selectedPlatforms: Set<SocialPlatform>
  schedule: 'now' | 'later'
}

export function PublishModalFooter({
  onCancel,
  onPublish,
  publishing,
  selectedPlatforms,
  schedule,
}: PublishModalFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] bg-[#0c0b14]/95 backdrop-blur-xl">
      <Button
        variant="ghost"
        size="md"
        data-testid="publish-cancel"
        onClick={onCancel}
        disabled={publishing}
      >
        Annuler
      </Button>
      <Button
        variant="primary"
        size="md"
        data-testid="publish-submit"
        onClick={onPublish}
        loading={publishing}
        disabled={publishing || selectedPlatforms.size === 0}
      >
        {publishing
          ? 'Publication...'
          : schedule === 'later'
            ? 'Programmer'
            : `Publier (${selectedPlatforms.size})`}
      </Button>
    </div>
  )
}
