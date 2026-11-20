import { useState, useCallback, useRef } from 'react'
import type { Scene, VideoFormat, DurationTarget } from '@/lib/storyboard'
import { makeId } from '@/lib/storyboard'

export function useStoryboard() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const generating = useRef(false)

  const replaceScenes = useCallback((next: Scene[]) => {
    setScenes(next)
    setDragIndex(null)
    setError(null)
  }, [])

  const handleGenerate = useCallback(
    async (idea: string, format: VideoFormat, durationTarget: DurationTarget) => {
      if (!idea.trim() || generating.current) return
      generating.current = true
      setIsGenerating(true)
      setError(null)

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
        if (mapped.length === 0) throw new Error('Aucun plan reçu. Réessaie la génération.')
        replaceScenes(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        generating.current = false
        setIsGenerating(false)
      }
    },
    [replaceScenes]
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
    replaceScenes,
    updateScene,
    deleteScene,
    addScene,
    handleDragStart,
    handleDragOver,
    handleDrop,
  }
}
