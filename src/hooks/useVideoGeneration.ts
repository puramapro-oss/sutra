import { useCreateRequest } from '@/hooks/useCreateRequest'
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
  userId?: string
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
  userId,
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
  const request = useCreateRequest(userId)
  const keywordsRequest = useRef<{ body: string; controller: AbortController } | null>(null)
  const keywordsBody = useRef<string | null>(null)
  useEffect(() => () => {
    keywordsRequest.current?.controller.abort()
  }, [])
  // States
  const isGenerating = request.busy
  const pipelineSteps: PipelineStep[] = getPipelineSteps(engine).map(step => ({ ...step, status: request.videoId ? 'completed' : 'pending' }))
  const { videoId, requestLocked, reset, submit } = request
  const error = request.noticeError ?? request.error
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

  // An uncertain durable request can only be resumed or cancelled, never reset.
  const resetGeneration = useCallback(() => {
    if (requestLocked) return
    reset()
    keywordsRequest.current?.controller.abort()
    keywordsRequest.current = null
    keywordsBody.current = null
    setKeywordsLoading(false)
    setSceneKeywords([])
    setSceneSelections([])
  }, [requestLocked, reset])

  const startGeneration = useCallback(async () => {
    if (!topic.trim() || isOverLimit || requestLocked) return
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
      await submit(body)
  }, [topic, format, quality, engine, niche, style, voice, mode, script, mediaMode, sceneSelections, isOverLimit, requestLocked, submit])

  return {
    isGenerating,
    pipelineSteps,
    videoId,
    error,
    sceneKeywords,
    sceneSelections,
    setSceneSelections,
    keywordsLoading,
    fetchKeywords,
    startGeneration,
    resetGeneration,
    request,
  }
}
