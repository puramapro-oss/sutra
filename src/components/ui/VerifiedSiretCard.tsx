import { type SiretInfo, formatAddress } from './siret-utils'

export function VerifiedSiretCard({ info, fromCache }: { info: SiretInfo; fromCache: boolean }) {
  const closed = info.etat_administratif === 'F'
  return (
    <div
      data-testid="siret-input-verified"
      className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/90">{info.denomination}</p>
          {info.sigle && (
            <p className="text-xs text-white/50">« {info.sigle} »</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {closed ? (
            <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
              Fermée
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Active
            </span>
          )}
          {info.est_siege && (
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
              Siège
            </span>
          )}
        </div>
      </div>

      <dl className="space-y-1 text-xs text-white/60">
        {formatAddress(info.adresse) && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-white/40">Adresse :</dt>
            <dd>{formatAddress(info.adresse)}</dd>
          </div>
        )}
        {info.activite_principale.libelle && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-white/40">Activité :</dt>
            <dd>
              {info.activite_principale.libelle}
              {info.activite_principale.code && (
                <span className="ml-1 font-mono text-[10px] text-white/40">
                  ({info.activite_principale.code})
                </span>
              )}
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="shrink-0 text-white/40">SIREN :</dt>
          <dd className="font-mono text-[11px]">{info.siren}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] text-white/30">
        Source INSEE Sirene · {fromCache ? 'données en cache' : 'données temps réel'}
      </p>
    </div>
  )
}
