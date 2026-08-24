'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Mic,
  Music,
  FileVideo,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useVideoGeneration } from '@/hooks/useVideoGeneration'
import { PLAN_LIMITS, NICHES, VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { MANUAL_STEPS } from '@/lib/create-utils'
import { cn } from '@/lib/utils'
import { ModeToggle } from '@/components/create/ModeToggle'
import { PipelineProgress } from '@/components/create/PipelineProgress'
import { MediaModeCards, type MediaMode } from '@/components/create/MediaModeCards'
import { SceneStockPicker, type StockResult } from '@/components/create/StockPicker'
import AutoForm, { type AutoFormProps } from '@/components/create/AutoForm'
import ManualForm, { type ManualFormProps } from '@/components/create/ManualForm'
import {
  OptionSection,
  OptionCard,
  UploadZone,
  SummaryRow,
  CreateSkeleton,
} from '@/components/create/CreateHelpers'
import { Button } from '@/components/ui/Button'
import { PublishEverywhereButton } from '@/components/social/PublishEverywhereButton'
import type { Plan, PipelineStep, VideoFormat, VideoQuality } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

interface SceneStockState {
  selected: StockResult | null
  fallbackToAI: boolean
}

export default function CreatePage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<VideoFormat>('9:16')
  const [quality, setQuality] = useState<VideoQuality>('720p')
  const [niche, setNiche] = useState('')
  const [style, setStyle] = useState('')
  const [voice, setVoice] = useState<string>(VOICE_STYLES[0].id)
  const [engine, setEngine] = useState<VideoEngine>('wan-classic')

  // Manual mode
  const [manualStep, setManualStep] = useState(0)
  const [script, setScript] = useState('')

  // Media mode (ai/stock/mixed) — new in wizard step 0 (manual) + auto form
  const [mediaMode, setMediaMode] = useState<MediaMode>('ai')

  // Plan limits — MUST be defined BEFORE hook call
  const plan = (profile?.plan ?? 'free') as Plan
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const videosUsed = profile?.monthly_video_count ?? 0
  const isOverLimit = plan !== 'admin' && videosUsed >= planLimits.videos

  // Video generation logic (extracted to hook)
  const {
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
  } = useVideoGeneration({
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
  })

  // Check which quality options are available
  const planRank: Record<Plan, number> = { free: 0, starter: 1, creator: 2, empire: 3, enterprise: 3, admin: 4 }
  const currentPlanRank = planRank[plan] ?? 0

  const isQualityAvailable = (minPlan: Plan): boolean => {
    return currentPlanRank >= (planRank[minPlan] ?? 0)
  }

  const isEngineAvailable = (minPlan: Plan): boolean => {
    return currentPlanRank >= (planRank[minPlan] ?? 0)
  }

  // Auto-select best available engine on plan change
  useEffect(() => {
    if (plan === 'admin') setEngine('ltx-pro')
    else if (currentPlanRank >= 1) setEngine('ltx-fast')
    else setEngine('wan-classic')
  }, [plan, currentPlanRank])


  if (authLoading) {
    return <CreateSkeleton />
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]">
          Creer une video
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Genere une video complete en quelques minutes grace a l&apos;IA.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center">
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {/* Plan limit warning */}
      {isOverLimit && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300">
              Limite de videos atteinte
            </p>
            <p className="text-xs text-red-400/60 mt-0.5">
              Tu as utilise {videosUsed}/{planLimits.videos} videos ce mois.{' '}
              <button
                onClick={() => router.push('/pricing')}
                className="underline hover:text-red-300 transition-colors"
              >
                Upgrade ton plan
              </button>
            </p>
          </div>
        </motion.div>
      )}

      {/* Generation in progress */}
      {isGenerating || pipelineSteps.some((s) => s.status !== 'pending') ? (
        <div className="space-y-6">
          <PipelineProgress steps={pipelineSteps} />

          {/* Completed: show CTA */}
          {pipelineSteps.every((s) => s.status === 'completed') && videoId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`/library/${videoId}`)}
              >
                Voir ma video
                <ArrowRight className="h-4 w-4" />
              </Button>
              <PublishEverywhereButton
                videoId={videoId}
                videoTitle={topic || 'Ma video'}
                variant="primary"
              />
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  resetGeneration()
                  setTopic('')
                }}
              >
                Creer une autre video
              </Button>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </div>
      ) : (
        /* Creation form */
        <AnimatePresence mode="wait">
          {mode === 'auto' ? (
            <AutoForm
              key="auto"
              topic={topic}
              setTopic={setTopic}
              format={format}
              setFormat={setFormat}
              quality={quality}
              setQuality={setQuality}
              engine={engine}
              setEngine={setEngine}
              niche={niche}
              setNiche={setNiche}
              style={style}
              setStyle={setStyle}
              voice={voice}
              setVoice={setVoice}
              isQualityAvailable={isQualityAvailable}
              isEngineAvailable={isEngineAvailable}
              isOverLimit={isOverLimit}
              onGenerate={startGeneration}
              mediaMode={mediaMode}
              setMediaMode={setMediaMode}
            />
          ) : (
            <ManualForm
              key="manual"
              topic={topic}
              setTopic={setTopic}
              script={script}
              setScript={setScript}
              format={format}
              setFormat={setFormat}
              quality={quality}
              setQuality={setQuality}
              engine={engine}
              setEngine={setEngine}
              niche={niche}
              setNiche={setNiche}
              style={style}
              setStyle={setStyle}
              voice={voice}
              setVoice={setVoice}
              isQualityAvailable={isQualityAvailable}
              isEngineAvailable={isEngineAvailable}
              isOverLimit={isOverLimit}
              step={manualStep}
              setStep={(s) => {
                setManualStep(s)
                // When entering medias step (step index 3) in stock/mixed mode, fetch keywords
                if (s === 3 && mediaMode !== 'ai' && script.trim() && sceneKeywords.length === 0) {
                  void fetchKeywords(script)
                }
              }}
              onGenerate={startGeneration}
              mediaMode={mediaMode}
              setMediaMode={setMediaMode}
              sceneKeywords={sceneKeywords}
              sceneSelections={sceneSelections}
              setSceneSelections={setSceneSelections}
              keywordsLoading={keywordsLoading}
            />
          )}
        </AnimatePresence>
      )}
    </motion.div>
  )
}

