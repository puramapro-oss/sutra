import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { SocialAccount } from '@/components/settings/social/accounts'
import type { PublicationSnapshot } from './publication-intent'
import type { PublishResultUI } from './PublishResultsSection'
import { mergeReconciliationResults, normalizePublicationResults, readDurablePublicationReceipt } from './publication-results'

interface ReconciliationOptions {
  videoId: string
  isOpen: boolean
  accounts: SocialAccount[]
  snapshot: PublicationSnapshot | null
  setSnapshot: Dispatch<SetStateAction<PublicationSnapshot | null>>
  results: PublishResultUI[] | null
  setResults: Dispatch<SetStateAction<PublishResultUI[] | null>>
  submittingRef: RefObject<boolean>
  requestRef: RefObject<AbortController | null>
  versionRef: RefObject<number>
}

const POLL_INTERVAL_MS = 5_000
const MAX_AUTOMATIC_READS = 60

export function usePublicationReconciliation({ videoId, isOpen, accounts, snapshot, setSnapshot, results, setResults,
  submittingRef, requestRef, versionRef }: ReconciliationOptions) {
  const [verifying, setVerifying] = useState(false)
  const [readingJournal, setReadingJournal] = useState(false)
  const [historyState, setHistoryState] = useState<'unchecked' | 'absent' | 'found' | 'unavailable'>('unchecked')
  const [pollingPaused, setPollingPaused] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const latest = useRef({ snapshot, accounts, results, isOpen })
  const journalRequest = useRef<AbortController | null>(null)
  const automaticReads = useRef(0)
  useEffect(() => { latest.current = { snapshot, accounts, results, isOpen } }, [snapshot, accounts, results, isOpen])

  // Closing/hiding only cancels a local journal read. It never cancels an admitted batch.
  const cancelJournalRead = useCallback(() => {
    const controller = journalRequest.current
    if (!controller || requestRef.current !== controller) return false
    versionRef.current++
    controller.abort()
    requestRef.current = null
    journalRequest.current = null
    submittingRef.current = false
    setVerifying(false)
    setReadingJournal(false)
    return true
  }, [requestRef, submittingRef, versionRef])

  const read = useCallback(async ({ legacy = false, allowLegacyFallback = false } = {}) => {
    const previous = latest.current.snapshot
    if (submittingRef.current || !latest.current.isOpen || document.visibilityState === 'hidden'
      || (legacy && !previous?.payload)) return
    const controller = new AbortController()
    submittingRef.current = true
    requestRef.current = controller
    journalRequest.current = legacy ? null : controller
    versionRef.current++
    const current = () => requestRef.current === controller
    let timeout = setTimeout(() => controller.abort(), legacy ? 30_000 : 8_000)
    setVerifying(true)
    setReadingJournal(!legacy)
    setVerificationError(null)
    try {
      const legacyRead = () => fetch('/api/social/publish', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...previous!.payload, reconcileOnly: true }), signal: controller.signal,
      })
      let response = legacy ? await legacyRead() : await fetch(`/api/social/publish?videoId=${encodeURIComponent(videoId)}`, {
        method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal,
      })
      if (!current()) return
      controller.signal.throwIfAborted()
      if (!legacy && response.status === 404) {
        // Only an explicit check of an unconfirmed legacy intent may fall back.
        // Restoration and polling never issue POST, and durable receipts never do.
        if (allowLegacyFallback && previous?.payload && previous.durable !== true) {
          legacy = true
          journalRequest.current = null
          setReadingJournal(false)
          clearTimeout(timeout)
          timeout = setTimeout(() => controller.abort(), 30_000)
          response = await legacyRead()
        } else if (previous?.durable !== true) {
          setHistoryState('absent')
          return
        } else throw new Error('publication_journal_missing')
      }
      if (!response.ok) throw new Error('reconciliation_unavailable')
      const data = await response.json()
      if (!current()) return
      controller.signal.throwIfAborted()
      if (legacy) {
        if (!Array.isArray(data.results) || !data.results.length || !previous) throw new Error('reconciliation_unavailable')
        const observed = normalizePublicationResults(data.results, previous.accounts)
        setResults(old => mergeReconciliationResults(old, observed))
      } else {
        const receipt = readDurablePublicationReceipt(data, videoId, latest.current.accounts, previous)
        latest.current = { ...latest.current, snapshot: receipt.snapshot }
        setSnapshot(receipt.snapshot)
        setResults(old => mergeReconciliationResults(old, receipt.results).map(result => ({ ...result, retryEligible: false })))
        setHistoryState('found')
      }
    } catch {
      if (current()) {
        if (!legacy) setHistoryState('unavailable')
        setVerificationError('La vérification n’a pas abouti. Les derniers résultats sont conservés. Tu peux vérifier de nouveau ; aucun nouvel envoi n’est lancé par ce contrôle.')
      }
    } finally {
      clearTimeout(timeout)
      if (current()) {
        requestRef.current = null; journalRequest.current = null; submittingRef.current = false
        setVerifying(false); setReadingJournal(false)
      }
    }
  }, [videoId, requestRef, submittingRef, versionRef, setSnapshot, setResults])

  useEffect(() => {
    if (!isOpen) return
    let stopped = false, epoch = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    automaticReads.current = 0
    const tick = async (restore = false) => {
      const currentEpoch = epoch
      if (stopped || document.visibilityState === 'hidden') return
      const state = latest.current
      const pending = state.snapshot?.durable === true && (state.snapshot.hasPending
        || state.results?.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown')))
      if (!submittingRef.current && (restore || pending)) {
        if (automaticReads.current < MAX_AUTOMATIC_READS) {
          automaticReads.current++
          await read()
        } else setPollingPaused(true)
      }
      if (!stopped && epoch === currentEpoch && document.visibilityState !== 'hidden') {
        clearTimeout(timer)
        timer = setTimeout(() => { void tick() }, POLL_INTERVAL_MS)
      }
    }
    const visibility = () => {
      epoch++
      clearTimeout(timer)
      if (document.visibilityState === 'hidden') cancelJournalRead()
      else void tick(true)
    }
    document.addEventListener('visibilitychange', visibility)
    void tick(true)
    return () => {
      stopped = true; epoch++; clearTimeout(timer)
      document.removeEventListener('visibilitychange', visibility)
      cancelJournalRead()
    }
  }, [isOpen, read, cancelJournalRead, submittingRef])

  const canVerify = !!verificationError || !!snapshot && (snapshot.durable === true
    ? !!snapshot.hasPending || !!results?.some(result => result.status !== 'published')
    : !!results?.some(result => ['unknown', 'publishing', 'scheduled'].includes(result.status ?? 'unknown')))
  const resetPolling = () => {
    automaticReads.current = 0
    setPollingPaused(false)
  }
  const verify = async () => {
    if (!canVerify) return
    resetPolling()
    await read({ legacy: snapshot?.durable === false && !!snapshot.payload, allowLegacyFallback: snapshot?.durable === undefined })
  }

  return { canVerify, verifying, readingJournal, verificationError, verify, cancelJournalRead,
    canPrepare: historyState === 'absent' || historyState === 'found', pollingPaused, resetPolling }
}
