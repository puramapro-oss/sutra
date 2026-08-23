'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type Phase, PHASE_LABELS, PHASE_COLORS } from '@/app/(dashboard)/breathe/constants'
import { cn } from '@/lib/utils'

interface BreathingCircleProps {
  phase: Phase
  secondsLeft: number
  isRunning: boolean
  progress: number
}

export default function BreathingCircle({ phase, secondsLeft, isRunning, progress }: BreathingCircleProps) {
  const circleScale = phase === 'inhale' ? 1.4 : phase === 'hold' ? 1.4 : phase === 'exhale' ? 0.8 : 1

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer glow */}
      <motion.div
        animate={{
          scale: circleScale,
          opacity: isRunning ? 0.6 : 0.3,
        }}
        transition={{
          scale: {
            duration: phase === 'inhale' ? 4 : phase === 'exhale' ? 8 : 0.3,
            ease: 'easeInOut',
          },
        }}
        className={cn(
          'absolute w-56 h-56 rounded-full blur-2xl bg-gradient-to-br',
          PHASE_COLORS[phase]
        )}
      />

      {/* Main circle */}
      <motion.div
        animate={{
          scale: circleScale,
        }}
        transition={{
          duration: phase === 'inhale' ? 4 : phase === 'hold' ? 0.3 : phase === 'exhale' ? 8 : 0.5,
          ease: 'easeInOut',
        }}
        className="relative w-48 h-48 rounded-full glass border border-white/10 flex flex-col items-center justify-center"
      >
        {/* Phase label */}
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-lg font-medium text-white"
          >
            {PHASE_LABELS[phase]}
          </motion.span>
        </AnimatePresence>

        {/* Countdown */}
        {isRunning && phase !== 'idle' && (
          <motion.span
            key={secondsLeft}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-4xl font-bold text-white/80 mt-2 tabular-nums"
          >
            {secondsLeft}
          </motion.span>
        )}
      </motion.div>

      {/* Progress ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
        <circle
          cx="128"
          cy="128"
          r="120"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
        />
        <motion.circle
          cx="128"
          cy="128"
          r="120"
          fill="none"
          stroke="url(#breathGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 120}
          strokeDashoffset={2 * Math.PI * 120 * (1 - progress)}
          transition={{ duration: 0.5 }}
        />
        <defs>
          <linearGradient id="breathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
