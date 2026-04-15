'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'

// V6 Section 10 — Magic Moment : animation plein écran au 1er retrait
// Se déclenche quand le backend marque magic_moments.animation_shown=false.

export function MagicMoment() {
  const [show, setShow] = useState(false)
  const [amount, setAmount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/magic-moment/check')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.should_show) {
          setAmount(d.amount ?? null)
          setShow(true)
          // marquer comme affiché
          fetch('/api/magic-moment/ack', { method: 'POST' })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), 6000)
    return () => clearTimeout(t)
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl"
          onClick={() => setShow(false)}
        >
          <motion.div
            initial={{ scale: 0.5, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="text-center px-6"
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-24 h-24 text-amber-300 mx-auto" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold mt-6 bg-gradient-to-r from-amber-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent"
            >
              Premier retrait !
            </motion.h1>

            {amount !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-3xl md:text-5xl font-mono font-bold mt-4 text-white"
              >
                {amount.toFixed(2)} €
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-white/70 mt-6 max-w-md mx-auto text-lg"
            >
              Tu viens de toucher ta première vraie récompense. Badge Premier Retrait débloqué.
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              onClick={() => setShow(false)}
              className="mt-8 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
            >
              Continuer
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
