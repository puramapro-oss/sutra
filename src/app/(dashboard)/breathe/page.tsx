'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wind, Play, Pause, RotateCcw, Award, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useAwakening } from '@/hooks/useAwakening'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'inhale' | 'hold' | 'exhale'

const PHASE_DURATIONS: Record<Exclude<Phase, 'idle'>, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Pret ?',
  inhale: 'Inspire...',
  hold: 'Retiens...',
  exhale: 'Expire...',
}

const PHASE_COLORS: Record<Phase, string> = {
  idle: 'from-violet-500/20 to-cyan-500/20',
  inhale: 'from-cyan-400/30 to-emerald-400/30',
  hold: 'from-violet-400/30 to-purple-400/30',
  exhale: 'from-indigo-400/30 to-blue-400/30',
}

const SESSION_DURATION = 180 // 3 minutes
const XP_REWARD = 50

export default function BreathePage() {
  const { profile } = useAuth()
  const { addXp } = useAwakening(profile?.id)
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [cycleCount, setCycleCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const circleScale = phase === 'inhale' ? 1.4 : phase === 'hold' ? 1.4 : phase === 'exhale' ? 0.8 : 1

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current)
  }, [])

  const nextPhase = useCallback((current: Exclude<Phase, 'idle'>): Exclude<Phase, 'idle'> => {
    if (current === 'inhale') return 'hold'
    if (current === 'hold') return 'exhale'
    return 'inhale'
  }, [])

  const startPhase = useCallback((p: Exclude<Phase, 'idle'>) => {
    setPhase(p)
    setSecondsLeft(PHASE_DURATIONS[p])

    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current)

    phaseTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          const next = nextPhase(p)
          if (next === 'inhale') {
            setCycleCount((c) => c + 1)
          }
          startPhase(next)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [nextPhase])

  const handleStart = useCallback(() => {
    setIsRunning(true)
    setCompleted(false)
    setTotalElapsed(0)
    setCycleCount(0)
    startPhase('inhale')

    intervalRef.current = setInterval(() => {
      setTotalElapsed((prev) => {
        if (prev >= SESSION_DURATION - 1) {
          return prev + 1
        }
        return prev + 1
      })
    }, 1000)
  }, [startPhase])

  const handlePause = useCallback(() => {
    setIsRunning(false)
    cleanup()
    setPhase('idle')
  }, [cleanup])

  const handleReset = useCallback(() => {
    setIsRunning(false)
    cleanup()
    setPhase('idle')
    setSecondsLeft(0)
    setTotalElapsed(0)
    setCycleCount(0)
    setCompleted(false)
  }, [cleanup])

  // Complete session when 3 min reached
  useEffect(() => {
    if (totalElapsed >= SESSION_DURATION && isRunning && !completed) {
      setCompleted(true)
      setIsRunning(false)
      cleanup()
      setPhase('idle')

      if (profile?.id) {
        addXp('breathe_session', XP_REWARD)
        // Award points via API
        fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'earn', amount: XP_REWARD, source: 'breathe_session' }),
        }).catch(() => {})
      }
      toast.success(`Session terminee ! +${XP_REWARD} points`)
    }
  }, [totalElapsed, isRunning, completed, profile?.id, addXp, cleanup])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const progress = Math.min(totalElapsed / SESSION_DURATION, 1)
  const minutesLeft = Math.max(0, Math.ceil((SESSION_DURATION - totalElapsed) / 60))

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] px-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-3">
          <Wind className="w-7 h-7 text-cyan-400" />
          Respiration 4-7-8
        </h1>
        <p className="text-white/50 mt-2 text-sm">
          Inspire 4s, retiens 7s, expire 8s. 3 minutes pour te recentrer.
        </p>
      </div>

      {/* Breathing Circle */}
      <div className="relative w-64 h-64 flex items-center justify-center mb-8">
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

      {/* Stats */}
      <div className="flex items-center gap-6 mb-8 text-sm">
        <div className="flex items-center gap-2 text-white/50">
          <Timer className="w-4 h-4" />
          <span>{minutesLeft} min restante{minutesLeft > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 text-white/50">
          <Wind className="w-4 h-4" />
          <span>{cycleCount} cycle{cycleCount > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!completed ? (
          <>
            <Button
              onClick={isRunning ? handlePause : handleStart}
              className="px-8 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:opacity-90 active:scale-[0.98] shadow-lg shadow-cyan-500/20"
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Pause className="w-5 h-5" /> Pause
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="w-5 h-5" /> {totalElapsed > 0 ? 'Reprendre' : 'Commencer'}
                </span>
              )}
            </Button>
            {totalElapsed > 0 && (
              <Button
                onClick={handleReset}
                variant="ghost"
                className="h-12 px-4 text-white/40 hover:text-white/70"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="glass rounded-2xl p-6 border border-emerald-500/20">
              <Award className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">Session terminee</h3>
              <p className="text-white/50 text-sm mt-1">
                {cycleCount} cycles completes en 3 minutes
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                +{XP_REWARD} points
              </div>
            </div>
            <Button
              onClick={handleReset}
              variant="ghost"
              className="text-white/50 hover:text-white/80"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Recommencer
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
