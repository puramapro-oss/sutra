'use client'

import { useEffect, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions } from '@tsparticles/engine'

const particlesConfig: ISourceOptions = {
  fullScreen: { enable: false },
  fpsLimit: 60,
  particles: {
    number: {
      value: 55,
      density: { enable: true, width: 1920, height: 1080 },
    },
    color: { value: ['#8B5CF6', '#7C3AED', '#A78BFA', '#6D28D9', '#C4B5FD'] },
    shape: { type: 'circle' },
    opacity: {
      value: { min: 0.08, max: 0.4 },
      animation: { enable: true, speed: 0.6, sync: false },
    },
    size: {
      value: { min: 1, max: 2.5 },
      animation: { enable: true, speed: 1.2, sync: false },
    },
    links: {
      enable: true,
      distance: 140,
      color: '#8B5CF6',
      opacity: 0.1,
      width: 0.8,
    },
    move: {
      enable: true,
      speed: 0.5,
      direction: 'none',
      random: true,
      straight: false,
      outModes: { default: 'bounce' },
    },
  },
  interactivity: {
    detectsOn: 'window',
    events: {
      onHover: {
        enable: true,
        mode: 'grab',
      },
      resize: { enable: true },
    },
    modes: {
      grab: {
        distance: 160,
        links: { opacity: 0.25 },
      },
    },
  },
  detectRetina: true,
}

export function CosmicParticles({ className = '' }: { className?: string }) {
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setReady(true))
  }, [reducedMotion])

  if (reducedMotion || !ready) return null

  return (
    <Particles
      id="cosmic-particles"
      className={`pointer-events-none ${className}`}
      options={particlesConfig}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}
    />
  )
}

export default CosmicParticles
