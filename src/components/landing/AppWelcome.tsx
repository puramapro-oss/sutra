'use client'

import { useEffect, useState } from 'react'
import { LandingNav } from './LandingNav'
import { LandingHero } from './LandingHero'
import { LandingFeatures } from './LandingFeatures'
import { LandingHowItWorks } from './LandingHowItWorks'
import { LandingCTA } from './LandingCTA'
import { LandingFooter } from './LandingFooter'

export default function AppWelcome() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { queueMicrotask(() => setMounted(true)) }, [])

  return (
    <main className="relative min-h-dvh bg-[#06050e] text-white overflow-x-hidden">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingHowItWorks />
      <LandingCTA />
      <LandingFooter />

      {mounted && <span data-testid="landing-mounted" className="sr-only">mounted</span>}
    </main>
  )
}
