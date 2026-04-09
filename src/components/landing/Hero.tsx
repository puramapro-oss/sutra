'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      r: number
      alpha: number
      color: string
    }

    const particles: Particle[] = []
    const count = Math.min(80, Math.floor(w / 15))
    const colors = ['139,92,246', '168,85,247', '124,58,237', '99,102,241']

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    let animId: number

    function draw() {
      ctx!.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${p.color},${p.alpha})`
        ctx!.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(139,92,246,${0.08 * (1 - dist / 120)})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  useEffect(() => {
    const cleanup = animate()
    const handleResize = () => animate()
    window.addEventListener('resize', handleResize)
    return () => {
      cleanup?.()
      window.removeEventListener('resize', handleResize)
    }
  }, [animate])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}

export default function Hero() {
  return (
    <section
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background layers */}
      <div className="absolute inset-0 bg-[#06050e]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139,92,246,0.08) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <ParticleCanvas />

      {/* Aurora glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/[0.04] blur-[120px] animate-pulse" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-20 pb-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8"
        >
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-violet-300 font-medium">
            Propulse par l&apos;IA la plus avancee
          </span>
        </motion.div>

        {/* Headline (no fade-in to keep LCP fast) */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-white">Genere des videos IA</span>
          <br />
          <span
            className={cn(
              'bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400',
              'bg-clip-text text-transparent'
            )}
          >
            en quelques minutes
          </span>
        </h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Donne un sujet. Recois une video prete a publier. Zero effort.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <Link
            href="/signup"
            data-testid="hero-cta-primary"
            className={cn(
              'relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl',
              'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold text-base',
              'shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40',
              'hover:from-violet-500 hover:to-purple-500',
              'transition-all duration-200 active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50'
            )}
          >
            <Sparkles className="w-5 h-5" />
            Commencer gratuitement
          </Link>

          <Link
            href="/how-it-works"
            data-testid="hero-cta-secondary"
            className={cn(
              'inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl',
              'bg-white/5 backdrop-blur-xl border border-white/[0.08] text-white/90 font-semibold text-base',
              'hover:bg-white/10 hover:border-white/[0.12]',
              'transition-all duration-200 active:scale-[0.97]'
            )}
          >
            Comment ca marche
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex items-center justify-center gap-3"
        >
          <div className="flex -space-x-2">
            {[
              'from-violet-400 to-purple-500',
              'from-fuchsia-400 to-pink-500',
              'from-indigo-400 to-violet-500',
              'from-purple-400 to-fuchsia-500',
            ].map((gradient, i) => (
              <div
                key={i}
                className={cn(
                  'w-8 h-8 rounded-full border-2 border-[#06050e]',
                  `bg-gradient-to-br ${gradient}`,
                  'flex items-center justify-center'
                )}
              >
                <Users className="w-3.5 h-3.5 text-white/80" />
              </div>
            ))}
          </div>
          <span className="text-sm text-white/50">
            Rejoins les createurs qui utilisent SUTRA
          </span>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06050e] to-transparent pointer-events-none" />
    </section>
  )
}
