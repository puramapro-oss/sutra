import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useAwakening } from '@/hooks/useAwakening'
import { type Phase, PHASE_DURATIONS, SESSION_DURATION, XP_REWARD } from '@/app/(dashboard)/breathe/constants'

export function useBreathingSession(profileId?: string) {
  const { addXp } = useAwakening(profileId)
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [cycleCount, setCycleCount] = useState(0)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current)
  }, [])

  const nextPhase = useCallback((current: Exclude<Phase, 'idle'>): Exclude<Phase, 'idle'> => {
    if (current === 'inhale') return 'hold'
    if (current === 'hold') return 'exhale'
    return 'inhale'
  }, [])

  const startPhaseRef = useRef<((p: Exclude<Phase, 'idle'>) => void) | null>(null)

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
          startPhaseRef.current?.(next)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [nextPhase])

  useEffect(() => {
    startPhaseRef.current = startPhase
  })

  const handleStart = useCallback(() => {
    setIsRunning(true)
    setCompleted(false)
    setTotalElapsed(0)
    setCycleCount(0)
    startPhase('inhale')

    intervalRef.current = setInterval(() => {
      setTotalElapsed((prev) => prev + 1)
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
      queueMicrotask(() => {
        setCompleted(true)
        setIsRunning(false)
        setPhase('idle')
      })
      cleanup()

      if (profileId) {
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
  }, [totalElapsed, isRunning, completed, profileId, addXp, cleanup])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const progress = Math.min(totalElapsed / SESSION_DURATION, 1)
  const minutesLeft = Math.max(0, Math.ceil((SESSION_DURATION - totalElapsed) / 60))

  return {
    phase,
    secondsLeft,
    totalElapsed,
    isRunning,
    cycleCount,
    completed,
    progress,
    minutesLeft,
    handleStart,
    handlePause,
    handleReset,
  }
}
