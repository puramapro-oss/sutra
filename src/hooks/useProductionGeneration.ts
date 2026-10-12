import { awaitJobResult } from '@/lib/generation-client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { STEPS } from '@/lib/production-constants'
import type { ProductionStep, TemplateId, StepStatus } from '@/types/production'
import type { VideoEngine } from '@/lib/ltx'

interface UseProductionGenerationProps {
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

export function useProductionGeneration({
  idea,
  template,
  format,
  engine,
  voice,
  musicStyle,
  tone,
  currentStep,
  setCurrentStep,
}: UseProductionGenerationProps) {
  const [stepStatus, setStepStatus] = useState<Record<ProductionStep, StepStatus>>({
    idea: 'pending', script: 'pending', video: 'pending',
    voice: 'pending', music: 'pending', assembly: 'pending', thumbnail: 'pending',
  })
  const [generatedData, setGeneratedData] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])

  const generateStep = useCallback(async (step: ProductionStep) => {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setIsGenerating(true)
    setError(null)
    setStepStatus((prev) => ({ ...prev, [step]: 'generating' }))

    try {
      const res = await fetch('/api/production', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          idea,
          template,
          format,
          engine,
          voice,
          musicStyle,
          tone,
          previousData: generatedData,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      const result = await awaitJobResult(res, controller.signal)
      controller.signal.throwIfAborted()
      setGeneratedData((prev) => ({ ...prev, [step]: result.data }))
      setStepStatus((prev) => ({ ...prev, [step]: 'done' }))

      // Keep navigation performed while the request was pending.
      setCurrentStep((prev) => prev === currentStep ? Math.min(prev + 1, STEPS.length - 1) : prev)
    } catch (err) {
      if (controller.signal.aborted) return
      setStepStatus((prev) => ({ ...prev, [step]: 'error' }))
      setError(err instanceof Error ? err.message : 'Erreur lors de la generation')
    } finally {
      if (active.current === controller) {
        active.current = null
        if (!controller.signal.aborted) setIsGenerating(false)
      }
    }
  }, [idea, template, format, engine, voice, musicStyle, tone, generatedData, currentStep, setCurrentStep])

  const generateAll = useCallback(async () => {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/production', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'all',
          idea,
          template,
          format,
          engine,
          voice,
          musicStyle,
          tone,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(data.error ?? `Erreur ${res.status}`)
      }

      const result = await awaitJobResult(res, controller.signal)
      controller.signal.throwIfAborted()
      setGeneratedData(result.data ?? {})
      setStepStatus({
        idea: 'done', script: 'done', video: 'done',
        voice: 'done', music: 'done', assembly: 'done', thumbnail: 'done',
      })
      setCurrentStep((prev) => prev === currentStep ? STEPS.length - 1 : prev)
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Erreur lors de la production')
    } finally {
      if (active.current === controller) {
        active.current = null
        if (!controller.signal.aborted) setIsGenerating(false)
      }
    }
  }, [idea, template, format, engine, voice, musicStyle, tone, currentStep, setCurrentStep])

  return {
    stepStatus,
    generatedData,
    error,
    isGenerating,
    generateStep,
    generateAll,
  }
}
