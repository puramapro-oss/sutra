'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const workerStates = ['disabled', 'unavailable', 'unknown', 'cold', 'ready', 'busy', 'interrupted', 'incompatible'] as const
type WorkerState = typeof workerStates[number]
type PublicCapabilities = { allowed: boolean; state: WorkerState; estimatedComputeUsd: number | null }
const workerLabels: Record<WorkerState, string> = {
  disabled: 'Worker distant désactivé. Le responsable SUTRA doit activer et qualifier le service avant une demande.',
  unavailable: 'Worker distant indisponible. Demande au responsable SUTRA de vérifier le service avant de lancer.',
  unknown: 'État du worker distant inconnu. Attends sa vérification avant de lancer.',
  cold: 'Worker distant en préparation. Aucun délai de démarrage garanti ; attends sa disponibilité avant de lancer.',
  ready: 'Worker distant déclaré prêt lors de cette vérification. Cet état ne réserve pas de ressources et ne garantit pas chaque format.',
  busy: 'Worker distant occupé. Attends la fin du travail en cours avant une nouvelle demande.',
  interrupted: 'Worker distant interrompu. Vérifie la bibliothèque et contacte le responsable avant de relancer.',
  incompatible: 'Worker distant incompatible avec les capacités attendues. Le responsable SUTRA doit vérifier sa qualification.',
}

/** Consume only T04's public v1 DTO; never import the private worker manifest. */
function parsePublicCapabilities(value: unknown): PublicCapabilities | null {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return null
  if (!('personal' in value) || !value.personal || typeof value.personal !== 'object') return null
  if (!('client' in value) || !value.client || typeof value.client !== 'object') return null
  const personal = value.personal as Record<string, unknown>
  const client = value.client as Record<string, unknown>
  if (client.mode !== 'api' || client.availability !== 'unknown' || client.reason !== 'PROVIDER_NOT_PROBED') return null
  if (personal.provider !== 'salad' || typeof personal.allowed !== 'boolean' || typeof personal.available !== 'boolean') return null
  if (!workerStates.includes(personal.state as WorkerState)) return null
  if (personal.available !== (personal.allowed && personal.state === 'ready')) return null
  if (!personal.allowed && personal.state !== 'unavailable') return null
  if (personal.reason !== null && typeof personal.reason !== 'string') return null
  if (!Array.isArray(personal.operations) || !Array.isArray(personal.profiles) || personal.quotaRemaining !== null) return null
  if (!personal.cost || typeof personal.cost !== 'object') return null
  const cost = personal.cost as Record<string, unknown>
  if (cost.currency !== 'USD' || cost.actualUsd !== null || cost.basis !== 'compute-only-excludes-idle-storage-network') return null
  if (cost.estimatedComputeUsd !== null && (typeof cost.estimatedComputeUsd !== 'number' || !Number.isFinite(cost.estimatedComputeUsd) || cost.estimatedComputeUsd < 0)) return null
  return { allowed: personal.allowed, state: personal.state as WorkerState, estimatedComputeUsd: cost.estimatedComputeUsd as number | null }
}

async function fetchPublicCapabilities(): Promise<PublicCapabilities | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch('/api/video/capabilities', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
    return response.ok ? parsePublicCapabilities(await response.json()) : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Informational only: identity, routing and enforcement remain server-owned. */
export function ExecutionModeNotice({ isGenerating = false }: { isGenerating?: boolean }) {
  const [capabilities, setCapabilities] = useState<PublicCapabilities | null | undefined>(undefined)
  const request = useRef<Promise<PublicCapabilities | null> | null>(null)
  useEffect(() => {
    let active = true
    // Share the request across Strict Mode's effect replay; never poll or retry.
    request.current ??= fetchPublicCapabilities()
    void request.current.then(result => { if (active) setCapabilities(result) })
    return () => { active = false }
  }, [])

  const estimate = capabilities?.allowed ? capabilities.estimatedComputeUsd : null
  const availability = capabilities === undefined
    ? 'Vérification de la disponibilité du mode personnel distant…'
    : capabilities === null
      ? 'Mode personnel distant : disponibilité non vérifiée sur cet écran.'
      : capabilities.allowed
        ? workerLabels[capabilities.state]
        : 'Compte en mode API client. Le mode personnel distant est réservé au propriétaire autorisé.'

  return (
    <aside aria-label="Modes de génération" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/75 space-y-3">
      <h2 className="font-semibold text-white">Avant de générer</h2>
      <p>Le mode autorisé dépend de ton compte. Les options de création ne changent pas ce mode.</p>
      <p role="status" className="text-amber-200">{availability}</p>
      <details>
        <summary className="cursor-pointer rounded-md py-2 font-medium text-violet-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
          Modes, coûts et disponibilité
        </summary>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="font-medium text-white">API client</dt>
            <dd>Services externes soumis au plan, aux crédits et aux limites du compte. Choisir un moteur ne garantit ni sa disponibilité ni un coût nul.</dd>
          </div>
          <div>
            <dt className="font-medium text-white">Personnel open source distant</dt>
            <dd>Réservé au compte propriétaire autorisé. La génération vidéo utilise un GPU distant ; elle ne tourne pas sur ton Mac. Le script, la voix, la musique et l’assemblage peuvent encore utiliser des API payantes. Open source ne signifie pas hébergement gratuit.</dd>
          </div>
        </dl>
        <p className="mt-3">Si le worker distant est désactivé ou indisponible, le mode personnel reste bloqué, sans bascule automatique vers une API payante.</p>
        <p className="mt-3">{estimate == null
          ? 'Aucun budget chiffré ni délai garanti n’est disponible ici.'
          : `Estimation de calcul fournie par le service : ${estimate.toLocaleString('fr-FR', { maximumSignificantDigits: 6 })} USD. Le coût réel est inconnu ; attente, stockage et réseau sont exclus. Ce montant n’est pas le prix total d’une vidéo.`} Vérifie tes crédits et le budget du service choisi avant de lancer. L’attente dépend de la file et des ressources disponibles, sans délai garanti.</p>
        <p className="mt-3">La disponibilité des fournisseurs API client n’a pas été vérifiée par cet encart. Les quotas restants du worker distant ne sont pas connus.</p>
      </details>
      {isGenerating && (
        <p role="status" className="text-violet-200">Demande en cours. Le délai peut varier ; attends son résultat avant de relancer.</p>
      )}
    </aside>
  )
}

export function OutputQualityNotice() {
  return <p className="mt-2 text-xs text-white/70">Résolution de sortie demandée : une sortie 4K ne garantit pas une génération native 4K.</p>
}

export function GenerationErrorNotice({ error }: { error: string }) {
  const workerUnavailable = /SUTRA_LOCAL_|SALAD_|moteur local|worker.*(?:indisponible|unavailable|disabled)/i.test(error)
  const quotaExceeded = /quota|cr[eé]dits?|limite.*atteinte|budget/i.test(error)
  const unsupportedProfile = /SALAD_UNSUPPORTED_(?:PROFILE|OPERATION)/.test(error)

  return (
    <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 space-y-2 break-words">
      <p className="font-semibold">{quotaExceeded ? 'Limite du compte ou budget atteint' : unsupportedProfile ? 'Format non pris en charge par le mode personnel' : workerUnavailable ? 'Mode personnel distant indisponible' : 'Résultat de la génération non confirmé'}</p>
      <p>{quotaExceeded
        ? 'Vérifie les crédits, les quotas et le budget autorisé de ton compte avant une nouvelle demande.'
        : unsupportedProfile
          ? 'La qualité, le format, la durée ou l’opération demandée ne sont pas qualifiés pour ce worker. Demande au responsable SUTRA les capacités prises en charge avant de modifier ta demande. Une sortie 4K ne prouve pas une génération native 4K.'
          : workerUnavailable
            ? 'Le worker distant n’a pas confirmé le résultat. Demande au responsable SUTRA de vérifier sa configuration et sa disponibilité. Aucun repli payant automatique n’est autorisé pour ce mode.'
            : 'Une erreur ou une interruption a empêché de confirmer le résultat. La demande peut déjà avoir été prise en compte.'}</p>
      <p>Vérifie la bibliothèque avant de relancer pour éviter une seconde demande. Si le résultat reste incertain, contacte le support.</p>
      <Link href="/library" className="inline-block rounded-md py-2 font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-200">Vérifier la bibliothèque</Link>
    </div>
  )
}
