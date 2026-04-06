'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type MediaMode = 'ai' | 'stock' | 'mixed'

const MODES: Array<{
  id: MediaMode
  emoji: string
  title: string
  desc: string
  glow: string
}> = [
  {
    id: 'ai',
    emoji: '🎨',
    title: '100% IA',
    desc: 'Scenes generees par LTX 2.3 / WAN. Style cinematique.',
    glow: 'from-violet-500/30 to-fuchsia-500/20',
  },
  {
    id: 'stock',
    emoji: '🎬',
    title: '100% Reel',
    desc: 'Videos & photos reelles (Pexels, Unsplash, Coverr) en 1080p+ ou 4K.',
    glow: 'from-amber-400/30 to-orange-500/20',
  },
  {
    id: 'mixed',
    emoji: '✨',
    title: 'Mixte',
    desc: 'Combine medias reels et IA pour le meilleur des deux mondes.',
    glow: 'from-cyan-400/30 to-emerald-400/20',
  },
]

export function MediaModeCards({
  value,
  onChange,
}: {
  value: MediaMode
  onChange: (v: MediaMode) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MODES.map((m) => {
        const selected = value === m.id
        return (
          <motion.button
            key={m.id}
            type="button"
            data-testid={`media-mode-${m.id}`}
            onClick={() => onChange(m.id)}
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'relative overflow-hidden rounded-2xl p-5 text-left border transition-all duration-300',
              'bg-white/[0.03] backdrop-blur-xl',
              selected
                ? 'border-violet-500/50 shadow-[0_0_30px_rgba(139,92,246,0.25)]'
                : 'border-white/[0.06] hover:border-white/[0.15]'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 opacity-0 transition-opacity duration-500 bg-gradient-to-br pointer-events-none',
                m.glow,
                selected && 'opacity-100'
              )}
            />
            <div className="relative">
              <div className="text-3xl mb-2">{m.emoji}</div>
              <div className="text-base font-semibold text-white mb-1 font-[var(--font-display)]">
                {m.title}
              </div>
              <div className="text-xs text-white/50 leading-relaxed">{m.desc}</div>
              {selected && (
                <motion.div
                  layoutId="media-mode-dot"
                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]"
                />
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
