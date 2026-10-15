import { useCallback, useEffect, useRef, useState } from 'react'
import { readCreateIntent, saveCreateIntent, createFailureNotice, type CreateIntent } from '@/lib/create-intent-client'
import { productionJobId, requestClientJson, waitForProductionStatus } from '@/lib/production-intent-client'

export function useCreateRequest(userId?: string) {
  const [intent, setIntent] = useState<CreateIntent | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noticeError, setNoticeError] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const pending = useRef<CreateIntent | null>(null)
  const active = useRef<{ controller: AbortController; cancel: boolean } | null>(null)

  useEffect(() => {
    pending.current = null
    setIntent(null); setReady(false); setBusy(false); setCancelling(false)
    setMessage(''); setError(null); setNoticeError(null); setVideoId(null)
    if (userId) {
      try {
        const restored = readCreateIntent(userId)
        pending.current = restored; setIntent(restored); setReady(true)
        if (restored) setMessage(restored.cancelRequested
          ? 'Annulation non confirmée. Reprends le suivi ou réessaie la même annulation.'
          : 'Demande retrouvée. Reprends le suivi pour connaître son état serveur.')
      } catch { setError('Reçu local indisponible. Contacte le support avant de relancer une création.') }
    }
    return () => { active.current?.controller.abort(); active.current = null }
  }, [userId])

  const persist = useCallback((next: CreateIntent | null) => {
    if (!userId) throw new Error('Session requise')
    saveCreateIntent(userId, next) // Must succeed before submission/cancellation.
    pending.current = next; setIntent(next)
  }, [userId])

  const run = useCallback(async (receipt: CreateIntent, operation: 'submit' | 'resume' | 'cancel') => {
    if (active.current) return
    const controller = new AbortController()
    active.current = { controller, cancel: operation === 'cancel' }
    const current = () => active.current?.controller === controller && !controller.signal.aborted
    const url = `/api/create/status?${new URLSearchParams({ requestId: receipt.requestId })}`
    setBusy(operation !== 'cancel'); setCancelling(operation === 'cancel'); setError(null); setNoticeError(null)
    setMessage(operation === 'cancel' ? 'Annulation demandée, confirmation serveur en attente.' : 'Suivi de la demande en cours.')
    try {
      if (operation === 'submit' && receipt.cancelRequested) throw new Error('Cancelled intent cannot submit')
      let result = operation === 'submit'
        ? await requestClientJson('/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': receipt.requestId }, body: receipt.body, signal: controller.signal }, 30_000)
        : await requestClientJson(url, { method: operation === 'cancel' ? 'DELETE' : 'GET', signal: controller.signal })
      for (let attempt = 0; ; attempt++) {
        if (!current()) return
        const { body, status, ok } = result
        const jobId = productionJobId(body.jobId)
        if (!ok) setNoticeError(createFailureNotice(status, body) ?? null)
        if (ok && (!jobId || (receipt.jobId && receipt.jobId !== jobId))) throw new Error('Invalid receipt')
        if (ok && body.status === 'cancelled') {
          persist(null); setMessage('Annulation confirmée par le serveur.'); return
        }
        const video = body.video as { id?: unknown } | undefined
        if (ok && (body.status === 'done' || (operation === 'submit' && body.success === true))) {
          const completedId = productionJobId(body.videoId ?? video?.id)
          if (!completedId) throw new Error('Invalid result')
          persist(null); setVideoId(completedId); setMessage('Tâche terminée. Vérifie les médias avant toute utilisation ou publication.'); return
        }
        if (ok && body.status === 'failed') {
          persist(null); setMessage('Échec confirmé par le serveur.'); setError('La création a échoué. Vérifie la bibliothèque avant toute nouvelle demande.'); return
        }
        // Only conclusive pre-submission refusals release a new local intent.
        if (operation === 'submit' && !receipt.jobId && ([400, 401, 402].includes(status) || (status === 403 && body.code === 'SUTRA_GENERATION_FAILED') || body.submissionState === 'not_submitted')) {
          persist(null); setMessage('Demande refusée avant exécution.'); setError('Demande refusée avant exécution. Vérifie la session, les paramètres et la disponibilité du mode choisi.'); return
        }
        if (!ok || !['queued', 'processing'].includes(String(body.status))) throw new Error('Unconfirmed state')
        if (!receipt.jobId) { receipt = { ...receipt, jobId }; persist(receipt) }
        if (receipt.cancelRequested) {
          setMessage('La tâche existe encore sur le serveur. Réessaie la même annulation.'); return
        }
        setMessage(body.status === 'queued' ? 'Tâche en file d’attente sur le serveur.' : 'Tâche en cours sur le serveur.')
        if (attempt >= 119) throw new Error('Tracking expired')
        await waitForProductionStatus(controller.signal)
        result = await requestClientJson(url, { signal: controller.signal })
      }
    } catch {
      if (!current()) return
      setMessage('État non confirmé. La tâche peut continuer sur le serveur.')
      setError('Reprends le suivi ou réessaie la même annulation. Aucune nouvelle création ne sera lancée tant que cet état reste incertain.')
    } finally {
      if (current()) { active.current = null; setBusy(false); setCancelling(false) }
    }
  }, [persist])

  const submit = useCallback(async (body: string) => {
    if (!ready || !userId || pending.current || active.current) return
    try {
      const receipt: CreateIntent = { version: 1, userId, requestId: crypto.randomUUID(), body, cancelRequested: false }
      persist(receipt); setVideoId(null)
      await run(receipt, 'submit')
    } catch { setError('Reçu local indisponible. Aucune nouvelle demande envoyée.') }
  }, [ready, userId, persist, run])

  const cancel = useCallback(async () => {
    if (!pending.current || active.current?.cancel) return
    try {
      const receipt = { ...pending.current, cancelRequested: true }
      persist(receipt)
      active.current?.controller.abort(); active.current = null
      await run(receipt, 'cancel')
    } catch { setError('Impossible de conserver l’intention d’annulation. Son envoi n’est pas confirmé.') }
  }, [persist, run])

  const resume = useCallback(async () => {
    if (pending.current) await run(pending.current, 'resume') // GET only, even after a lost POST acknowledgement.
  }, [run])

  const reset = useCallback(() => {
    if (pending.current || active.current) return
    setVideoId(null); setError(null); setNoticeError(null); setMessage('')
  }, [])

  return { intent, requestLocked: !ready || !!intent, busy, cancelling, message, error, noticeError, videoId, submit, cancel, resume, reset }
}
