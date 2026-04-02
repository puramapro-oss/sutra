'use client'

import { useEffect, useState, useId } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'
import type { ISourceOptions } from '@tsparticles/engine'

interface CosmicParticlesProps {
  className?: string
  variant?: 'landing' | 'dashboard'
}

function getConfig(variant: 'landing' | 'dashboard'): ISourceOptions {
  const isLanding = variant === 'landing'

  return {
    fullScreen: { enable: false },
    fpsLimit: 60,
    smooth: true,
    particles: {
      number: {
        value: isLanding ? 80 : 50,
        density: { enable: true, width: 1920, height: 1080 },
      },
      color: {
        value: ['#8B5CF6', '#7C3AED', '#A78BFA', '#6D28D9', '#C4B5FD', '#DDD6FE', '#3B82F6', '#818CF8'],
      },
      shape: { type: 'circle' },
      opacity: {
        value: { min: 0.1, max: 0.7 },
        animation: {
          enable: true,
          speed: 0.4,
          sync: false,
          startValue: 'random',
          destroy: 'none',
        },
      },
      size: {
        value: { min: 0.5, max: isLanding ? 4 : 3 },
        animation: {
          enable: true,
          speed: 1.5,
          sync: false,
          startValue: 'random',
          destroy: 'none',
        },
      },
      links: {
        enable: true,
        distance: isLanding ? 160 : 130,
        color: '#8B5CF6',
        opacity: 0.08,
        width: 0.6,
        triangles: {
          enable: isLanding,
          color: '#7C3AED',
          opacity: 0.015,
        },
      },
      move: {
        enable: true,
        speed: { min: 0.2, max: 0.8 },
        direction: 'none',
        random: true,
        straight: false,
        outModes: { default: 'bounce' },
        attract: {
          enable: true,
          rotate: { x: 600, y: 1200 },
        },
      },
      twinkle: {
        particles: {
          enable: true,
          frequency: 0.03,
          opacity: 1,
          color: { value: '#C4B5FD' },
        },
      },
      wobble: {
        enable: true,
        distance: 3,
        speed: { min: -1, max: 1 },
      },
      shadow: {
        enable: true,
        color: '#8B5CF6',
        blur: 8,
        offset: { x: 0, y: 0 },
      },
    },
    interactivity: {
      detectsOn: 'window',
      events: {
        onHover: {
          enable: true,
          mode: ['grab', 'bubble'],
          parallax: {
            enable: isLanding,
            force: 40,
            smooth: 20,
          },
        },
        onClick: {
          enable: isLanding,
          mode: 'push',
        },
        resize: { enable: true },
      },
      modes: {
        grab: {
          distance: 200,
          links: {
            opacity: 0.3,
            color: '#A78BFA',
          },
        },
        bubble: {
          distance: 200,
          size: 6,
          duration: 0.4,
          opacity: 0.8,
        },
        push: {
          quantity: 3,
        },
        repulse: {
          distance: 150,
          duration: 0.4,
        },
      },
    },
    detectRetina: true,
    background: { color: 'transparent' },
  }
}

let engineReady = false
let enginePromise: Promise<void> | null = null

export function CosmicParticles({ className = '', variant = 'landing' }: CosmicParticlesProps) {
  const [ready, setReady] = useState(engineReady)
  const [reducedMotion, setReducedMotion] = useState(false)
  const instanceId = useId()

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reducedMotion || engineReady) {
      if (engineReady) setReady(true)
      return
    }

    if (!enginePromise) {
      enginePromise = initParticlesEngine(async (engine) => {
        await loadSlim(engine)
      })
    }

    enginePromise.then(() => {
      engineReady = true
      setReady(true)
    })
  }, [reducedMotion])

  if (reducedMotion || !ready) return null

  return (
    <Particles
      id={`cosmic-${variant}-${instanceId.replace(/:/g, '')}`}
      className={`pointer-events-none ${className}`}
      options={getConfig(variant)}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
      }}
    />
  )
}

export default CosmicParticles
