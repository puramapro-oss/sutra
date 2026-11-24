import { useCallback, useMemo, useEffect, useSyncExternalStore } from 'react'
import { createDurableRequestStore, type DurableRequestState } from '@/lib/durable-request-store'
import { STEPS } from '@/lib/production-constants'
import { productionSchema } from '@/lib/production-schema'
import { readProductionIntent, saveProductionIntent, requestClientJson, productionJobId, waitForProductionStatus, type ProductionIntent, type DurableStep } from '@/lib/production-intent-client'
import type { ProductionStep, TemplateId, StepStatus } from '@/types/production'
import type { VideoEngine } from '@/lib/ltx'

interface UseProductionGenerationProps {
  userId?: string
  onRestore: (body: string, step: DurableStep) => void
  idea: string
  template: TemplateId
  format: string
  engine: VideoEngine
  voice: string
  musicStyle: string
  tone: string
  currentStep: number
  setCurrentStep: (step: number | ((prev: number) => number)) => void
}
const initialStatus: Record<ProductionStep, StepStatus> = {
  idea: 'pending', script: 'pending', video: 'pending', voice: 'pending',
  music: 'pending', assembly: 'pending', thumbnail: 'pending',
}

interface ProductionRequestState extends DurableRequestState<ProductionIntent> {
  stepStatus: Record<ProductionStep, StepStatus>
  generatedData: Record<string, unknown>
  restored: ProductionIntent | null
}

export function useProductionGeneration({ userId, onRestore, idea, template, format, engine, voice, musicStyle, tone, currentStep, setCurrentStep }: UseProductionGenerationProps) {
  const store = useMemo(() => {
    const initial: ProductionRequestState = {
      intent: null, restored: null, ready: false, busy: false, cancelling: false,
      message: '', error: null, generatedData: {}, stepStatus: initialStatus,
    }
    return createDurableRequestStore<ProductionRequestState, { controller: AbortController; kind: 'run' | 'cancel' }>(initial, () => {
      if (!userId) return initial
      try {
        const restored = readProductionIntent(userId)
        const previous = restored ? JSON.parse(restored.body).previousData : undefined
        const generatedData = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {}
        const stepStatus = Object.fromEntries(Object.keys(initialStatus).map(key => [key, generatedData[key] !== undefined ? 'done' : 'pending'])) as typeof initialStatus
        return { ...initial, intent: restored, restored, ready: true, generatedData, stepStatus,
          message: restored
            ? restored.cancelRequested ? 'Annulation non confirmée. Reprends le suivi ou réessaie la même annulation.' : 'Demande retrouvée. Reprends le suivi pour connaître son état serveur.'
            : '' }
      } catch { return { ...initial, error: 'Reçu local indisponible. Contacte le support avant de relancer une production.' } }
    })
  }, [userId])
  const { stepStatus, generatedData, error, busy: isGenerating, cancelling: isCancelling, intent, message, ready, restored } = useSyncExternalStore(
    store.subscribe, store.getSnapshot, store.getServerSnapshot,
  )
  useEffect(() => { if (restored) onRestore(restored.body, restored.step) }, [restored, onRestore])

  const persist = useCallback((next: ProductionIntent | null) => {
    if (!userId) throw new Error('Session requise')
    saveProductionIntent(userId, next) // Must succeed BEFORE a new submission or cancellation.
    store.set('intent', next)
    store.set('restored', null) // A progressed/completed receipt must not restore an obsolete form.
  }, [userId, store])

  const mark = useCallback((step: string, status: StepStatus) => {
    store.set('stepStatus', prev => step === 'all'
      ? Object.fromEntries(Object.keys(prev).map(key => [key, status])) as typeof prev
      : { ...prev, [step]: status })
  }, [store])

  const run = useCallback(async (request: ProductionIntent, resume = false) => {
    if (store.getActive()) return
    const controller = new AbortController()
    store.setActive({ controller, kind: 'run' })
    const current = () => store.getActive()?.controller === controller && !controller.signal.aborted
    store.set('busy', true); store.set('error', null); mark(request.step, 'generating')
    store.set('message', 'Demande en cours. Son identifiant est conservé pour la reprise.')
    try {
      let receipt = request
      let submitted = false
      let result
      if (receipt.jobId) {
        result = await requestClientJson(`/api/video/status/${receipt.jobId}`, { signal: controller.signal })
      } else if (resume || receipt.cancelRequested) {
        const query = new URLSearchParams({ requestId: receipt.requestId, targetStep: receipt.step })
        result = await requestClientJson(`/api/production?${query}`, { signal: controller.signal })
        if (!current()) return
        if (result.ok) {
          const jobId = productionJobId(result.body.jobId)
          if (!jobId) throw new Error('Reçu invalide')
          receipt = { ...receipt, jobId }; persist(receipt)
        } else if (result.status !== 404 || receipt.cancelRequested) {
          // 404 never proves cancellation; the original POST may still arrive.
          throw new Error('État non confirmé')
        }
      }
      if (!result || (result.status === 404 && !receipt.cancelRequested && !receipt.jobId)) {
        // Explicit resume may retry an absent original intent with identical identity/body.
        // A cancellation intent can NEVER enter this submission branch.
        if (receipt.cancelRequested) throw new Error('Annulation en attente')
        submitted = true
        result = await requestClientJson('/api/production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: receipt.body, signal: controller.signal }, 30_000)
      }
      for (let attempt = 0; ; attempt++) {
        if (!current()) return
        const { body, status, ok } = result
        if (ok && receipt.jobId && productionJobId(body.jobId) !== receipt.jobId) throw new Error('Reçu invalide')
        if (body.status === 'cancelled' && (ok || status === 409)) {
          persist(null); mark(receipt.step, 'pending'); store.set('message', 'Annulation confirmée par le serveur.'); return
        }
        if (ok && status !== 202 && (!receipt.jobId || body.status === 'done') && body.data !== undefined) {
          if (receipt.step === 'all' && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))) throw new Error('Résultat invalide')
          persist(null)
          store.set('generatedData', prev => receipt.step === 'all' ? body.data as Record<string, unknown> : { ...prev, [receipt.step]: body.data })
          mark(receipt.step, 'done'); store.set('message', 'Tâche terminée. Vérifie les médias avant toute utilisation ou publication.')
          if (!resume) setCurrentStep(prev => prev === currentStep ? (receipt.step === 'all' ? STEPS.length - 1 : Math.min(prev + 1, STEPS.length - 1)) : prev)
          return
        }
        // Only conclusive pre-submission refusals release the local intent.
        if (submitted && !receipt.jobId && ((status === 400) || body.error === 'SUTRA_QUOTA_EXHAUSTED' || body.code === 'SALAD_UNAVAILABLE')) {
          persist(null); mark(receipt.step, 'error'); store.set('message', 'Demande refusée avant exécution.')
          store.set('error', body.error === 'SUTRA_QUOTA_EXHAUSTED' ? 'Crédits ou quota insuffisants.' : body.code === 'SALAD_UNAVAILABLE' ? 'GPU distant indisponible. Aucun repli API payant.' : 'Demande invalide. Vérifie les paramètres.'); return
        }
        if (!ok || !['queued', 'processing'].includes(String(body.status))) throw new Error('État non confirmé')
        const jobId = productionJobId(body.jobId)
        if (!jobId || (receipt.jobId && receipt.jobId !== jobId)) throw new Error('Reçu invalide')
        if (!receipt.jobId) { receipt = { ...receipt, jobId }; persist(receipt) }
        store.set('message', body.status === 'queued' ? 'Tâche en file d’attente sur le serveur.' : 'Tâche en cours sur le serveur.')
        if (attempt >= 119) throw new Error('Suivi expiré')
        await waitForProductionStatus(controller.signal)
        result = await requestClientJson(`/api/video/status/${jobId}`, { signal: controller.signal })
      }
    } catch {
      if (!current()) return
      mark(request.step, 'error')
      store.set('message', 'État non confirmé. La tâche peut continuer sur le serveur.')
      store.set('error', 'Le suivi a été interrompu ou le serveur demande une réconciliation. Reprends la même demande ou annule-la ; aucune nouvelle production ne sera lancée ici tant que son état reste incertain.')
    } finally {
      if (current()) { store.setActive(null); store.set('busy', false) }
    }
  }, [persist, mark, currentStep, setCurrentStep, store])

  const start = useCallback(async (step: ProductionStep | 'all') => {
    if (store.getActive() || store.getSnapshot().intent || !ready || !userId || step === 'idea') return
    store.set('error', null)
    const content = { step, idea, template, format, engine, voice, musicStyle, tone, ...(step !== 'all' ? { previousData: generatedData } : {}) }
    if (!productionSchema.safeParse(content).success) { store.set('error', 'Demande invalide. Vérifie les paramètres.'); return }
    if (step === 'thumbnail') {
      // Existing non-durable URL preparation; never pretend it supports cancellation.
      const controller = new AbortController(); store.setActive({ controller, kind: 'run' }); store.set('busy', true)
      try {
        const result = await requestClientJson('/api/production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content), signal: controller.signal })
        if (controller.signal.aborted) return
        if (!result.ok || result.body.data === undefined) throw new Error('Miniature indisponible')
        store.set('generatedData', prev => ({ ...prev, thumbnail: result.body.data })); mark(step, 'done')
      } catch { if (!controller.signal.aborted) { mark(step, 'error'); store.set('error', 'Préparation de la miniature indisponible. Réessaie.') } }
      finally { if (store.getActive()?.controller === controller) { store.setActive(null); store.set('busy', false) } }
      return
    }
    try {
      const requestId = crypto.randomUUID()
      const next: ProductionIntent = { version: 1, userId, requestId, step, body: JSON.stringify({ ...content, requestId }), cancelRequested: false }
      persist(next)
      await run(next)
    } catch { store.set('error', 'Impossible de conserver le reçu dans cet onglet. Aucune nouvelle demande envoyée.') }
  }, [idea, template, format, engine, voice, musicStyle, tone, generatedData, ready, userId, persist, run, mark, store])

  const cancel = useCallback(async () => {
    const request = store.getSnapshot().intent
    if (!request || store.getActive()?.kind === 'cancel') return
    try { persist({ ...request, cancelRequested: true }) }
    catch { store.set('error', 'Impossible de conserver l’intention d’annulation. Aucune annulation envoyée.'); return }
    store.getActive()?.controller.abort()
    const controller = new AbortController(); store.setActive({ controller, kind: 'cancel' })
    store.set('busy', false); store.set('cancelling', true); store.set('error', null)
    store.set('message', 'Annulation demandée. En attente de confirmation serveur…')
    try {
      const result = await requestClientJson('/api/production', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'cancel', targetStep: request.step, requestId: request.requestId, idea: JSON.parse(request.body).idea }) })
      if (controller.signal.aborted) return
      const data = result.body.data as { cancelled?: unknown } | undefined
      if (!result.ok || data?.cancelled !== true) throw new Error('Non confirmée')
      persist(null); mark(request.step, 'pending'); store.set('message', 'Annulation confirmée par le serveur.')
    } catch {
      if (controller.signal.aborted) return
      mark(request.step, 'error'); store.set('message', 'Annulation non confirmée.')
      store.set('error', 'La tâche peut être encore active ou déjà terminée. Reprends le suivi avec sa référence ou réessaie la même annulation.')
    } finally {
      if (store.getActive()?.controller === controller) { store.setActive(null); store.set('cancelling', false) }
    }
  }, [persist, mark, store])

  return {
    stepStatus, generatedData, error, isGenerating, isCancelling, intent, message,
    requestLocked: !ready || !!intent,
    generateStep: (step: ProductionStep) => start(step), generateAll: () => start('all'), cancel,
    resume: () => { const receipt = store.getSnapshot().intent; if (receipt) void run(receipt, true) },
  }
}
