import { Button } from '@/components/ui/Button'

export interface PublishModalFooterProps {
  onCancel: () => void
  onPublish: () => void
  publishing: boolean
  selectedCount: number
  schedule: 'now' | 'later'
  retry?: boolean
}

export function PublishModalFooter({
  onCancel,
  onPublish,
  publishing,
  selectedCount,
  schedule,
  retry = false,
}: PublishModalFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 py-4 border-t border-white/[0.06] bg-[#0c0b14]/95">
      <Button
        variant="ghost"
        size="md"
        data-testid="publish-cancel"
        onClick={onCancel}
        disabled={publishing}
      >
        {retry ? 'Fermer' : 'Annuler'}
      </Button>
      <Button
        variant="primary"
        size="md"
        data-testid="publish-submit"
        onClick={onPublish}
        loading={publishing}
        disabled={publishing || selectedCount === 0}
      >
        {publishing
          ? 'Publication...'
          : retry ? `Reprendre les échecs (${selectedCount})`
          : schedule === 'later'
            ? `Programmer (${selectedCount} compte${selectedCount > 1 ? 's' : ''})`
            : `Publier (${selectedCount} compte${selectedCount > 1 ? 's' : ''})`}
      </Button>
    </div>
  )
}
