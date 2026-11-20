import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { createDurableRequestStore, type DurableRequestState } from '@/lib/durable-request-store'
import { readCreateIntent, saveCreateIntent, createFailureNotice, type CreateIntent } from '@/lib/create-intent-client'
import { productionJobId, requestClientJson, waitForProductionStatus } from '@/lib/production-intent-client'

interface CreateRequestState extends DurableRequestState<CreateIntent> {
  noticeError: string | null
  videoId: string | null
}

export function useCreateRequest(userId?: string) {
  const store = useMemo(() => {
    const initial: CreateRequestState = {
      intent: null, ready: false, busy: false, cancelling: false,
      message: '', error: null, noticeError: null, videoId: null,
    }
    return createDurableRequestStore<CreateRequestState, { controller: AbortController; cancel: boolean }>(initial, () => {
      if (!userId) return initial
      try {
        const restored = readCreateIntent(userId)
        return { ...initial, intent: restored, ready: true, message: restored
          ? restored.cancelRequested
            ? 'Annulation non confirmée. Reprends le suivi ou réessaie la même annulation.'
            : 'Demande retrouvée. Reprends le suivi pour connaître son état serveur.'
          : '' }
      } catch { return { ...initial, error: 'Reçu local indisponible. Contacte le support avant de relancer une création.' } }
    })
  }, [userId])
  const { intent, ready, busy, cancelling, message, error, noticeError, videoId } = useSyncExternalStore(
    store.subscribe, store.getSnapshot, store.getServerSnapshot,
  )

  const persist = useCallback((next: CreateIntent | null) => {
    if (!userId) throw new Error('Session requise')
    saveCreateIntent(userId, next) // Must succeed before submission/cancellation.
    store.set('intent', next)
  }, [userId, store])

  const run = useCallback(async (receipt: CreateIntent, operation: 'submit' | 'resume' | 'cancel') => {
    if (store.getActive()) return
    const controller = new AbortController()
    store.setActive({ controller, cancel: operation === 'cancel' })
    const current = () => store.getActive()?.controller === controller && !controller.signal.aborted
    const url = `/api/create/status?${new URLSearchParams({ requestId: receipt.requestId })}`
    store.set('busy', operation !== 'cancel'); store.set('cancelling', operation === 'cancel'); store.set('error', null); store.set('noticeError', null)
    store.set('message', operation === 'cancel' ? 'Annulation demandée, confirmation serveur en attente.' : 'Suivi de la demande en cours.')
    try {
      if (operation === 'submit' && receipt.cancelRequested) throw new Error('Cancelled intent cannot submit')
      let result = operation === 'submit'
        ? await requestClientJson('/api/create', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': receipt.requestId }, body: receipt.body, signal: controller.signal }, 30_000)
        : await requestClientJson(url, { method: operation === 'cancel' ? 'DELETE' : 'GET', signal: controller.signal })
      for (let attempt = 0; ; attempt++) {
        if (!current()) return
        const { body, status, ok } = result
        const jobId = productionJobId(body.jobId)
        if (!ok) store.set('noticeError', createFailureNotice(status, body) ?? null)
        if (ok && (!jobId || (receipt.jobId && receipt.jobId !== jobId))) throw new Error('Invalid receipt')
        if (ok && body.status === 'cancelled') {
          persist(null); store.set('message', 'Annulation confirmée par le serveur.'); return
        }
        const video = body.video as { id?: unknown } | undefined
        if (ok && (body.status === 'done' || (operation === 'submit' && body.success === true))) {
          const completedId = productionJobId(body.videoId ?? video?.id)
          if (!completedId) throw new Error('Invalid result')
          persist(null); store.set('videoId', completedId); store.set('message', 'Tâche terminée. Vérifie les médias avant toute utilisation ou publication.'); return
        }
        if (ok && body.status === 'failed') {
          persist(null); store.set('message', 'Échec confirmé par le serveur.'); store.set('error', 'La création a échoué. Vérifie la bibliothèque avant toute nouvelle demande.'); return
        }
        // Only conclusive pre-submission refusals release a new local intent.
        if (operation === 'submit' && !receipt.jobId && ([400, 401, 402].includes(status) || (status === 403 && body.code === 'SUTRA_GENERATION_FAILED') || body.submissionState === 'not_submitted')) {
          persist(null); store.set('message', 'Demande refusée avant exécution.'); store.set('error', 'Demande refusée avant exécution. Vérifie la session, les paramètres et la disponibilité du mode choisi.'); return
        }
        if (!ok || !['queued', 'processing'].includes(String(body.status))) throw new Error('Unconfirmed state')
        if (!receipt.jobId) { receipt = { ...receipt, jobId }; persist(receipt) }
        if (receipt.cancelRequested) {
          store.set('message', 'La tâche existe encore sur le serveur. Réessaie la même annulation.'); return
        }
        store.set('message', body.status === 'queued' ? 'Tâche en file d’attente sur le serveur.' : 'Tâche en cours sur le serveur.')
        if (attempt >= 119) throw new Error('Tracking expired')
        await waitForProductionStatus(controller.signal)
        result = await requestClientJson(url, { signal: controller.signal })
      }
    } catch {
      if (!current()) return
      store.set('message', 'État non confirmé. La tâche peut continuer sur le serveur.')
      store.set('error', 'Reprends le suivi ou réessaie la même annulation. Aucune nouvelle création ne sera lancée tant que cet état reste incertain.')
    } finally {
      if (current()) { store.setActive(null); store.set('busy', false); store.set('cancelling', false) }
    }
  }, [persist, store])

  const submit = useCallback(async (body: string) => {
    if (!ready || !userId || store.getSnapshot().intent || store.getActive()) return
    try {
      const receipt: CreateIntent = { version: 1, userId, requestId: crypto.randomUUID(), body, cancelRequested: false }
      persist(receipt); store.set('videoId', null)
      await run(receipt, 'submit')
    } catch { store.set('error', 'Reçu local indisponible. Aucune nouvelle demande envoyée.') }
  }, [ready, userId, persist, run, store])

  const cancel = useCallback(async () => {
    const pending = store.getSnapshot().intent
    if (!pending || store.getActive()?.cancel) return
    try {
      const receipt = { ...pending, cancelRequested: true }
      persist(receipt)
      store.getActive()?.controller.abort(); store.setActive(null)
      await run(receipt, 'cancel')
    } catch { store.set('error', 'Impossible de conserver l’intention d’annulation. Son envoi n’est pas confirmé.') }
  }, [persist, run, store])

  const resume = useCallback(async () => {
    const receipt = store.getSnapshot().intent
    if (receipt) await run(receipt, 'resume') // GET only, even after a lost POST acknowledgement.
  }, [run, store])

  const reset = useCallback(() => {
    if (store.getSnapshot().intent || store.getActive()) return
    store.set('videoId', null); store.set('error', null); store.set('noticeError', null); store.set('message', '')
  }, [store])

  return { intent, requestLocked: !ready || !!intent, busy, cancelling, message, error, noticeError, videoId, submit, cancel, resume, reset }
}
