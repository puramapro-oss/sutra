'use client'

import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import SectionCard from './SectionCard'

interface StepGenerateCardProps {
  title: string
  description: string
  status: string
  isGenerating: boolean
  onGenerate: () => void
  buttonLabel: string
  buttonIcon: React.ComponentType<{ className?: string }>
  disabled: boolean
  disabledMessage?: string
  data?: unknown
}

export default function StepGenerateCard({
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
}: StepGenerateCardProps) {
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
