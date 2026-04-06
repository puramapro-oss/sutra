'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Upload,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Monitor,
  Smartphone,
  Square,
  Mic,
  Music,
  FileVideo,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { PLAN_LIMITS, NICHES, VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { ModeToggle } from '@/components/create/ModeToggle'
import { PipelineProgress } from '@/components/create/PipelineProgress'
import { MediaModeCards, type MediaMode } from '@/components/create/MediaModeCards'
import { SceneStockPicker, type StockResult } from '@/components/create/StockPicker'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PublishEverywhereButton } from '@/components/social/PublishEverywhereButton'
import type { Plan, PipelineStep, VideoFormat, VideoQuality } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

const FORMAT_OPTIONS: { id: VideoFormat; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: '16:9', label: '16:9', icon: <Monitor className="h-5 w-5" />, desc: 'YouTube, Desktop' },
  { id: '9:16', label: '9:16', icon: <Smartphone className="h-5 w-5" />, desc: 'TikTok, Reels' },
  { id: '1:1', label: '1:1', icon: <Square className="h-5 w-5" />, desc: 'Instagram, Feed' },
]

const QUALITY_OPTIONS: { id: VideoQuality; label: string; minPlan: Plan }[] = [
  { id: '720p', label: '720p', minPlan: 'free' },
  { id: '1080p', label: '1080p', minPlan: 'creator' },
  { id: '4k', label: '4K', minPlan: 'empire' },
]

const STYLE_OPTIONS = [
  { id: 'educatif', label: 'Educatif', emoji: '📚' },
  { id: 'divertissement', label: 'Divertissement', emoji: '🎬' },
  { id: 'motivation', label: 'Motivation', emoji: '🔥' },
  { id: 'storytelling', label: 'Storytelling', emoji: '📖' },
  { id: 'tutoriel', label: 'Tutoriel', emoji: '🎓' },
]

const NICHE_LABELS: Record<string, string> = {
  'bien-etre': 'Bien-etre',
  tech: 'Tech',
  finance: 'Finance',
  motivation: 'Motivation',
  lifestyle: 'Lifestyle',
  education: 'Education',
  divertissement: 'Divertissement',
  cuisine: 'Cuisine',
  sport: 'Sport',
  voyage: 'Voyage',
  science: 'Science',
  business: 'Business',
}

function getPipelineSteps(engine: VideoEngine): PipelineStep[] {
  const engineLabel = engine === 'ltx-pro' ? 'LTX 2.3 Pro' : engine === 'ltx-fast' ? 'LTX 2.3 Fast' : 'WAN 2.2'
  return [
    { id: 'script', label: 'Script genere par Claude', status: 'pending' },
    { id: 'narration', label: 'Narration voix — ElevenLabs', status: 'pending' },
    { id: 'music', label: 'Musique de fond — Suno', status: 'pending' },
    { id: 'scenes', label: `Scenes video IA — ${engineLabel}`, status: 'pending' },
    { id: 'stock', label: 'Videos stock — Pexels', status: 'pending' },
    { id: 'assembly', label: 'Assemblage final — Shotstack', status: 'pending' },
    { id: 'thumbnail', label: 'Miniature', status: 'pending' },
  ]
}

// Manual mode wizard step count (mediaMode added as step 0)
const MANUAL_STEPS = ['mode', 'sujet', 'script', 'medias', 'options', 'confirmation'] as const

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
  const [sceneKeywords, setSceneKeywords] = useState<string[][]>([])
  const [sceneSelections, setSceneSelections] = useState<SceneStockState[]>([])
  const [keywordsLoading, setKeywordsLoading] = useState(false)

  // Pipeline state
  const [isGenerating, setIsGenerating] = useState(false)
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(getPipelineSteps('wan-classic'))
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const plan = (profile?.plan ?? 'free') as Plan
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  const videosUsed = profile?.monthly_video_count ?? 0
  const isOverLimit = plan !== 'admin' && videosUsed >= planLimits.videos

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

  // Extract keywords for stock search when entering medias step in stock/mixed mode
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

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

      // Start polling for pipeline status
      if (result.videoId) {
        pollPipeline(result.videoId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la generation'
      setError(message)
      setIsGenerating(false)
    }
  }, [topic, format, quality, engine, niche, style, voice, mode, script, mediaMode, sceneSelections, isOverLimit])

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

          const hasError = data.steps?.some((s: PipelineStep) => s.status === 'error')
          if (hasError) {
            setError('Certaines etapes ont echoue. Verifie les details ci-dessous.')
          }
          setIsGenerating(false)
        }
      } catch {
        // Silently retry on next poll
      }
    }

    // Initial poll
    poll()
    pollingRef.current = setInterval(poll, 3000)
  }, [])

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
                  setPipelineSteps(getPipelineSteps(engine).map((s) => ({ ...s, status: 'pending' as const })))
                  setVideoId(null)
                  setTopic('')
                  setError(null)
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

/* ============================================================
   AUTO MODE FORM
   ============================================================ */

interface AutoFormProps {
  topic: string
  setTopic: (v: string) => void
  format: VideoFormat
  setFormat: (v: VideoFormat) => void
  quality: VideoQuality
  setQuality: (v: VideoQuality) => void
  engine: VideoEngine
  setEngine: (v: VideoEngine) => void
  niche: string
  setNiche: (v: string) => void
  style: string
  setStyle: (v: string) => void
  voice: string
  setVoice: (v: string) => void
  isQualityAvailable: (plan: Plan) => boolean
  isEngineAvailable: (plan: Plan) => boolean
  isOverLimit: boolean
  onGenerate: () => void
  mediaMode: MediaMode
  setMediaMode: (v: MediaMode) => void
}

function AutoForm({
  topic,
  setTopic,
  format,
  setFormat,
  quality,
  setQuality,
  engine,
  setEngine,
  niche,
  setNiche,
  style,
  setStyle,
  voice,
  setVoice,
  isQualityAvailable,
  isEngineAvailable,
  isOverLimit,
  onGenerate,
  mediaMode,
  setMediaMode,
}: AutoFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Topic */}
      <div>
        <label
          htmlFor="topic-input"
          className="block text-sm font-medium text-white/70 mb-2"
        >
          Sur quel sujet veux-tu creer ta video ?
        </label>
        <textarea
          id="topic-input"
          data-testid="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ex: 5 habitudes matinales des gens productifs, Les secrets de la meditation, Comment creer un business en ligne..."
          rows={4}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/25',
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.06] hover:border-white/[0.12]',
            'focus:border-violet-500/60 focus:shadow-[0_0_15px_rgba(139,92,246,0.15)]',
            'outline-none transition-all duration-200 resize-none'
          )}
        />
        <p className="text-xs text-white/30 mt-1.5">
          Sois precis : plus ta description est detaillee, meilleur sera le resultat.
        </p>
      </div>

      {/* Media Mode */}
      <OptionSection title="Type de medias">
        <MediaModeCards value={mediaMode} onChange={setMediaMode} />
      </OptionSection>

      {/* Format */}
      <OptionSection title="Format">
        <div className="grid grid-cols-3 gap-3">
          {FORMAT_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.id}
              selected={format === opt.id}
              onClick={() => setFormat(opt.id)}
              data-testid={`format-${opt.id.replace(':', 'x')}`}
            >
              {opt.icon}
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="text-[11px] text-white/40">{opt.desc}</span>
            </OptionCard>
          ))}
        </div>
      </OptionSection>

      {/* Quality */}
      <OptionSection title="Qualite">
        <div className="grid grid-cols-3 gap-3">
          {QUALITY_OPTIONS.map((opt) => {
            const available = isQualityAvailable(opt.minPlan)
            return (
              <OptionCard
                key={opt.id}
                selected={quality === opt.id}
                onClick={() => available && setQuality(opt.id)}
                disabled={!available}
                data-testid={`quality-${opt.id}`}
              >
                <span className="text-sm font-semibold">{opt.label}</span>
                {!available && (
                  <span className="text-[10px] text-violet-400">
                    Plan {opt.minPlan}+
                  </span>
                )}
              </OptionCard>
            )
          })}
        </div>
      </OptionSection>

      {/* Video Engine */}
      <OptionSection title="Moteur video">
        <div className="grid grid-cols-3 gap-3">
          {VIDEO_ENGINES.map((eng) => {
            const available = isEngineAvailable(eng.minPlan)
            return (
              <OptionCard
                key={eng.id}
                selected={engine === eng.id}
                onClick={() => available && setEngine(eng.id as VideoEngine)}
                disabled={!available}
                data-testid={`engine-${eng.id}`}
              >
                <span className="text-lg">{eng.icon}</span>
                <span className="text-sm font-semibold">{eng.label}</span>
                <span className="text-[11px] text-white/40">{eng.description}</span>
                {!available && (
                  <span className="text-[10px] text-violet-400">
                    Plan {eng.minPlan}+
                  </span>
                )}
              </OptionCard>
            )
          })}
        </div>
      </OptionSection>

      {/* Niche */}
      <OptionSection title="Niche">
        <select
          data-testid="niche-select"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-sm text-white/90',
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.06] hover:border-white/[0.12]',
            'focus:border-violet-500/60 outline-none transition-all duration-200',
            'appearance-none cursor-pointer'
          )}
        >
          <option value="" className="bg-[#0c0b14] text-white/70">
            Choisir une niche (optionnel)
          </option>
          {NICHES.map((n) => (
            <option key={n} value={n} className="bg-[#0c0b14] text-white">
              {NICHE_LABELS[n] ?? n}
            </option>
          ))}
        </select>
      </OptionSection>

      {/* Style */}
      <OptionSection title="Style de video">
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              data-testid={`style-${opt.id}`}
              onClick={() => setStyle(style === opt.id ? '' : opt.id)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
                style === opt.id
                  ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70 hover:border-white/[0.12]'
              )}
            >
              <span className="mr-1.5">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </OptionSection>

      {/* Voice */}
      <OptionSection title="Voix">
        <select
          data-testid="voice-select"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className={cn(
            'w-full px-4 py-3 rounded-xl text-sm text-white/90',
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.06] hover:border-white/[0.12]',
            'focus:border-violet-500/60 outline-none transition-all duration-200',
            'appearance-none cursor-pointer'
          )}
        >
          {VOICE_STYLES.map((v) => (
            <option key={v.id} value={v.id} className="bg-[#0c0b14] text-white">
              {v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})
            </option>
          ))}
        </select>
      </OptionSection>

      {/* Generate Button */}
      <div className="pt-4">
        <Button
          data-testid="create-button"
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!topic.trim() || isOverLimit}
          onClick={onGenerate}
        >
          <Sparkles className="h-5 w-5" />
          Generer ma video
        </Button>
      </div>
    </motion.div>
  )
}

/* ============================================================
   MANUAL MODE FORM (Wizard)
   ============================================================ */

interface ManualFormProps extends AutoFormProps {
  script: string
  setScript: (v: string) => void
  step: number
  setStep: (v: number) => void
  sceneKeywords: string[][]
  sceneSelections: SceneStockState[]
  setSceneSelections: React.Dispatch<React.SetStateAction<SceneStockState[]>>
  keywordsLoading: boolean
}

function ManualForm({
  topic,
  setTopic,
  script,
  setScript,
  format,
  setFormat,
  quality,
  setQuality,
  engine,
  setEngine,
  niche,
  setNiche,
  style,
  setStyle,
  voice,
  setVoice,
  isQualityAvailable,
  isEngineAvailable,
  isOverLimit,
  step,
  setStep,
  onGenerate,
  mediaMode,
  setMediaMode,
  sceneKeywords,
  sceneSelections,
  setSceneSelections,
  keywordsLoading,
}: ManualFormProps) {
  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return true // mediaMode always has a default
      case 1:
        return topic.trim().length > 0
      case 2:
        return script.trim().length > 0
      case 3:
        return true
      case 4:
        return true
      case 5:
        return !isOverLimit
      default:
        return false
    }
  }

  const formatToOrientation = (f: VideoFormat): 'landscape' | 'portrait' | 'square' =>
    f === '16:9' ? 'landscape' : f === '9:16' ? 'portrait' : 'square'

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 justify-center">
        {MANUAL_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                'h-8 w-8 rounded-full text-xs font-semibold flex items-center justify-center transition-all duration-200 border',
                i === step
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : i < step
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/30'
              )}
            >
              {i + 1}
            </button>
            {i < MANUAL_STEPS.length - 1 && (
              <div
                className={cn(
                  'w-8 h-px',
                  i < step ? 'bg-emerald-500/40' : 'bg-white/[0.06]'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 1 — Type de medias
              </h2>
              <p className="text-sm text-white/40">
                Choisis comment composer ta video : 100% IA, 100% reel ou un mix.
              </p>
              <MediaModeCards value={mediaMode} onChange={setMediaMode} />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 2 — Sujet
              </h2>
              <textarea
                data-testid="topic-input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Decris le sujet de ta video..."
                rows={4}
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/25',
                  'bg-white/[0.03] backdrop-blur-xl',
                  'border border-white/[0.06] hover:border-white/[0.12]',
                  'focus:border-violet-500/60 outline-none transition-all duration-200 resize-none'
                )}
              />
              <OptionSection title="Niche">
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm text-white/90',
                    'bg-white/[0.03] border border-white/[0.06]',
                    'focus:border-violet-500/60 outline-none transition-all duration-200',
                    'appearance-none cursor-pointer'
                  )}
                >
                  <option value="" className="bg-[#0c0b14]">
                    Choisir une niche
                  </option>
                  {NICHES.map((n) => (
                    <option key={n} value={n} className="bg-[#0c0b14]">
                      {NICHE_LABELS[n] ?? n}
                    </option>
                  ))}
                </select>
              </OptionSection>
              <OptionSection title="Style">
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setStyle(style === opt.id ? '' : opt.id)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200',
                        style === opt.id
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
                      )}
                    >
                      <span className="mr-1.5">{opt.emoji}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </OptionSection>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 3 — Script
              </h2>
              <p className="text-sm text-white/40">
                Ecris ou colle ton script. Chaque paragraphe deviendra une scene.
              </p>
              <textarea
                data-testid="script-input"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Ecris ton script ici... Chaque paragraphe sera une scene distincte."
                rows={12}
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/25',
                  'bg-white/[0.03] backdrop-blur-xl',
                  'border border-white/[0.06] hover:border-white/[0.12]',
                  'focus:border-violet-500/60 outline-none transition-all duration-200 resize-none',
                  'font-mono'
                )}
              />
              <p className="text-xs text-white/30">
                {script.split('\n').filter((l) => l.trim()).length} scene(s) detectee(s)
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 4 — Medias
              </h2>
              <p className="text-sm text-white/40">
                {mediaMode === 'ai'
                  ? 'Tu peux uploader tes propres fichiers ou laisser l\u2019IA les generer.'
                  : 'Choisis un media reel par scene. Bouton "Generer IA" comme fallback.'}
              </p>

              {mediaMode === 'ai' ? (
                <>
                  <UploadZone icon={Mic} label="Voix off" accept="audio/*" testId="upload-voice" />
                  <UploadZone icon={Music} label="Musique de fond" accept="audio/*" testId="upload-music" />
                  <UploadZone icon={FileVideo} label="Clips video" accept="video/*" testId="upload-clips" multiple />
                </>
              ) : keywordsLoading ? (
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-6 text-center text-white/60 text-sm">
                  Extraction des mots-cles par l&apos;IA...
                </div>
              ) : sceneSelections.length === 0 ? (
                <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-6 text-center text-sm text-amber-200">
                  Ecris d&apos;abord ton script (etape precedente) pour generer les recherches stock.
                </div>
              ) : (
                <div className="space-y-3" data-testid="stock-pickers">
                  {sceneSelections.map((sel, i) => {
                    const sceneText =
                      script
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)[i] ?? ''
                    return (
                      <SceneStockPicker
                        key={i}
                        sceneIndex={i}
                        sceneText={sceneText}
                        keywords={sceneKeywords[i] ?? []}
                        orientation={formatToOrientation(format)}
                        selected={sel.selected}
                        fallbackToAI={sel.fallbackToAI}
                        allowFallback={mediaMode === 'mixed' || mediaMode === 'stock'}
                        onSelect={(r) =>
                          setSceneSelections((prev) =>
                            prev.map((s, j) =>
                              j === i ? { selected: r, fallbackToAI: false } : s
                            )
                          )
                        }
                        onFallbackAI={() =>
                          setSceneSelections((prev) =>
                            prev.map((s, j) =>
                              j === i
                                ? { selected: null, fallbackToAI: !s.fallbackToAI }
                                : s
                            )
                          )
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 5 — Options
              </h2>

              <OptionSection title="Format">
                <div className="grid grid-cols-3 gap-3">
                  {FORMAT_OPTIONS.map((opt) => (
                    <OptionCard
                      key={opt.id}
                      selected={format === opt.id}
                      onClick={() => setFormat(opt.id)}
                    >
                      {opt.icon}
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[11px] text-white/40">{opt.desc}</span>
                    </OptionCard>
                  ))}
                </div>
              </OptionSection>

              <OptionSection title="Qualite">
                <div className="grid grid-cols-3 gap-3">
                  {QUALITY_OPTIONS.map((opt) => {
                    const available = isQualityAvailable(opt.minPlan)
                    return (
                      <OptionCard
                        key={opt.id}
                        selected={quality === opt.id}
                        onClick={() => available && setQuality(opt.id)}
                        disabled={!available}
                      >
                        <span className="text-sm font-semibold">{opt.label}</span>
                        {!available && (
                          <span className="text-[10px] text-violet-400">
                            Plan {opt.minPlan}+
                          </span>
                        )}
                      </OptionCard>
                    )
                  })}
                </div>
              </OptionSection>

              <OptionSection title="Moteur video">
                <div className="grid grid-cols-3 gap-3">
                  {VIDEO_ENGINES.map((eng) => {
                    const available = isEngineAvailable(eng.minPlan)
                    return (
                      <OptionCard
                        key={eng.id}
                        selected={engine === eng.id}
                        onClick={() => available && setEngine(eng.id as VideoEngine)}
                        disabled={!available}
                      >
                        <span className="text-lg">{eng.icon}</span>
                        <span className="text-sm font-semibold">{eng.label}</span>
                        {!available && (
                          <span className="text-[10px] text-violet-400">
                            Plan {eng.minPlan}+
                          </span>
                        )}
                      </OptionCard>
                    )
                  })}
                </div>
              </OptionSection>

              <OptionSection title="Voix">
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm text-white/90',
                    'bg-white/[0.03] border border-white/[0.06]',
                    'focus:border-violet-500/60 outline-none transition-all duration-200',
                    'appearance-none cursor-pointer'
                  )}
                >
                  {VOICE_STYLES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-[#0c0b14]">
                      {v.name} ({v.gender === 'male' ? 'Homme' : 'Femme'})
                    </option>
                  ))}
                </select>
              </OptionSection>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 6 — Confirmation
              </h2>

              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
                <SummaryRow
                  label="Type de medias"
                  value={
                    mediaMode === 'ai'
                      ? '100% IA'
                      : mediaMode === 'stock'
                        ? '100% Reel'
                        : 'Mixte'
                  }
                />
                <SummaryRow label="Sujet" value={topic || '—'} />
                <SummaryRow
                  label="Script"
                  value={
                    script
                      ? `${script.split('\n').filter((l) => l.trim()).length} scene(s)`
                      : 'Genere par IA'
                  }
                />
                <SummaryRow label="Format" value={format} />
                <SummaryRow label="Qualite" value={quality} />
                <SummaryRow label="Moteur" value={VIDEO_ENGINES.find((e) => e.id === engine)?.label ?? engine} />
                <SummaryRow label="Niche" value={niche ? (NICHE_LABELS[niche] ?? niche) : 'Aucune'} />
                <SummaryRow
                  label="Voix"
                  value={VOICE_STYLES.find((v) => v.id === voice)?.name ?? voice}
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="ghost"
          size="md"
          disabled={step === 0}
          onClick={() => setStep(Math.max(0, step - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Precedent
        </Button>

        {step < MANUAL_STEPS.length - 1 ? (
          <Button
            variant="primary"
            size="md"
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            data-testid="create-button"
            variant="primary"
            size="lg"
            disabled={!canProceed()}
            onClick={onGenerate}
          >
            <Sparkles className="h-5 w-5" />
            Generer ma video
          </Button>
        )}
      </div>
    </motion.div>
  )
}

/* ============================================================
   SHARED SUB-COMPONENTS
   ============================================================ */

function OptionSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-sm font-medium text-white/70 mb-3">{title}</p>
      {children}
    </div>
  )
}

function OptionCard({
  selected,
  onClick,
  disabled,
  children,
  'data-testid': testId,
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  'data-testid'?: string
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all duration-200 text-center',
        selected
          ? 'bg-violet-600/15 border-violet-500/40 text-white shadow-sm shadow-violet-500/10'
          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/[0.12] hover:text-white/70',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

function UploadZone({
  icon: Icon,
  label,
  accept,
  testId,
  multiple,
}: {
  icon: React.ElementType
  label: string
  accept: string
  testId: string
  multiple?: boolean
}) {
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <label
      data-testid={testId}
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border border-dashed cursor-pointer transition-all duration-200',
        fileName
          ? 'bg-violet-500/5 border-violet-500/30'
          : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]'
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/70">{label}</p>
        <p className="text-xs text-white/30 truncate">
          {fileName ?? 'Clique pour uploader ou glisse un fichier'}
        </p>
      </div>
      <Upload className="h-4 w-4 text-white/20 shrink-0" />
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            setFileName(
              files.length === 1
                ? files[0].name
                : `${files.length} fichiers`
            )
          }
        }}
      />
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-medium">{value}</span>
    </div>
  )
}

function CreateSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <Skeleton width="240px" height={32} rounded="lg" className="mx-auto" />
        <Skeleton width="320px" height={16} rounded="md" className="mx-auto" />
      </div>
      <div className="flex justify-center">
        <Skeleton width={280} height={48} rounded="xl" />
      </div>
      <Skeleton width="100%" height={120} rounded="xl" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={80} rounded="xl" />
        ))}
      </div>
      <Skeleton width="100%" height={48} rounded="xl" />
    </div>
  )
}
