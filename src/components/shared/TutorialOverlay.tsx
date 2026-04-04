'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'

const supabase = createClient()

interface TutorialStep {
  selector: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS: TutorialStep[] = [
  {
    selector: '[data-testid="sidebar-dashboard"], [data-testid="mobile-dashboard"]',
    title: 'Bienvenue sur SUTRA',
    description: 'Ton dashboard te donne un apercu complet : videos creees, credits restants et activite recente.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-create"], [data-testid="mobile-create"]',
    title: 'Creer une video',
    description: 'Decris ton idee, choisis un style et SUTRA genere une video complete avec voix, musique et visuels.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-library"], [data-testid="mobile-library"]',
    title: 'Tes videos',
    description: 'Retrouve toutes tes creations ici. Tu peux les modifier, telecharger ou publier en un clic.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-publish"], [data-testid="mobile-publish"]',
    title: 'Publier',
    description: 'Partage tes videos sur YouTube, TikTok et Instagram directement depuis SUTRA.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-contest"]',
    title: 'Concours',
    description: 'Participe aux concours hebdomadaires et mensuels pour gagner des reductions et des prix.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-referral"]',
    title: 'Parrainage',
    description: 'Invite tes amis et gagne des commissions sur leurs abonnements. -50% pour eux, des gains pour toi.',
    position: 'right',
  },
  {
    selector: '[data-testid="sidebar-settings"], [data-testid="mobile-profile"]',
    title: 'Profil et Reglages',
    description: 'Personnalise ton experience : theme, preferences de voix, qualite video et notifications.',
    position: 'right',
  },
]

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

export default function TutorialOverlay() {
  const { profile } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check if tutorial should show
  useEffect(() => {
    if (!profile) return
    if (profile.tutorial_completed) return

    const dismissed = localStorage.getItem('sutra_tutorial_dismissed')
    if (dismissed === 'true') return

    // Small delay so dashboard renders first
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [profile])

  // Listen for relaunch event
  useEffect(() => {
    const handler = () => {
      setCurrentStep(0)
      setVisible(true)
    }
    window.addEventListener('sutra-relaunch-tutorial', handler)
    return () => window.removeEventListener('sutra-relaunch-tutorial', handler)
  }, [])

  // Position spotlight on current step element
  const updateSpotlight = useCallback(() => {
    if (!visible) return
    const step = STEPS[currentStep]
    if (!step) return

    const selectors = step.selector.split(', ')
    let el: Element | null = null
    for (const s of selectors) {
      el = document.querySelector(s)
      if (el) break
    }

    if (el) {
      const rect = el.getBoundingClientRect()
      setSpotlightRect({
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      })
    } else {
      setSpotlightRect(null)
    }
  }, [currentStep, visible])

  useEffect(() => {
    updateSpotlight()
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight)
    return () => {
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight)
    }
  }, [updateSpotlight])

  const dismiss = useCallback(async () => {
    setVisible(false)
    localStorage.setItem('sutra_tutorial_dismissed', 'true')
    if (profile?.id) {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', profile.id)
    }
  }, [profile?.id])

  const next = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      dismiss()
    }
  }, [currentStep, dismiss])

  if (!visible) return null

  const step = STEPS[currentStep]

  // Tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlightRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    const padding = 16
    const pos = step.position

    if (pos === 'right') {
      return {
        top: spotlightRect.top,
        left: spotlightRect.left + spotlightRect.width + padding,
      }
    }
    if (pos === 'bottom') {
      return {
        top: spotlightRect.top + spotlightRect.height + padding,
        left: spotlightRect.left,
      }
    }
    if (pos === 'left') {
      return {
        top: spotlightRect.top,
        right: window.innerWidth - spotlightRect.left + padding,
      }
    }
    // top
    return {
      bottom: window.innerHeight - spotlightRect.top + padding,
      left: spotlightRect.left,
    }
  }

  // On mobile, sidebar items may not be visible — center tooltip
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
  const tooltipStyle = isMobile && !spotlightRect
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } as React.CSSProperties
    : getTooltipStyle()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998]"
          data-testid="tutorial-overlay"
        >
          {/* Dark overlay with spotlight cutout */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            <defs>
              <mask id="tutorial-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlightRect && (
                  <rect
                    x={spotlightRect.left}
                    y={spotlightRect.top}
                    width={spotlightRect.width}
                    height={spotlightRect.height}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.75)"
              mask="url(#tutorial-mask)"
            />
          </svg>

          {/* Spotlight ring */}
          {spotlightRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute rounded-xl border-2 border-violet-500/60 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Click catcher */}
          <div className="absolute inset-0" onClick={next} />

          {/* Tooltip */}
          <motion.div
            ref={tooltipRef}
            key={currentStep}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute z-[9999] w-[300px] max-w-[calc(100vw-32px)]"
            style={tooltipStyle}
            onClick={(e) => e.stopPropagation()}
            data-testid="tutorial-tooltip"
          >
            <div className="bg-[#12111a]/95 backdrop-blur-xl border border-violet-500/20 rounded-2xl p-5 shadow-2xl shadow-violet-900/20">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5 mb-3">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-6 bg-violet-500'
                        : i < currentStep
                          ? 'w-2 bg-violet-500/40'
                          : 'w-2 bg-white/10'
                    }`}
                  />
                ))}
              </div>

              {/* Icon + Title */}
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <h3 className="text-base font-semibold text-white">
                  {step.title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-sm text-white/60 leading-relaxed mb-4">
                {step.description}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={dismiss}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  data-testid="tutorial-skip"
                >
                  Passer le tuto
                </button>
                <button
                  onClick={next}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
                  data-testid="tutorial-next"
                >
                  {currentStep < STEPS.length - 1 ? (
                    <>
                      Suivant
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    "C'est parti !"
                  )}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 z-[9999] p-2 text-white/40 hover:text-white/80 transition-colors"
            data-testid="tutorial-close"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
