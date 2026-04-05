'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb,
  FileText,
  Film,
  Mic,
  Music,
  Layers,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Loader2,
  Play,
  Download,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Plan } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProductionStep = 'idea' | 'script' | 'video' | 'voice' | 'music' | 'assembly' | 'thumbnail'

interface StepConfig {
  id: ProductionStep
  label: string
  description: string
  icon: React.ElementType
}

type TemplateId = 'youtube' | 'tiktok' | 'reel' | 'docu' | 'tuto'

interface Template {
  id: TemplateId
  label: string
  format: '16:9' | '9:16' | '1:1'
  duration: string
  description: string
}

const STEPS: StepConfig[] = [
  { id: 'idea', label: 'Idee', description: 'Decris ton projet', icon: Lightbulb },
  { id: 'script', label: 'Script', description: 'Claude genere le script', icon: FileText },
  { id: 'video', label: 'Video', description: 'LTX genere les scenes', icon: Film },
  { id: 'voice', label: 'Voix', description: 'ElevenLabs narration', icon: Mic },
  { id: 'music', label: 'Musique', description: 'Suno cree l\'ambiance', icon: Music },
  { id: 'assembly', label: 'Montage', description: 'Shotstack assemble', icon: Layers },
  { id: 'thumbnail', label: 'Miniature', description: 'Pollinations genere', icon: ImageIcon },
]

const TEMPLATES: Template[] = [
  { id: 'youtube', label: 'YouTube', format: '16:9', duration: '8-12 min', description: 'Video longue, educative ou divertissante' },
  { id: 'tiktok', label: 'TikTok', format: '9:16', duration: '30-60s', description: 'Court, percutant, vertical' },
  { id: 'reel', label: 'Reel', format: '9:16', duration: '15-30s', description: 'Ultra-court, tendance Instagram' },
  { id: 'docu', label: 'Documentaire', format: '16:9', duration: '10-20 min', description: 'Narration profonde, images cinematiques' },
  { id: 'tuto', label: 'Tutoriel', format: '16:9', duration: '3-8 min', description: 'Pas a pas, ecran + narration' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductionPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0)
  const [template, setTemplate] = useState<TemplateId>('youtube')
  const [idea, setIdea] = useState('')
  const [tone, setTone] = useState('professionnel')
  const [engine, setEngine] = useState<VideoEngine>('ltx-fast')
  const [voice, setVoice] = useState<string>(VOICE_STYLES[0].id)
  const [musicStyle, setMusicStyle] = useState('cinematic')

  // Generation state per step
  const [stepStatus, setStepStatus] = useState<Record<ProductionStep, 'pending' | 'generating' | 'done' | 'error'>>({
    idea: 'pending', script: 'pending', video: 'pending',
    voice: 'pending', music: 'pending', assembly: 'pending', thumbnail: 'pending',
  })
  const [generatedData, setGeneratedData] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const plan = (profile?.plan ?? 'free') as Plan
  const planRank: Record<Plan, number> = { free: 0, starter: 1, creator: 2, empire: 3, enterprise: 3, admin: 4 }
  const currentPlanRank = planRank[plan] ?? 0

  const selectedTemplate = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]
  const currentStepConfig = STEPS[currentStep]

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
          template: template,
          format: selectedTemplate.format,
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
  }, [idea, template, selectedTemplate.format, engine, voice, musicStyle, tone, generatedData, currentStep])

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
          template: template,
          format: selectedTemplate.format,
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
  }, [idea, template, selectedTemplate.format, engine, voice, musicStyle, tone])

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <Skeleton width="300px" height={32} rounded="lg" className="mx-auto" />
        <Skeleton width="100%" height={200} rounded="xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto space-y-8 pb-20"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl lg:text-3xl font-bold text-white font-[var(--font-display)]">
          Mode Production
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Pipeline complet : de l&apos;idee a la video finale, etape par etape.
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="flex items-center gap-1 px-4">
        {STEPS.map((step, i) => {
          const status = stepStatus[step.id]
          const Icon = step.icon
          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => setCurrentStep(i)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-full',
                  i === currentStep ? 'bg-violet-500/10' : 'hover:bg-white/[0.03]'
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center text-xs border transition-all',
                  status === 'done' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                  status === 'generating' ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 animate-pulse' :
                  status === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                  i === currentStep ? 'bg-violet-600 border-violet-500 text-white' :
                  'bg-white/[0.03] border-white/[0.06] text-white/30'
                )}>
                  {status === 'done' ? <Check className="h-3.5 w-3.5" /> :
                   status === 'generating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                   <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className={cn(
                  'text-[10px] font-medium hidden sm:block',
                  i === currentStep ? 'text-white/80' : 'text-white/30'
                )}>
                  {step.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'h-px flex-1 min-w-2',
                  status === 'done' ? 'bg-emerald-500/40' : 'bg-white/[0.06]'
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Step 0: Idea */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <SectionCard title="Template de production">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      data-testid={`template-${t.id}`}
                      onClick={() => setTemplate(t.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 text-center',
                        template === t.id
                          ? 'bg-violet-600/15 border-violet-500/40 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/[0.12]'
                      )}
                    >
                      <span className="text-sm font-semibold">{t.label}</span>
                      <span className="text-[10px] text-white/40">{t.format} - {t.duration}</span>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Decris ton idee de video">
                <textarea
                  data-testid="production-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Ex: Une video documentaire sur les volcans sous-marins, avec des images cinematiques et une narration captivante..."
                  rows={5}
                  className={cn(
                    'w-full px-4 py-3 rounded-xl text-sm text-white/90 placeholder-white/25',
                    'bg-white/[0.03] backdrop-blur-xl',
                    'border border-white/[0.06] hover:border-white/[0.12]',
                    'focus:border-violet-500/60 outline-none transition-all duration-200 resize-none'
                  )}
                />
              </SectionCard>

              <SectionCard title="Ton et style">
                <div className="flex flex-wrap gap-2">
                  {['professionnel', 'decontracte', 'dramatique', 'educatif', 'humoristique', 'inspirant'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 capitalize',
                        tone === t
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Moteur video">
                <div className="grid grid-cols-3 gap-3">
                  {VIDEO_ENGINES.map((eng) => {
                    const available = currentPlanRank >= (planRank[eng.minPlan] ?? 0)
                    return (
                      <button
                        key={eng.id}
                        data-testid={`prod-engine-${eng.id}`}
                        onClick={() => available && setEngine(eng.id as VideoEngine)}
                        disabled={!available}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all duration-200',
                          engine === eng.id
                            ? 'bg-violet-600/15 border-violet-500/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/50 hover:border-white/[0.12]',
                          !available && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        <span className="text-lg">{eng.icon}</span>
                        <span className="text-sm font-semibold">{eng.label}</span>
                        <span className="text-[11px] text-white/40">{eng.description}</span>
                        {!available && <span className="text-[10px] text-violet-400">Plan {eng.minPlan}+</span>}
                      </button>
                    )
                  })}
                </div>
              </SectionCard>
            </div>
          )}

          {/* Step 1: Script */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <SectionCard title="Script genere par Claude">
                {stepStatus.script === 'done' && generatedData.script ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                      <pre className="text-sm text-white/80 whitespace-pre-wrap font-mono">
                        {typeof generatedData.script === 'object'
                          ? JSON.stringify(generatedData.script, null, 2)
                          : String(generatedData.script)}
                      </pre>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateStep('script')}
                    >
                      Regenerer le script
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-white/40 mb-4">
                      Claude va ecrire un script complet base sur ton idee et le template {selectedTemplate.label}.
                    </p>
                    <Button
                      data-testid="generate-script"
                      variant="primary"
                      size="lg"
                      disabled={!idea.trim() || isGenerating}
                      onClick={() => generateStep('script')}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      Generer le script
                    </Button>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* Step 2: Video */}
          {currentStep === 2 && (
            <StepGenerateCard
              title={`Scenes video — ${VIDEO_ENGINES.find((e) => e.id === engine)?.label ?? engine}`}
              description="Generation des clips video IA pour chaque scene du script."
              status={stepStatus.video}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('video')}
              buttonLabel="Generer les scenes"
              buttonIcon={Film}
              disabled={stepStatus.script !== 'done'}
              disabledMessage="Genere le script d'abord"
              data={generatedData.video}
            />
          )}

          {/* Step 3: Voice */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <SectionCard title="Voix de narration">
                <div className="mb-4">
                  <select
                    data-testid="prod-voice-select"
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
                </div>
              </SectionCard>
              <StepGenerateCard
                title="Narration ElevenLabs"
                description="Generation de la voix off a partir du script."
                status={stepStatus.voice}
                isGenerating={isGenerating}
                onGenerate={() => generateStep('voice')}
                buttonLabel="Generer la narration"
                buttonIcon={Mic}
                disabled={stepStatus.script !== 'done'}
                disabledMessage="Genere le script d'abord"
                data={generatedData.voice}
              />
            </div>
          )}

          {/* Step 4: Music */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <SectionCard title="Style musical">
                <div className="flex flex-wrap gap-2">
                  {['cinematic', 'lo-fi', 'epic', 'chill', 'motivational', 'dramatic', 'upbeat', 'ambient'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setMusicStyle(s)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 capitalize',
                        musicStyle === s
                          ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/70'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </SectionCard>
              <StepGenerateCard
                title="Musique Suno"
                description="Generation de musique de fond instrumentale."
                status={stepStatus.music}
                isGenerating={isGenerating}
                onGenerate={() => generateStep('music')}
                buttonLabel="Generer la musique"
                buttonIcon={Music}
                disabled={false}
                data={generatedData.music}
              />
            </div>
          )}

          {/* Step 5: Assembly */}
          {currentStep === 5 && (
            <StepGenerateCard
              title="Assemblage final — Shotstack"
              description="Combine video, voix et musique en une video finale."
              status={stepStatus.assembly}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('assembly')}
              buttonLabel="Assembler la video"
              buttonIcon={Layers}
              disabled={stepStatus.video !== 'done' || stepStatus.voice !== 'done'}
              disabledMessage="Genere les scenes et la narration d'abord"
              data={generatedData.assembly}
            />
          )}

          {/* Step 6: Thumbnail */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <StepGenerateCard
                title="Miniature — Pollinations"
                description="Generation d'une miniature attractive pour ta video."
                status={stepStatus.thumbnail}
                isGenerating={isGenerating}
                onGenerate={() => generateStep('thumbnail')}
                buttonLabel="Generer la miniature"
                buttonIcon={ImageIcon}
                disabled={stepStatus.assembly !== 'done'}
                disabledMessage="Assemble la video d'abord"
                data={generatedData.thumbnail}
              />

              {/* Final actions */}
              {stepStatus.thumbnail === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center pt-4"
                >
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => router.push('/library')}
                  >
                    <Play className="h-4 w-4" />
                    Voir dans ma bibliotheque
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => router.push('/publish')}
                  >
                    <Download className="h-4 w-4" />
                    Publier
                  </Button>
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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

      {/* Navigation + Generate All */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="ghost"
          size="md"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
          Precedent
        </Button>

        {currentStep === 0 && (
          <Button
            data-testid="generate-all"
            variant="primary"
            size="lg"
            disabled={!idea.trim() || isGenerating}
            onClick={generateAll}
          >
            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Tout generer
          </Button>
        )}

        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setCurrentStep(currentStep + 1)}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white/70">{title}</h3>
      {children}
    </div>
  )
}

function StepGenerateCard({
  title,
  description,
  status,
  isGenerating,
  onGenerate,
  buttonLabel,
  buttonIcon: Icon,
  disabled,
  disabledMessage,
  data,
}: {
  title: string
  description: string
  status: string
  isGenerating: boolean
  onGenerate: () => void
  buttonLabel: string
  buttonIcon: React.ElementType
  disabled: boolean
  disabledMessage?: string
  data?: unknown
}) {
  return (
    <SectionCard title={title}>
      {status === 'done' && data ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <Check className="h-4 w-4" />
            <span>Generation terminee</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onGenerate}>
            Regenerer
          </Button>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-white/40 mb-4">{description}</p>
          {disabled && disabledMessage ? (
            <p className="text-xs text-white/30 italic">{disabledMessage}</p>
          ) : (
            <Button
              variant="primary"
              size="lg"
              disabled={disabled || isGenerating}
              onClick={onGenerate}
            >
              {isGenerating && status === 'generating' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {buttonLabel}
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  )
}
