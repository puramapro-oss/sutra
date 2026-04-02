'use client'

import dynamic from 'next/dynamic'

const CosmicParticles = dynamic(
  () => import('@/components/shared/CosmicParticles'),
  { ssr: false }
)

export default function CosmicParticlesWrapper({ variant = 'landing' }: { variant?: 'landing' | 'dashboard' }) {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <CosmicParticles variant={variant} />
    </div>
  )
}
