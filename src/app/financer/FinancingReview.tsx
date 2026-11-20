import { ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react'
import type { Aide } from '@/types/financer'
import { formatMontant, officialAidUrl } from '@/lib/financer-utils'

export function FinancingReview({ aides, onBack }: { aides: Aide[]; onBack: () => void }) {
  return (
    <section className="space-y-6" aria-labelledby="financing-review-title">
      <h2 id="financing-review-title" className="text-2xl font-semibold">Vérifier les démarches</h2>
      <div role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5" data-testid="financer-pdf-unavailable">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <AlertTriangle className="h-5 w-5" /> Génération de dossiers PDF indisponible
        </div>
        <p className="mt-3 text-sm text-white/70">
          Aucun dossier n&apos;a été généré ni envoyé. Pour consulter les conditions et déposer une demande,
          utilise le site de l&apos;organisme concerné.
        </p>
      </div>
      <p className="text-sm text-white/60">
        Les montants sont des plafonds indicatifs. L&apos;organisme doit confirmer ton éligibilité,
        les dépenses prises en charge et les règles de cumul. Aucun financement n&apos;est garanti.
      </p>
      <ul className="space-y-3">
        {aides.map(aide => {
          const url = officialAidUrl(aide.url_officielle)
          const amount = Number(aide.montant_max)
          return (
            <li key={aide.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="font-semibold">{aide.nom}</h3>
              <p className="mt-2 text-sm text-white/60">
                {Number.isFinite(amount) && amount >= 0 ? `Plafond indiqué : ${formatMontant(amount)} EUR` : 'Montant à vérifier auprès de l’organisme'}
              </p>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-violet-300 underline">
                Consulter le site officiel <ExternalLink className="h-4 w-4" />
              </a> : <p className="mt-3 text-sm text-amber-300">Lien officiel indisponible ; vérifie les coordonnées de l&apos;organisme.</p>}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm">
        <ArrowLeft className="h-4 w-4" /> Modifier la sélection
      </button>
    </section>
  )
}
