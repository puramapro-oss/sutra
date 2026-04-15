'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'

const CosmicParticlesWrapper = dynamic(
  () => import('@/components/shared/CosmicParticlesWrapper'),
  { ssr: false }
)

const TutorialOverlay = dynamic(
  () => import('@/components/shared/TutorialOverlay'),
  { ssr: false }
)

const SpiritualLayer = dynamic(
  () => import('@/components/shared/SpiritualLayer'),
  { ssr: false }
)

const SubconsciousEngine = dynamic(
  () => import('@/components/shared/SubconsciousEngine'),
  { ssr: false }
)

const ConversionPopup = dynamic(
  () => import('@/components/shared/ConversionPopup'),
  { ssr: false }
)

const CinematicIntro = dynamic(
  () => import('@/components/shared/CinematicIntro'),
  { ssr: false }
)

const FiscalBanner = dynamic(
  () => import('@/components/shared/FiscalBanner').then(m => m.FiscalBanner),
  { ssr: false }
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh bg-[#06050e]">
      {/* Cosmic particles background */}
      <CosmicParticlesWrapper variant="dashboard" />

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <Header />

        {/* V6 — Banner fiscal si user >3000€ (avril-juin) */}
        <FiscalBanner />

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex-1 px-4 lg:px-6 py-6 pb-24 lg:pb-6 overflow-x-hidden"
        >
          {children}
        </motion.main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Tutorial overlay - first login only */}
      <TutorialOverlay />

      {/* Spiritual layer — affirmation + quotes */}
      <SpiritualLayer />

      {/* Subconscious engine — micro-pauses + subliminals */}
      <SubconsciousEngine />

      {/* Conversion popup — triggers: credits low, 3rd login, pending earnings */}
      <ConversionPopup />

      {/* Cinematic intro — first visit only */}
      <CinematicIntro />
    </div>
  )
}
