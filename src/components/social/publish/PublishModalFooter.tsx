import { Button } from '@/components/ui/Button'

export interface PublishModalFooterProps {
  onCancel: () => void
  onPublish: () => void
  publishing: boolean
  verifying?: boolean
  canVerify?: boolean
  onVerify?: () => void
  selectedCount: number
  schedule: 'now' | 'later'
  retry?: boolean
}

export function PublishModalFooter({
  onCancel,
  onPublish,
  publishing,
  verifying = false,
  canVerify = false,
  onVerify,
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
        disabled={publishing || verifying}
      >
        {retry ? 'Fermer' : 'Annuler'}
      </Button>
      {onVerify && <Button variant="secondary" size="md" data-testid="publish-verify"
        onClick={onVerify} loading={verifying} disabled={publishing || verifying || !canVerify}>
        Vérifier l’état
      </Button>}
      <Button
        variant="primary"
        size="md"
        data-testid="publish-submit"
        onClick={onPublish}
        loading={publishing}
        disabled={publishing || verifying || selectedCount === 0}
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
