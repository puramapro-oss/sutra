import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { PublicationSnapshot } from './publication-intent'
import type { PublishResultUI } from './PublishResultsSection'
import { mergeReconciliationResults, normalizePublicationResults } from './publication-results'

interface ReconciliationOptions {
  snapshot: PublicationSnapshot | null
  results: PublishResultUI[] | null
  setResults: Dispatch<SetStateAction<PublishResultUI[] | null>>
  submittingRef: RefObject<boolean>
  requestRef: RefObject<AbortController | null>
  versionRef: RefObject<number>
}

export function usePublicationReconciliation({ snapshot, results, setResults, submittingRef, requestRef, versionRef }: ReconciliationOptions) {
  const [verifying, setVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const canVerify = !!snapshot && !!results?.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown'))

  const verify = async () => {
    if (submittingRef.current || !canVerify || !snapshot) return
    const controller = new AbortController()
    submittingRef.current = true
    requestRef.current = controller
    versionRef.current++
    const current = () => requestRef.current === controller
    const timeout = setTimeout(() => controller.abort(), 30_000)
    setVerifying(true)
    setVerificationError(null)
    try {
      const response = await fetch('/api/social/publish', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...snapshot.payload, reconcileOnly: true }), signal: controller.signal,
      })
      if (!response.ok) throw new Error('reconciliation_unavailable')
      const data = await response.json()
      if (!current()) return
      controller.signal.throwIfAborted()
      if (!Array.isArray(data.results) || !data.results.length) throw new Error('reconciliation_unavailable')
      const observed = normalizePublicationResults(data.results, snapshot.accounts)
      setResults(previous => mergeReconciliationResults(previous, observed))
    } catch {
      if (current()) setVerificationError('La vérification n’a pas abouti. Les derniers résultats sont conservés. Tu peux vérifier de nouveau ; aucun nouvel envoi n’est lancé par ce contrôle.')
    } finally {
      clearTimeout(timeout)
      if (current()) { requestRef.current = null; submittingRef.current = false; setVerifying(false) }
    }
  }

  return { canVerify, verifying, verificationError, verify }
}
