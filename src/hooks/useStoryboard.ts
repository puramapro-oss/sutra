import { useState, useCallback } from 'react'
import type { Scene, VideoFormat, DurationTarget } from '@/lib/storyboard'
import { makeId } from '@/lib/storyboard'

export function useStoryboard() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const handleGenerate = useCallback(
    async (idea: string, format: VideoFormat, durationTarget: DurationTarget) => {
      if (!idea.trim() || isGenerating) return
      setIsGenerating(true)
      setError(null)
      setScenes([])

      try {
        const res = await fetch('/api/storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: idea.trim(), format, durationTarget }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Erreur serveur' }))
          throw new Error(data.error ?? 'Erreur serveur')
        }

        const data = await res.json()
        const mapped: Scene[] = (data.scenes ?? []).map((s: Omit<Scene, 'id'>) => ({
          ...s,
          id: makeId(),
        }))
        setScenes(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setIsGenerating(false)
      }
    },
    [isGenerating]
  )

  const updateScene = useCallback((id: string, patch: Partial<Scene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const deleteScene = useCallback((id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const addScene = useCallback(() => {
    setScenes((prev) => [
      ...prev,
      {
        id: makeId(),
        visual_prompt: 'A cinematic establishing shot, warm lighting, shallow depth of field',
        description: 'Nouvelle scene — modifie la description',
        duration_seconds: 5,
        transition: 'cut',
      },
    ])
  }, [])

  const handleDragStart = useCallback((idx: number) => {
    setDragIndex(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (dropIdx: number) => {
      if (dragIndex === null || dragIndex === dropIdx) {
        setDragIndex(null)
        return
      }
      setScenes((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(dropIdx, 0, moved)
        return next
      })
      setDragIndex(null)
    },
    [dragIndex]
  )

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)

  return {
    scenes,
    isGenerating,
    error,
    dragIndex,
    totalDuration,
    handleGenerate,
    updateScene,
    deleteScene,
    addScene,
    handleDragStart,
    handleDragOver,
    handleDrop,
  }
}
