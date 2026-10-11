'use client'

import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS } from '@/lib/production-constants'
import type { ProductionStep, StepStatus } from '@/types/production'

interface StepProgressBarProps {
  currentStep: number
  stepStatus: Record<ProductionStep, StepStatus>
  onStepClick: (step: number) => void
}

export default function StepProgressBar({ currentStep, stepStatus, onStepClick }: StepProgressBarProps) {
  return (
    <nav aria-label="Étapes de production" className="grid grid-cols-7 gap-1">
      {STEPS.map((step, i) => {
        const status = stepStatus[step.id]
        const Icon = step.icon
        return (
          <div key={step.id} className="min-w-0">
            <button
              type="button"
              aria-label={`${i + 1}. ${step.label}${status === 'done' ? ' — terminé' : status === 'error' ? ' — échec' : ''}`}
              aria-current={i === currentStep ? 'step' : undefined}
              title={step.label}
              onClick={() => onStepClick(i)}
              className={cn(
                'flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 p-1 sm:p-2 rounded-lg transition-all duration-200 w-full',
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
          </div>
        )
      })}
    </nav>
  )
}
