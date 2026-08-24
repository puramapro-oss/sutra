'use client'

import { cn } from '@/lib/utils'
import { TEMPLATES, TONE_OPTIONS } from '@/lib/production-constants'
import { VIDEO_ENGINES } from '@/lib/constants'
import SectionCard from './SectionCard'
import type { TemplateId } from '@/types/production'
import type { VideoEngine } from '@/lib/ltx'
import type { Plan } from '@/types'

interface IdeaStepProps {
  template: TemplateId
  setTemplate: (template: TemplateId) => void
  idea: string
  setIdea: (idea: string) => void
  tone: string
  setTone: (tone: string) => void
  engine: VideoEngine
  setEngine: (engine: VideoEngine) => void
  currentPlanRank: number
  planRank: Record<Plan, number>
}

export default function IdeaStep({
  template,
  setTemplate,
  idea,
  setIdea,
  tone,
  setTone,
  engine,
  setEngine,
  currentPlanRank,
  planRank,
}: IdeaStepProps) {
  return (
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
          {TONE_OPTIONS.map((t) => (
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
  )
}
