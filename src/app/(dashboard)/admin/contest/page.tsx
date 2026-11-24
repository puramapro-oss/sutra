import { AlertTriangle } from 'lucide-react'

export default function AdminContestPage() {
  return (
    <div className="space-y-6" data-testid="admin-contest-page">
      <h2 className="text-xl font-bold text-white">Gestion des concours</h2>
      <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6" data-testid="admin-contest-unavailable">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold text-amber-400">Administration des concours indisponible</h3>
        </div>
        <p className="text-sm text-white/70">
          Les concours et leurs résultats ne peuvent pas être vérifiés depuis cet écran.
          Les tirages, évaluations et confirmations de gagnants sont indisponibles ici.
        </p>
        <p className="mt-3 text-sm text-white/50">
          Cette indisponibilité ne signifie pas qu&apos;aucun concours ni résultat n&apos;existe.
        </p>
      </div>
    </div>
  )
}
