import { awaitGeneration } from '@/lib/generation-client'
import { useState, useCallback, useRef, useEffect } from 'react'
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
  const intent = useRef<{ body: string; key: string } | null>(null)
  const active = useRef<AbortController | null>(null)
  const keywordsRequest = useRef<{ body: string; controller: AbortController } | null>(null)
  const keywordsBody = useRef<string | null>(null)
  useEffect(() => () => {
    active.current?.abort()
    keywordsRequest.current?.controller.abort()
  }, [])
  // States
  const [isGenerating, setIsGenerating] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(getPipelineSteps('wan-classic'))
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sceneKeywords, setSceneKeywords] = useState<string[][]>([])
  const [sceneSelections, setSceneSelections] = useState<SceneStockState[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)

  // Extract keywords for stock search
  const fetchKeywords = useCallback(
    async (rawScript: string) => {
      const scenes = rawScript
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      if (scenes.length === 0) return
      const body = JSON.stringify({ scenes })
      if (keywordsRequest.current?.body === body || (!keywordsRequest.current && keywordsBody.current === body)) return
      keywordsRequest.current?.controller.abort()
      const controller = new AbortController()
      keywordsRequest.current = { body, controller }
      setKeywordsLoading(true)
      try {
        const res = await fetch('/api/stock/keywords', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        const data = await res.json()
        controller.signal.throwIfAborted()
        if (!res.ok || !Array.isArray(data.keywords) || data.keywords.length !== scenes.length ||
          !data.keywords.every((words: unknown) => Array.isArray(words) && words.every(word => typeof word === 'string'))) {
          throw new Error('Mots-cles indisponibles')
        }
        const kws: string[][] = data.keywords
        setSceneKeywords(kws)
        setSceneSelections(scenes.map(() => ({ selected: null, fallbackToAI: false })))
      } catch {
        if (controller.signal.aborted) return
        setSceneKeywords(scenes.map((s) => s.split(/\s+/).slice(0, 3)))
        setSceneSelections(scenes.map(() => ({ selected: null, fallbackToAI: false })))
      } finally {
        if (keywordsRequest.current?.controller === controller) {
          keywordsRequest.current = null
          if (!controller.signal.aborted) {
            keywordsBody.current = body
            setKeywordsLoading(false)
          }
        }
      }
    },
    []
  )

  // Reset generation state
  const resetGeneration = useCallback(() => {
    active.current?.abort()
    keywordsRequest.current?.controller.abort()
    keywordsRequest.current = null
    keywordsBody.current = null
    setKeywordsLoading(false)
    active.current = null
    intent.current = null
    setIsGenerating(false)
    setPipelineSteps(getPipelineSteps('wan-classic').map((s) => ({ ...s, status: 'pending' as const })))
    setVideoId(null)
    setError(null)
    setSceneKeywords([])
    setSceneSelections([])
  }, [])

  // Start generation
  const startGeneration = useCallback(async () => {
    if (!topic.trim() || isOverLimit || active.current) return
    const controller = new AbortController()
    active.current = controller

    setIsGenerating(true)
    setError(null)
    setPipelineSteps(getPipelineSteps(engine).map((s) => ({ ...s, status: 'pending' as const })))

    try {
      const body = JSON.stringify({
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
        })
      if (intent.current?.body !== body) intent.current = { body, key: crypto.randomUUID() }
      const response = await fetch('/api/create', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.current.key },
        body, signal: controller.signal })

      const resolvedVideoId = await awaitGeneration(response, controller.signal)
      controller.signal.throwIfAborted()
      intent.current = null

      setVideoId(resolvedVideoId)
      setIsGenerating(false)
      setPipelineSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' as const })))

      if (!resolvedVideoId) {
        setError('Video generee mais identifiant manquant dans la reponse — actualise ta bibliotheque.')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Erreur lors de la generation'
      setError(message)
      setIsGenerating(false)
    } finally {
      if (active.current === controller) active.current = null
    }
  }, [topic, format, quality, engine, niche, style, voice, mode, script, mediaMode, sceneSelections, isOverLimit])

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
