'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STORAGE_KEY = 'sutra_intro_seen'
const INTRO_DURATION = 3500

export default function CinematicIntro() {
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<'logo' | 'text' | 'fade'>('logo')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen) return
    setVisible(true)

    // Phase timeline
    const t1 = setTimeout(() => setPhase('text'), 800)
    const t2 = setTimeout(() => setPhase('fade'), 2500)
    const t3 = setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, INTRO_DURATION)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  const skip = useCallback(() => {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }, [])

  if (!visible) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#06050e] cursor-pointer"
          onClick={skip}
          role="presentation"
          aria-label="Introduction cinematique SUTRA"
        >
          {/* Background glow */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.15, scale: 1.2 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600 blur-[150px]"
            />
          </div>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: phase === 'fade' ? 0 : 1,
              scale: phase === 'fade' ? 1.1 : 1,
            }}
            transition={{
              opacity: { duration: 0.6 },
              scale: { type: 'spring', stiffness: 200, damping: 20 },
            }}
            className="relative z-10"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <span
                className="text-4xl font-bold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                S
              </span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: phase === 'logo' ? 0 : phase === 'fade' ? 0 : 1,
              y: phase === 'logo' ? 20 : 0,
            }}
            transition={{ duration: 0.5 }}
            className="relative z-10 mt-6 text-3xl font-bold text-white tracking-wider"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            SUTRA
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{
              opacity: phase === 'text' ? 1 : 0,
            }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="relative z-10 mt-2 text-sm text-white/50"
          >
            Generation video par IA
          </motion.p>

          {/* Skip hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1 }}
            className="absolute bottom-8 text-xs text-white/30"
          >
            Cliquer pour passer
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
