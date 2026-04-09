'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiProps {
  active: boolean
  duration?: number
}

const COLORS = ['#8B5CF6', '#7C3AED', '#F59E0B', '#10B981', '#EC4899', '#3B82F6', '#EF4444']
const PARTICLE_COUNT = 50

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

export default function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const [show, setShow] = useState(false)
  const [particles, setParticles] = useState<Array<{
    id: number
    x: number
    color: string
    delay: number
    size: number
    rotation: number
  }>>([])

  useEffect(() => {
    if (active) {
      setShow(true)
      setParticles(
        Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
          id: i,
          x: randomBetween(0, 100),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          delay: randomBetween(0, 0.5),
          size: randomBetween(6, 12),
          rotation: randomBetween(0, 360),
        }))
      )
      const timer = setTimeout(() => setShow(false), duration)
      return () => clearTimeout(timer)
    }
  }, [active, duration])

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{
                x: `${p.x}vw`,
                y: '-10vh',
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: '110vh',
                rotate: p.rotation + 720,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: randomBetween(2, 4),
                delay: p.delay,
                ease: 'linear',
              }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
