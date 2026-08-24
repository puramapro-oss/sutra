'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { NICHES, VOICE_STYLES, VIDEO_ENGINES } from '@/lib/constants'
import { NICHE_LABELS } from '@/lib/create-utils'
import { FORMAT_OPTIONS, QUALITY_OPTIONS, STYLE_OPTIONS } from '@/lib/create-constants'
import { cn } from '@/lib/utils'
import { MediaModeCards, type MediaMode } from '@/components/create/MediaModeCards'
import { OptionSection, OptionCard } from '@/components/create/CreateHelpers'
import { Button } from '@/components/ui/Button'
import type { Plan, VideoFormat, VideoQuality } from '@/types'
import type { VideoEngine } from '@/lib/ltx'

export interface AutoFormProps {
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

export default function AutoForm({
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
