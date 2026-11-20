'use client'

import Button from '@/components/ui/Button'
import type { ProductionIntent } from '@/lib/production-intent-client'

export default function ProductionRequestStatus({ intent, busy, cancelling, message, error, onResume, onCancel }: {
  intent: (Pick<ProductionIntent, 'requestId' | 'cancelRequested'> & Partial<ProductionIntent>) | null
  busy: boolean
  cancelling: boolean
  message: string
  error: string | null
  onResume: () => void
  onCancel: () => void
}) {
  return (
    <section aria-label="Suivi de la demande" data-testid="production-request-status" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 text-sm text-white/80">
      <h2 className="font-semibold text-white">Suivi et annulation</h2>
      <p role="status" aria-live="polite">{message || (error ? 'État de la demande non confirmé.' : 'Aucune demande en cours dans cet onglet.')}</p>
      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-red-200">{error}</p>}
      {intent && <>
        <p className="break-all text-xs">Référence : {intent.requestId}</p>
        <p>La demande reste enregistrée dans cet onglet après rechargement. Ne ferme pas cet onglet tant que son état est incertain.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" data-testid="production-resume" disabled={busy || cancelling} onClick={onResume}>
            Reprendre le suivi
          </Button>
          <Button variant="danger" data-testid="production-cancel" loading={cancelling} onClick={onCancel}>
            {intent.cancelRequested ? 'Réessayer l’annulation' : 'Annuler la tâche'}
          </Button>
        </div>
      </>}
      <p>L’annulation concerne la tâche SUTRA. Elle ne garantit ni l’arrêt d’un fournisseur déjà lancé, ni un remboursement. Fermer la page n’annule pas la tâche.</p>
    </section>
  )
}
