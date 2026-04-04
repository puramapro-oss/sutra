'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="relative flex min-h-dvh bg-[#06050e]">
      {/* Cosmic particles background */}
      <CosmicParticlesWrapper variant="dashboard" />

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-[280px]"
            >
              <div className="h-full bg-[#06050e] border-r border-white/[0.06]">
                <Sidebar />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <Header onMenuToggle={() => setMobileMenuOpen((prev) => !prev)} />

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
    </div>
  )
}
