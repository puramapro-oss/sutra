import { useState, useCallback, useRef, useEffect } from 'react'
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

export function useProductionGeneration({ userId, onRestore, idea, template, format, engine, voice, musicStyle, tone, currentStep, setCurrentStep }: UseProductionGenerationProps) {
  const [stepStatus, setStepStatus] = useState(initialStatus)
  const [generatedData, setGeneratedData] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [intent, setIntent] = useState<ProductionIntent | null>(null)
  const [message, setMessage] = useState('')
  const [ready, setReady] = useState(false)
  const pending = useRef<ProductionIntent | null>(null)
  const active = useRef<{ controller: AbortController; kind: 'run' | 'cancel' } | null>(null)

  useEffect(() => {
    pending.current = null
    setIntent(null); setReady(false); setError(null); setMessage('')
    setIsGenerating(false); setIsCancelling(false)
    setGeneratedData({}); setStepStatus(initialStatus)
    if (userId) {
      try {
        const restored = readProductionIntent(userId)
        pending.current = restored; setIntent(restored); setReady(true)
        if (restored) {
          const previous = JSON.parse(restored.body).previousData
          if (previous && typeof previous === 'object' && !Array.isArray(previous)) {
            setGeneratedData(previous)
            setStepStatus(Object.fromEntries(Object.keys(initialStatus).map(key => [key, previous[key] !== undefined ? 'done' : 'pending'])) as typeof initialStatus)
          }
          onRestore(restored.body, restored.step)
          setMessage(restored.cancelRequested ? 'Annulation non confirmée. Reprends le suivi ou réessaie la même annulation.' : 'Demande retrouvée. Reprends le suivi pour connaître son état serveur.')
        }
      } catch { setError('Reçu local indisponible. Contacte le support avant de relancer une production.') }
    }
    return () => { active.current?.controller.abort(); active.current = null }
  }, [userId, onRestore])

  const persist = useCallback((next: ProductionIntent | null) => {
    if (!userId) throw new Error('Session requise')
    saveProductionIntent(userId, next) // Must succeed BEFORE a new submission or cancellation.
    pending.current = next; setIntent(next)
  }, [userId])

  const mark = useCallback((step: string, status: StepStatus) => {
    setStepStatus(prev => step === 'all'
      ? Object.fromEntries(Object.keys(prev).map(key => [key, status])) as typeof prev
      : { ...prev, [step]: status })
  }, [])

  const run = useCallback(async (request: ProductionIntent, resume = false) => {
    if (active.current) return
    const controller = new AbortController()
    active.current = { controller, kind: 'run' }
    const current = () => active.current?.controller === controller && !controller.signal.aborted
    setIsGenerating(true); setError(null); mark(request.step, 'generating')
    setMessage('Demande en cours. Son identifiant est conservé pour la reprise.')
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
          persist(null); mark(receipt.step, 'pending'); setMessage('Annulation confirmée par le serveur.'); return
        }
        if (ok && status !== 202 && (!receipt.jobId || body.status === 'done') && body.data !== undefined) {
          if (receipt.step === 'all' && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))) throw new Error('Résultat invalide')
          persist(null)
          setGeneratedData(prev => receipt.step === 'all' ? body.data as Record<string, unknown> : { ...prev, [receipt.step]: body.data })
          mark(receipt.step, 'done'); setMessage('Tâche terminée. Vérifie les médias avant toute utilisation ou publication.')
          if (!resume) setCurrentStep(prev => prev === currentStep ? (receipt.step === 'all' ? STEPS.length - 1 : Math.min(prev + 1, STEPS.length - 1)) : prev)
          return
        }
        // Only conclusive pre-submission refusals release the local intent.
        if (submitted && !receipt.jobId && ((status === 400) || body.error === 'SUTRA_QUOTA_EXHAUSTED' || body.code === 'SALAD_UNAVAILABLE')) {
          persist(null); mark(receipt.step, 'error'); setMessage('Demande refusée avant exécution.')
          setError(body.error === 'SUTRA_QUOTA_EXHAUSTED' ? 'Crédits ou quota insuffisants.' : body.code === 'SALAD_UNAVAILABLE' ? 'GPU distant indisponible. Aucun repli API payant.' : 'Demande invalide. Vérifie les paramètres.'); return
        }
        if (!ok || !['queued', 'processing'].includes(String(body.status))) throw new Error('État non confirmé')
        const jobId = productionJobId(body.jobId)
        if (!jobId || (receipt.jobId && receipt.jobId !== jobId)) throw new Error('Reçu invalide')
        if (!receipt.jobId) { receipt = { ...receipt, jobId }; persist(receipt) }
        setMessage(body.status === 'queued' ? 'Tâche en file d’attente sur le serveur.' : 'Tâche en cours sur le serveur.')
        if (attempt >= 119) throw new Error('Suivi expiré')
        await waitForProductionStatus(controller.signal)
        result = await requestClientJson(`/api/video/status/${jobId}`, { signal: controller.signal })
      }
    } catch {
      if (!current()) return
      mark(request.step, 'error')
      setMessage('État non confirmé. La tâche peut continuer sur le serveur.')
      setError('Le suivi a été interrompu ou le serveur demande une réconciliation. Reprends la même demande ou annule-la ; aucune nouvelle production ne sera lancée ici tant que son état reste incertain.')
    } finally {
      if (current()) { active.current = null; setIsGenerating(false) }
    }
  }, [persist, mark, currentStep, setCurrentStep])

  const start = useCallback(async (step: ProductionStep | 'all') => {
    if (active.current || pending.current || !ready || !userId || step === 'idea') return
    setError(null)
    const content = { step, idea, template, format, engine, voice, musicStyle, tone, ...(step !== 'all' ? { previousData: generatedData } : {}) }
    if (!productionSchema.safeParse(content).success) { setError('Demande invalide. Vérifie les paramètres.'); return }
    if (step === 'thumbnail') {
      // Existing non-durable URL preparation; never pretend it supports cancellation.
      const controller = new AbortController(); active.current = { controller, kind: 'run' }; setIsGenerating(true)
      try {
        const result = await requestClientJson('/api/production', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content), signal: controller.signal })
        if (controller.signal.aborted) return
        if (!result.ok || result.body.data === undefined) throw new Error('Miniature indisponible')
        setGeneratedData(prev => ({ ...prev, thumbnail: result.body.data })); mark(step, 'done')
      } catch { if (!controller.signal.aborted) { mark(step, 'error'); setError('Préparation de la miniature indisponible. Réessaie.') } }
      finally { if (active.current?.controller === controller) { active.current = null; setIsGenerating(false) } }
      return
    }
    try {
      const requestId = crypto.randomUUID()
      const next: ProductionIntent = { version: 1, userId, requestId, step, body: JSON.stringify({ ...content, requestId }), cancelRequested: false }
      persist(next)
      await run(next)
    } catch { setError('Impossible de conserver le reçu dans cet onglet. Aucune nouvelle demande envoyée.') }
  }, [idea, template, format, engine, voice, musicStyle, tone, generatedData, ready, userId, persist, run, mark])

  const cancel = useCallback(async () => {
    const request = pending.current
    if (!request || active.current?.kind === 'cancel') return
    try { persist({ ...request, cancelRequested: true }) }
    catch { setError('Impossible de conserver l’intention d’annulation. Aucune annulation envoyée.'); return }
    active.current?.controller.abort()
    const controller = new AbortController(); active.current = { controller, kind: 'cancel' }
    setIsGenerating(false); setIsCancelling(true); setError(null)
    setMessage('Annulation demandée. En attente de confirmation serveur…')
    try {
      const result = await requestClientJson('/api/production', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'cancel', targetStep: request.step, requestId: request.requestId, idea: JSON.parse(request.body).idea }) })
      if (controller.signal.aborted) return
      const data = result.body.data as { cancelled?: unknown } | undefined
      if (!result.ok || data?.cancelled !== true) throw new Error('Non confirmée')
      persist(null); mark(request.step, 'pending'); setMessage('Annulation confirmée par le serveur.')
    } catch {
      if (controller.signal.aborted) return
      mark(request.step, 'error'); setMessage('Annulation non confirmée.')
      setError('La tâche peut être encore active ou déjà terminée. Reprends le suivi avec sa référence ou réessaie la même annulation.')
    } finally {
      if (active.current?.controller === controller) { active.current = null; setIsCancelling(false) }
    }
  }, [persist, mark])

  return {
    stepStatus, generatedData, error, isGenerating, isCancelling, intent, message,
    requestLocked: !ready || !!intent,
    generateStep: (step: ProductionStep) => start(step), generateAll: () => start('all'), cancel,
    resume: () => { if (pending.current) void run(pending.current, true) },
  }
}
