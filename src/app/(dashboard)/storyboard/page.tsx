'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Monitor,
  Smartphone,
  Square,
  GripVertical,
  X,
  Plus,
  Clock,
  Layers,
  Film,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scene {
  id: string
  visual_prompt: string
  description: string
  duration_seconds: number
  transition: 'fade' | 'cut' | 'slide' | 'zoom'
}

type VideoFormat = '16:9' | '9:16' | '1:1'
type DurationTarget = 'short' | 'medium' | 'long'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORMAT_OPTIONS: { id: VideoFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: '16:9', label: '16:9', icon: <Monitor className="h-5 w-5" />, desc: 'YouTube, Desktop' },
  { id: '9:16', label: '9:16', icon: <Smartphone className="h-5 w-5" />, desc: 'TikTok, Reels' },
  { id: '1:1', label: '1:1', icon: <Square className="h-5 w-5" />, desc: 'Instagram, Feed' },
]

const DURATION_OPTIONS: { id: DurationTarget; label: string; desc: string }[] = [
  { id: 'short', label: 'Court', desc: '~30s' },
  { id: 'medium', label: 'Moyen', desc: '~2 min' },
  { id: 'long', label: 'Long', desc: '5 min+' },
]

const TRANSITIONS: { id: Scene['transition']; label: string }[] = [
  { id: 'fade', label: 'Fondu' },
  { id: 'cut', label: 'Cut' },
  { id: 'slide', label: 'Slide' },
  { id: 'zoom', label: 'Zoom' },
]

function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function getPollinationsUrl(prompt: string, format: VideoFormat): string {
  const dims =
    format === '9:16'
      ? 'width=432&height=768'
      : format === '1:1'
        ? 'width=600&height=600'
        : 'width=768&height=432'
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${dims}&model=flux&enhance=true&nologo=true`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryboardPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  // Input state
  const [idea, setIdea] = useState('')
  const [format, setFormat] = useState<VideoFormat>('16:9')
  const [durationTarget, setDurationTarget] = useState<DurationTarget>('medium')

  // Generation state
  const [scenes, setScenes] = useState<Scene[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
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
      const mapped: Scene[] = (data.scenes ?? []).map(
        (s: Omit<Scene, 'id'>) => ({
          ...s,
          id: makeId(),
        })
      )
      setScenes(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsGenerating(false)
    }
  }, [idea, format, durationTarget, isGenerating])

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

  const handleGoToCreate = useCallback(() => {
    try {
      sessionStorage.setItem(
        'sutra-storyboard',
        JSON.stringify({ scenes, format, durationTarget, idea })
      )
    } catch {
      // sessionStorage may be full
    }
    router.push('/create')
  }, [scenes, format, durationTarget, idea, router])

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)

  // ---------------------------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Film className="h-8 w-8 text-violet-400" />
            Storyboard IA
          </h1>
          <p className="text-white/50 mt-1">
            Decris ton idee, Claude genere un storyboard visuel complet
          </p>
        </motion.div>
      </div>

      <div className="px-6 space-y-6">
        {/* ----------------------------------------------------------------- */}
        {/* Input section                                                     */}
        {/* ----------------------------------------------------------------- */}
        <motion.div
          className={cn(
            'bg-white/[0.02] border border-white/[0.06] rounded-xl backdrop-blur-xl p-6 space-y-5'
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
        >
          {/* Textarea */}
          <div>
            <label htmlFor="idea" className="block text-sm font-medium text-white/60 mb-2">
              Idee de video
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Decris ton idee de video..."
              rows={3}
              className={cn(
                'w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-3',
                'text-white placeholder:text-white/30 resize-none',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40',
                'transition-all duration-200'
              )}
            />
          </div>

          {/* Format selector */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Format</label>
            <div className="flex gap-3">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200',
                    format === opt.id
                      ? 'bg-violet-500/15 border-violet-500/40 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/5'
                  )}
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-white/40">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration target */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Duree cible</label>
            <div className="flex gap-3">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDurationTarget(opt.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200',
                    durationTarget === opt.id
                      ? 'bg-violet-500/15 border-violet-500/40 text-white'
                      : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:bg-white/5'
                  )}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-white/40">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!idea.trim() || isGenerating}
            loading={isGenerating}
            size="lg"
            className="w-full"
            data-testid="generate-storyboard-btn"
          >
            <Sparkles className="h-5 w-5" />
            {isGenerating ? 'Generation en cours...' : 'Generer le storyboard'}
          </Button>

          {error && (
            <motion.p
              className="text-red-400 text-sm text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        {/* ----------------------------------------------------------------- */}
        {/* Loading skeletons                                                 */}
        {/* ----------------------------------------------------------------- */}
        {isGenerating && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div
                key={i}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Storyboard grid                                                   */}
        {/* ----------------------------------------------------------------- */}
        <AnimatePresence mode="wait">
          {scenes.length > 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-400" />
                  {scenes.length} scenes
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenes.map((scene, idx) => (
                  <motion.div
                    key={scene.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    className={cn(
                      'bg-white/[0.02] border rounded-xl backdrop-blur-xl overflow-hidden',
                      'transition-all duration-200 group',
                      dragIndex === idx
                        ? 'border-violet-500/60 opacity-50 scale-95'
                        : 'border-white/[0.06] hover:border-white/[0.12]'
                    )}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    layout
                  >
                    {/* Scene header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors"
                          title="Glisser pour reorganiser"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <span className="bg-violet-500/20 text-violet-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                          Scene {idx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteScene(scene.id)}
                        className="text-white/20 hover:text-red-400 transition-colors p-1"
                        aria-label={`Supprimer scene ${idx + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Preview image */}
                    <div className="px-4 py-2">
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5">
                        <Image
                          src={getPollinationsUrl(scene.visual_prompt, format)}
                          alt={scene.description || `Scene ${idx + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="px-4 pb-2">
                      <textarea
                        value={scene.description}
                        onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                        rows={2}
                        className={cn(
                          'w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2',
                          'text-sm text-white placeholder:text-white/30 resize-none',
                          'focus:outline-none focus:ring-1 focus:ring-violet-500/40',
                          'transition-all duration-200'
                        )}
                        placeholder="Description de la scene..."
                      />
                    </div>

                    {/* Duration + Transition */}
                    <div className="px-4 pb-4 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-white/40" />
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={scene.duration_seconds}
                          onChange={(e) =>
                            updateScene(scene.id, {
                              duration_seconds: Math.max(1, Math.min(120, parseInt(e.target.value) || 1)),
                            })
                          }
                          className={cn(
                            'w-14 bg-white/5 border border-white/[0.06] rounded-lg px-2 py-1',
                            'text-xs text-white text-center',
                            'focus:outline-none focus:ring-1 focus:ring-violet-500/40'
                          )}
                        />
                        <span className="text-xs text-white/40">s</span>
                      </div>

                      <select
                        value={scene.transition}
                        onChange={(e) =>
                          updateScene(scene.id, {
                            transition: e.target.value as Scene['transition'],
                          })
                        }
                        className={cn(
                          'bg-white/5 border border-white/[0.06] rounded-lg px-2 py-1',
                          'text-xs text-white',
                          'focus:outline-none focus:ring-1 focus:ring-violet-500/40',
                          'appearance-none cursor-pointer'
                        )}
                      >
                        {TRANSITIONS.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#1a1a2e] text-white">
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                ))}

                {/* Add scene card */}
                <motion.button
                  type="button"
                  onClick={addScene}
                  className={cn(
                    'min-h-[280px] flex flex-col items-center justify-center gap-3',
                    'bg-white/[0.01] border border-dashed border-white/[0.08] rounded-xl',
                    'text-white/30 hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/5',
                    'transition-all duration-200 cursor-pointer'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid="add-scene-btn"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">Ajouter une scene</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Sticky bottom bar                                                   */}
      {/* ------------------------------------------------------------------- */}
      <AnimatePresence>
        {scenes.length > 0 && !isGenerating && (
          <motion.div
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-[#0A0A0F]/90 backdrop-blur-xl border-t border-white/[0.06]',
              'px-6 py-4'
            )}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-white/60">
                  <Layers className="h-4 w-4" />
                  <span className="text-sm font-medium">{scenes.length} scenes</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {totalDuration < 60
                      ? `${totalDuration}s`
                      : `${Math.floor(totalDuration / 60)}m${totalDuration % 60 > 0 ? ` ${totalDuration % 60}s` : ''}`}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleGoToCreate}
                size="md"
                data-testid="generate-video-btn"
              >
                Generer la video
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
