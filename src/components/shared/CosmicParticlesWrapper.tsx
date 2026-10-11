'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'

const CosmicParticles = dynamic(
  () => import('@/components/shared/CosmicParticles'),
  { ssr: false }
)

const budgetQuery = '(prefers-reduced-motion: reduce), (max-width: 767px)'
function subscribe(listener: () => void) {
  const query = window.matchMedia(budgetQuery)
  query.addEventListener('change', listener)
  document.addEventListener('visibilitychange', listener)
  return () => { query.removeEventListener('change', listener); document.removeEventListener('visibilitychange', listener) }
}
function getSnapshot() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !document.hidden && !window.matchMedia(budgetQuery).matches && !connection?.saveData
}
const getServerSnapshot = () => false

export default function CosmicParticlesWrapper({ variant = 'landing' }: { variant?: 'landing' | 'dashboard' }) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!enabled) return null
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <CosmicParticles variant={variant} />
    </div>
  )
}
