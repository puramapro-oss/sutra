import { useState, useCallback } from 'react'
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

  const generateStep = useCallback(async (step: ProductionStep) => {
    setIsGenerating(true)
    setError(null)
    setStepStatus((prev) => ({ ...prev, [step]: 'generating' }))

    try {
      const res = await fetch('/api/production', {
        method: 'POST',
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

      const result = await res.json()
      setGeneratedData((prev) => ({ ...prev, [step]: result.data }))
      setStepStatus((prev) => ({ ...prev, [step]: 'done' }))

      // Auto-advance to next step
      if (currentStep < STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1)
      }
    } catch (err) {
      setStepStatus((prev) => ({ ...prev, [step]: 'error' }))
      setError(err instanceof Error ? err.message : 'Erreur lors de la generation')
    } finally {
      setIsGenerating(false)
    }
  }, [idea, template, format, engine, voice, musicStyle, tone, generatedData, currentStep, setCurrentStep])

  const generateAll = useCallback(async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/production', {
        method: 'POST',
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

      const result = await res.json()
      setGeneratedData(result.data ?? {})
      setStepStatus({
        idea: 'done', script: 'done', video: 'done',
        voice: 'done', music: 'done', assembly: 'done', thumbnail: 'done',
      })
      setCurrentStep(STEPS.length - 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la production')
    } finally {
      setIsGenerating(false)
    }
  }, [idea, template, format, engine, voice, musicStyle, tone, setCurrentStep])

  return {
    stepStatus,
    generatedData,
    error,
    isGenerating,
    generateStep,
    generateAll,
  }
}
