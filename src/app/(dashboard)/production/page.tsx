'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Loader2,
  Play,
  Download,
  FileText,
  Film,
  Mic,
  Music,
  Layers,
  ImageIcon,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProductionGeneration } from '@/hooks/useProductionGeneration'
import { VIDEO_ENGINES } from '@/lib/constants'
import { TEMPLATES, STEPS } from '@/lib/production-constants'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import StepProgressBar from '@/components/production/StepProgressBar'
import IdeaStep from '@/components/production/IdeaStep'
import ScriptStep from '@/components/production/ScriptStep'
import StepGenerateCard from '@/components/production/StepGenerateCard'
import VoiceStep from '@/components/production/VoiceStep'
import MusicStep from '@/components/production/MusicStep'
import ThumbnailStep from '@/components/production/ThumbnailStep'
import type { Plan } from '@/types'
import type { VideoEngine } from '@/lib/ltx'
import type { TemplateId } from '@/types/production'

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
  const [voice, setVoice] = useState<string>('rachel')
  const [musicStyle, setMusicStyle] = useState('cinematic')

  const plan = (profile?.plan ?? 'free') as Plan
  const planRank: Record<Plan, number> = { free: 0, starter: 1, creator: 2, empire: 3, enterprise: 3, admin: 4 }
  const currentPlanRank = planRank[plan] ?? 0

  const selectedTemplate = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0]

  const { stepStatus, generatedData, error, isGenerating, generateStep, generateAll } = useProductionGeneration({
    idea,
    template,
    format: selectedTemplate.format,
    engine,
    voice,
    musicStyle,
    tone,
    currentStep,
    setCurrentStep,
  })

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
      <StepProgressBar
        currentStep={currentStep}
        stepStatus={stepStatus}
        onStepClick={setCurrentStep}
      />

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
            <IdeaStep
              template={template}
              setTemplate={setTemplate}
              idea={idea}
              setIdea={setIdea}
              tone={tone}
              setTone={setTone}
              engine={engine}
              setEngine={setEngine}
              currentPlanRank={currentPlanRank}
              planRank={planRank}
            />
          )}

          {/* Step 1: Script */}
          {currentStep === 1 && (
            <ScriptStep
              status={stepStatus.script}
              generatedData={generatedData}
              idea={idea}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('script')}
              selectedTemplateName={selectedTemplate.label}
            />
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
              disabledMessage="Genere le script d&apos;abord"
              data={generatedData.video}
            />
          )}

          {/* Step 3: Voice */}
          {currentStep === 3 && (
            <VoiceStep
              voice={voice}
              setVoice={setVoice}
              status={stepStatus.voice}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('voice')}
              scriptStatus={stepStatus.script}
              generatedData={generatedData}
            />
          )}

          {/* Step 4: Music */}
          {currentStep === 4 && (
            <MusicStep
              musicStyle={musicStyle}
              setMusicStyle={setMusicStyle}
              status={stepStatus.music}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('music')}
              generatedData={generatedData}
            />
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
              disabledMessage="Genere les scenes et la narration d&apos;abord"
              data={generatedData.assembly}
            />
          )}

          {/* Step 6: Thumbnail */}
          {currentStep === 6 && (
            <ThumbnailStep
              status={stepStatus.thumbnail}
              isGenerating={isGenerating}
              onGenerate={() => generateStep('thumbnail')}
              assemblyStatus={stepStatus.assembly}
              generatedData={generatedData}
              onViewLibrary={() => router.push('/library')}
              onPublish={() => router.push('/publish')}
            />
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
