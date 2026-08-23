'use client'

import { motion } from 'framer-motion'
import { Gift, Zap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface DailyGiftChestProps {
  canOpen: boolean
  streakCount: number
  onOpen: () => void
  opening: boolean
}

export default function DailyGiftChest({ canOpen, streakCount, onOpen, opening }: DailyGiftChestProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass rounded-2xl p-6 border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-violet-500/5 overflow-hidden"
    >
      {/* Glow effect behind chest */}
      {canOpen && (
        <div className="absolute top-1/2 left-8 -translate-y-1/2 w-24 h-24 rounded-full bg-amber-500/20 blur-2xl animate-pulse pointer-events-none" />
      )}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            animate={canOpen ? {
              rotate: [-2, 2, -2],
              scale: [1, 1.05, 1],
            } : {}}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "easeInOut",
            }}
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
              canOpen
                ? "bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-amber-500/30"
                : "bg-gradient-to-br from-white/10 to-white/5"
            )}
          >
            <Gift className={cn("w-8 h-8", canOpen ? "text-white" : "text-white/40")} />
          </motion.div>
          <div>
            <h3 className="text-lg font-bold text-white">Coffre Quotidien</h3>
            <p className="text-white/50 text-sm">
              {canOpen
                ? 'Ton cadeau du jour t\'attend !'
                : `Reviens demain ! Serie : ${streakCount} jours`}
            </p>
            {streakCount >= 7 && (
              <div className="flex items-center gap-1.5 text-amber-400/80 text-xs mt-1">
                <Zap className="w-3 h-3" />
                Serie {streakCount}j — bonus garanti
              </div>
            )}
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onOpen}
            disabled={!canOpen || opening}
            className={cn(
              'px-6 min-w-[100px]',
              canOpen
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : canOpen ? 'Ouvrir ✨' : 'Ouvert'}
          </Button>
        </motion.div>
      </div>
      {/* Streak progress dots */}
      {streakCount > 0 && streakCount < 7 && (
        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < streakCount ? "bg-amber-400" : "bg-white/10"
              )}
            />
          ))}
          <span className="text-[10px] text-white/30 ml-1">{streakCount}/7</span>
        </div>
      )}
    </motion.div>
  )
}
