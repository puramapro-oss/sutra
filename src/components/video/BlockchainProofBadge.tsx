'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, Loader2, Download, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// <BlockchainProofBadge /> — Preuve blockchain Purama (OpenTimestamps).
// Terme UI : « Preuve blockchain Purama » (jamais « OpenTimestamps » ni « Bitcoin »).
// Usage :
//   <BlockchainProofBadge videoId={video.id} />
// Placé sur : carte vidéo dashboard, page lecture, export social.
// ---------------------------------------------------------------------------

type ProofStatus = 'pending' | 'verified' | 'failed' | 'sha_mismatch'

type ProofPayload = {
  videoId: string
  proofId: string
  sha256: string
  blockchain: string
  status: ProofStatus
  message?: string
  storagePublicUrl: string | null
  bitcoinBlockHeight?: number
  bitcoinTimestamp?: string
  createdAt: string
  upgradedAt: string | null
  verifiedAt: string | null
}

export function BlockchainProofBadge({ videoId }: { videoId: string }) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'none' }
    | { kind: 'ready'; proof: ProofPayload }
    | { kind: 'error'; message: string }
  >({ kind: 'loading' })
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/verify/${videoId}`)
        if (res.status === 404) {
          if (!cancelled) setState({ kind: 'none' })
          return
        }
        const json = (await res.json()) as ProofPayload | { error?: string; detail?: string }
        if (!cancelled) {
          if ('error' in json && json.error) {
            setState({ kind: 'error', message: json.detail ?? json.error })
          } else {
            setState({ kind: 'ready', proof: json as ProofPayload })
          }
        }
      } catch (err) {
        if (!cancelled)
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'fetch error',
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [videoId])

  if (state.kind === 'loading') {
    return (
      <span
        data-testid="blockchain-proof-loading"
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/50"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Preuve…
      </span>
    )
  }

  if (state.kind === 'none') return null // pas encore stampé (vidéo très récente ou skipped)

  if (state.kind === 'error') {
    return (
      <span
        data-testid="blockchain-proof-error"
        title={state.message}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-xs text-white/40"
      >
        <ShieldAlert className="h-3 w-3" />
        Preuve indisponible
      </span>
    )
  }

  const { proof } = state
  const isVerified = proof.status === 'verified'

  return (
    <>
      <button
        type="button"
        data-testid={isVerified ? 'blockchain-proof-verified' : 'blockchain-proof-pending'}
        onClick={() => setModalOpen(true)}
        className={
          isVerified
            ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15'
            : 'inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/15'
        }
      >
        {isVerified ? (
          <>
            <ShieldCheck className="h-3 w-3" />
            Preuve blockchain Purama
          </>
        ) : (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Ancrage en cours
          </>
        )}
      </button>

      {modalOpen && (
        <div
          data-testid="blockchain-proof-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0A0A0F] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white/80"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex items-center gap-2">
              {isVerified ? (
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
              )}
              <h3 className="text-lg font-semibold text-white">
                {isVerified
                  ? 'Preuve blockchain confirmée'
                  : 'Ancrage blockchain en cours'}
              </h3>
            </div>

            <p className="mb-4 text-sm text-white/60">{proof.message ?? ''}</p>

            <dl className="space-y-2 text-xs">
              <InfoRow label="SHA-256 du contenu" value={proof.sha256} mono />
              {isVerified && proof.bitcoinBlockHeight && (
                <InfoRow
                  label="Bloc Bitcoin"
                  value={`#${proof.bitcoinBlockHeight.toLocaleString('fr-FR')}`}
                  mono
                />
              )}
              {isVerified && proof.bitcoinTimestamp && (
                <InfoRow
                  label="Horodatage"
                  value={new Date(proof.bitcoinTimestamp).toLocaleString('fr-FR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                />
              )}
              <InfoRow
                label="Générée le"
                value={new Date(proof.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
            </dl>

            {proof.storagePublicUrl && (
              <a
                href={proof.storagePublicUrl}
                download
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/80 transition hover:bg-white/[0.06]"
              >
                <Download className="h-3 w-3" />
                Télécharger la preuve .ots
              </a>
            )}

            <p className="mt-5 text-[11px] leading-relaxed text-white/40">
              Cette preuve garantit que le contenu exact de cette vidéo existait
              {isVerified ? ' au moment précis indiqué' : ' dès sa génération'}.
              La vérification est publique&nbsp;: toute personne peut consulter
              <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-[10px]">
                /api/verify/{proof.videoId}
              </code>
              sans authentification.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-white/40">{label}</dt>
      <dd
        className={
          mono
            ? 'break-all text-right font-mono text-[11px] text-white/80'
            : 'break-all text-right text-white/80'
        }
      >
        {value}
      </dd>
    </div>
  )
}
