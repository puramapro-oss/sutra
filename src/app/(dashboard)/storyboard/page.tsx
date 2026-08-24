'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Clock, Layers, Film, ArrowRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useStoryboard } from '@/hooks/useStoryboard'
import StoryboardInput from '@/components/storyboard/StoryboardInput'
import SceneCard from '@/components/storyboard/SceneCard'
import type { VideoFormat, DurationTarget } from '@/lib/storyboard'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryboardPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [idea, setIdea] = useState('')
  const [format, setFormat] = useState<VideoFormat>('16:9')
  const [durationTarget, setDurationTarget] = useState<DurationTarget>('medium')

  const {
    scenes,
    isGenerating,
    error,
    dragIndex,
    totalDuration,
    handleGenerate: generate,
    updateScene,
    deleteScene,
    addScene,
    handleDragStart,
    handleDragOver,
    handleDrop,
  } = useStoryboard()

  const handleGenerate = useCallback(() => {
    generate(idea, format, durationTarget)
  }, [idea, format, durationTarget, generate])

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
        <StoryboardInput
          idea={idea}
          format={format}
          durationTarget={durationTarget}
          isGenerating={isGenerating}
          error={error}
          onIdeaChange={setIdea}
          onFormatChange={setFormat}
          onDurationChange={setDurationTarget}
          onGenerate={handleGenerate}
        />

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
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    index={idx}
                    format={format}
                    dragIndex={dragIndex}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onUpdate={updateScene}
                    onDelete={deleteScene}
                  />
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
