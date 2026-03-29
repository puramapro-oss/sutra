'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { PipelineStep } from '@/types'

interface PipelineProgressProps {
  steps: PipelineStep[]
  className?: string
  'data-testid'?: string
}

const statusIcon = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  error: XCircle,
}

const statusColor = {
  pending: 'text-white/30',
  running: 'text-violet-400',
  completed: 'text-emerald-400',
  error: 'text-red-400',
}

const statusBg = {
  pending: 'bg-white/[0.03] border-white/[0.06]',
  running: 'bg-violet-500/5 border-violet-500/20',
  completed: 'bg-emerald-500/5 border-emerald-500/20',
  error: 'bg-red-500/5 border-red-500/20',
}

// Steps 2, 3, 4 (indices 1, 2, 3) run in parallel
const PARALLEL_IDS = ['narration', 'music', 'scenes']

export function PipelineProgress({
  steps,
  className,
  'data-testid': testId = 'pipeline-progress',
}: PipelineProgressProps) {
  const [elapsed, setElapsed] = useState(0)

  const completedCount = steps.filter((s) => s.status === 'completed').length
  const hasError = steps.some((s) => s.status === 'error')
  const isComplete = completedCount === steps.length && steps.length > 0
  const isRunning = steps.some((s) => s.status === 'running')
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0

  useEffect(() => {
    if (!isRunning && !isComplete) return

    if (isComplete || hasError) return

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isComplete, hasError])

  const formatElapsed = (s: number): string => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // Group parallel steps together
  const renderSteps = () => {
    const rendered: React.ReactNode[] = []
    let i = 0

    while (i < steps.length) {
      const step = steps[i]
      const isParallel = PARALLEL_IDS.includes(step.id)

      if (isParallel) {
        // Collect all consecutive parallel steps
        const parallelGroup: PipelineStep[] = []
        while (i < steps.length && PARALLEL_IDS.includes(steps[i].id)) {
          parallelGroup.push(steps[i])
          i++
        }

        rendered.push(
          <div key="parallel-group" className="relative">
            <div className="absolute left-0 top-2 bottom-2 w-px bg-violet-500/20 ml-[18px]" />
            <div className="flex items-center gap-2 mb-2 ml-1">
              <Sparkles className="h-3 w-3 text-violet-400/60" />
              <span className="text-[11px] text-violet-400/60 font-medium uppercase tracking-wider">
                En parallele
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-violet-500/10 ml-[17px]">
              {parallelGroup.map((ps) => (
                <StepRow key={ps.id} step={ps} />
              ))}
            </div>
          </div>
        )
      } else {
        rendered.push(<StepRow key={step.id} step={step} />)
        i++
      }
    }

    return rendered
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={testId}
      className={cn(
        'rounded-2xl overflow-hidden',
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]',
        'p-6',
        className
      )}
    >
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white font-[var(--font-display)]">
            {isComplete
              ? 'Generation terminee !'
              : hasError
                ? 'Erreur lors de la generation'
                : 'Generation en cours...'}
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {completedCount}/{steps.length} etapes completees
            {isRunning && ` - ${formatElapsed(elapsed)}`}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-white font-[var(--font-display)]">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <ProgressBar value={progress} size="sm" className="mb-6" />

      {/* Steps list */}
      <div className="space-y-3">{renderSteps()}</div>

      {/* Complete state */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-6 pt-6 border-t border-white/[0.06]"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  Ta video est prete !
                </p>
                <p className="text-xs text-white/40">
                  Temps total : {formatElapsed(elapsed)}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function StepRow({ step }: { step: PipelineStep }) {
  const Icon = statusIcon[step.status]
  const color = statusColor[step.status]
  const bg = statusBg[step.status]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300',
        bg
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          color,
          step.status === 'running' && 'animate-spin'
        )}
      />
      <span
        className={cn(
          'text-sm font-medium flex-1',
          step.status === 'completed'
            ? 'text-white/70'
            : step.status === 'running'
              ? 'text-white'
              : step.status === 'error'
                ? 'text-red-400'
                : 'text-white/30'
        )}
      >
        {step.label}
      </span>
      {step.duration && (
        <span className="text-xs text-white/30 tabular-nums">
          {step.duration}
        </span>
      )}
    </motion.div>
  )
}

export default PipelineProgress
