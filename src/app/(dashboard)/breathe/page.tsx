'use client'

import { Wind, Play, Pause, RotateCcw, Timer } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBreathingSession } from '@/hooks/useBreathingSession'
import Button from '@/components/ui/Button'
import BreathingCircle from '@/components/breathe/BreathingCircle'
import SessionCompleted from '@/components/breathe/SessionCompleted'
import { XP_REWARD } from './constants'

export default function BreathePage() {
  const { profile } = useAuth()
  const {
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
  } = useBreathingSession(profile?.id)

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
      <BreathingCircle
        phase={phase}
        secondsLeft={secondsLeft}
        isRunning={isRunning}
        progress={progress}
      />

      {/* Stats */}
      <div className="flex items-center gap-6 mb-8 mt-8 text-sm">
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
          <SessionCompleted
            cycleCount={cycleCount}
            xpReward={XP_REWARD}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
