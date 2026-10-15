'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import type { useAutoScheduler } from '@/hooks/useAutoScheduler'

export default function AutoSchedulerControl({ scheduler }: { scheduler: ReturnType<typeof useAutoScheduler> }) {
  const { config, busy, error, message, target, toggle, retry } = scheduler
  return (
    <Card>
      <CardContent className="space-y-4 text-sm text-white/80" data-testid="auto-scheduler">
        <h2 className="text-lg font-semibold text-white">Ordonnanceur autonome</h2>
        <p role="status" aria-live="polite" data-testid="auto-status">{message}</p>
        <p className="text-amber-200" data-testid="auto-runtime-status">Exécution serveur non vérifiable depuis cet écran. Une préférence enregistrée ne confirme pas le démarrage de l’ordonnanceur.</p>
        <p>L’autorisation permet au moteur serveur existant de traiter tes plannings lorsqu’il est opérationnel. Des services payants peuvent être utilisés. Mettre en pause ne supprime pas les tâches déjà lancées.</p>
        {config && <p>{config.auto_publish && !config.require_approval_before_publish
          ? 'La publication automatique sans validation préalable est autorisée dans tes réglages. Vérifie tes autorisations avant d’activer la planification.'
          : 'Les règles de validation et de publication de tes réglages sont conservées.'} <Link href="/auto/settings" className="text-violet-300 underline">Voir les réglages</Link></p>}
        {error && <p role="alert" className="text-red-200">{error}</p>}
        <div className="flex flex-wrap gap-3 items-center">
          {error ? <Button data-testid="auto-retry" variant="secondary" loading={busy} onClick={retry}>
            {target === null ? 'Réessayer la lecture' : 'Vérifier et réessayer'}
          </Button> : <Button data-testid="auto-toggle" loading={busy} disabled={!config} onClick={toggle}>
            {config?.is_active ? 'Mettre en pause' : 'Autoriser la planification'}
          </Button>}
          <Link href="/auto/schedules" className="text-violet-300 underline rounded-md py-2 focus-visible:outline-2 focus-visible:outline-violet-400">Gérer les plannings</Link>
        </div>
        {config && config.schedules.length === 0 && <p>Aucun planning enregistré. Ajoute un planning pour préparer des occurrences.</p>}
      </CardContent>
    </Card>
  )
}
