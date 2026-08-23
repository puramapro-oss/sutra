'use client'

import { motion } from 'framer-motion'
import { Award, RotateCcw } from 'lucide-react'
import Button from '@/components/ui/Button'

interface SessionCompletedProps {
  cycleCount: number
  xpReward: number
  onReset: () => void
}

export default function SessionCompleted({ cycleCount, xpReward, onReset }: SessionCompletedProps) {
  return (
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
          +{xpReward} points
        </div>
      </div>
      <Button
        onClick={onReset}
        variant="ghost"
        className="text-white/50 hover:text-white/80"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Recommencer
      </Button>
    </motion.div>
  )
}
