import { useState, useCallback, useEffect, useRef } from 'react'
import { getPipelineSteps } from '@/lib/create-utils'
import type { PipelineStep, VideoFormat, VideoQuality } from '@/types'
import type { VideoEngine } from '@/lib/ltx'
import type { MediaMode } from '@/components/create/MediaModeCards'
import type { StockResult } from '@/components/create/StockPicker'

interface SceneStockState {
  selected: StockResult | null
  fallbackToAI: boolean
}

interface UseVideoGenerationProps {
  topic: string
  format: VideoFormat
  quality: VideoQuality
  engine: VideoEngine
  niche: string
  style: string
  voice: string
  mode: 'auto' | 'manual'
  script: string
  mediaMode: MediaMode
  isOverLimit: boolean
}

export function useVideoGeneration({
  topic,
  format,
  quality,
  engine,
  niche,
  style,
  voice,
  mode,
  script,
  mediaMode,
  isOverLimit,
}: UseVideoGenerationProps) {
  // States
  const [isGenerating, setIsGenerating] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(getPipelineSteps('wan-classic'))
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sceneKeywords, setSceneKeywords] = useState<string[][]>([])
  const [sceneSelections, setSceneSelections] = useState<SceneStockState[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Extract keywords for stock search
  const fetchKeywords = useCallback(
    async (rawScript: string) => {
      const scenes = rawScript
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (scenes.length === 0) return
      setKeywordsLoading(true)
      try {
        const res = await fetch('/api/stock/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenes }),
        })
        const data = await res.json()
        const kws: string[][] = Array.isArray(data.keywords) ? data.keywords : scenes.map(() => [])
        setSceneKeywords(kws)
        setSceneSelections(scenes.map(() => ({ selected: null, fallbackToAI: false })))
      } catch {
        setSceneKeywords(scenes.map((s) => s.split(/\s+/).slice(0, 3)))
        setSceneSelections(scenes.map(() => ({ selected: null, fallbackToAI: false })))
      } finally {
        setKeywordsLoading(false)
      }
    },
    []
  )

  // Poll pipeline status
  const pollPipeline = useCallback((vid: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/create/status?videoId=${vid}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.steps) {
          setPipelineSteps(data.steps)
        }

        const allDone = data.steps?.every(
          (s: PipelineStep) => s.status === 'completed' || s.status === 'error'
        )

        if (allDone) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setIsGenerating(false)
        }
      } catch {
        // Silent fail, keep polling
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)
  }, [])

  // Reset generation state
  const resetGeneration = useCallback(() => {
    setIsGenerating(false)
    setPipelineSteps(getPipelineSteps('wan-classic').map((s) => ({ ...s, status: 'pending' as const })))
    setVideoId(null)
    setError(null)
    setSceneKeywords([])
    setSceneSelections([])
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // Start generation
  const startGeneration = useCallback(async () => {
    if (!topic.trim() || isOverLimit) return

    setIsGenerating(true)
    setError(null)
    setPipelineSteps(getPipelineSteps(engine).map((s) => ({ ...s, status: 'pending' as const })))

    try {
      const response = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          format,
          quality,
          engine,
          niche: niche || undefined,
          style: style || undefined,
          voice,
          mode,
          script: mode === 'manual' ? script : undefined,
          mediaMode,
          stockSelections:
            mediaMode === 'ai'
              ? []
              : sceneSelections.map((s, i) => ({
                  sceneIndex: i,
                  source: s.selected?.source ?? null,
                  type: s.selected?.type ?? null,
                  url: s.selected?.url ?? null,
                  thumbnail: s.selected?.thumbnail ?? null,
                  quality: s.selected?.quality ?? null,
                  fallbackToAI: s.fallbackToAI,
                })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(errorData.error ?? `Erreur ${response.status}`)
      }

      const result = await response.json()
      setVideoId(result.videoId ?? null)

      if (result.videoId) {
        pollPipeline(result.videoId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la generation'
      setError(message)
      setIsGenerating(false)
    }
  }, [topic, format, quality, engine, niche, style, voice, mode, script, mediaMode, sceneSelections, isOverLimit, pollPipeline])

  return {
    isGenerating,
    pipelineSteps,
    setPipelineSteps,
    videoId,
    setVideoId,
    error,
    setError,
    sceneKeywords,
    sceneSelections,
    setSceneSelections,
    keywordsLoading,
    fetchKeywords,
    startGeneration,
    resetGeneration,
  }
}
