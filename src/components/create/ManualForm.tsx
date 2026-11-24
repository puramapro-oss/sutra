'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronRight, ChevronLeft } from 'lucide-react'
import ManualFormStep3 from "./wizard/ManualFormStep3"
import ManualFormStep1 from "./wizard/ManualFormStep1"
import ManualFormStep4 from "./wizard/ManualFormStep4"
import { VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { MANUAL_STEPS, NICHE_LABELS } from '@/lib/create-utils'
import { cn } from '@/lib/utils'
import { MediaModeCards } from '@/components/create/MediaModeCards'
import { type StockResult } from '@/components/create/StockPicker'
import { SummaryRow } from '@/components/create/CreateHelpers'
import { Button } from '@/components/ui/Button'
import type { AutoFormProps } from './AutoForm'

interface SceneStockState {
  selected: StockResult | null
  fallbackToAI: boolean
}

export interface ManualFormProps extends AutoFormProps {
  script: string
  setScript: (v: string) => void
  step: number
  setStep: (v: number) => void
  sceneKeywords: string[][]
  sceneSelections: SceneStockState[]
  setSceneSelections: React.Dispatch<React.SetStateAction<SceneStockState[]>>
  keywordsLoading: boolean
}

export default function ManualForm({
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Step indicator */}
      <nav aria-label="Étapes de création manuelle" className="grid grid-cols-6 gap-1">
        {MANUAL_STEPS.map((s, i) => (
          <div key={s} className="min-w-0">
            <button
              type="button"
              aria-label={`${i + 1}. ${s}`}
              aria-current={i === step ? 'step' : undefined}
              disabled={i > step}
              onClick={() => setStep(i)}
              className={cn(
                'h-11 w-full rounded-xl text-xs font-semibold flex items-center justify-center transition-all duration-200 border',
                i === step
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : i < step
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/[0.03] border-white/[0.06] text-white/65'
              )}
            >
              {i + 1}
            </button>

          </div>
        ))}
      </nav>

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
              <p className="text-sm text-white/65">
                Choisis comment composer ta video : 100% IA, 100% reel ou un mix.
              </p>
              <MediaModeCards value={mediaMode} onChange={setMediaMode} />
            </div>
          )}

          {step === 1 && <ManualFormStep1 topic={topic} setTopic={setTopic} niche={niche} setNiche={setNiche} style={style} setStyle={setStyle} />}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white font-[var(--font-display)]">
                Etape 3 — Script
              </h2>
              <p className="text-sm text-white/65">
                Ecris ou colle ton script. Chaque paragraphe deviendra une scene.
              </p>
              <textarea
                data-testid="script-input"
                aria-label="Script de la vidéo"
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
              <p className="text-xs text-white/65">
                {script.split('\n').filter((l) => l.trim()).length} scene(s) detectee(s)
              </p>
            </div>
          )}

          {step === 3 && <ManualFormStep3 mediaMode={mediaMode} keywordsLoading={keywordsLoading} sceneSelections={sceneSelections} script={script} format={format} sceneKeywords={sceneKeywords} setSceneSelections={setSceneSelections} />}
          {step === 4 && <ManualFormStep4 format={format} setFormat={setFormat} quality={quality} setQuality={setQuality} engine={engine} setEngine={setEngine} voice={voice} setVoice={setVoice} isQualityAvailable={isQualityAvailable} isEngineAvailable={isEngineAvailable} />}
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
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
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
