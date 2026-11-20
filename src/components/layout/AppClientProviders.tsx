'use client'

import dynamic from 'next/dynamic'
import { MotionConfig } from 'framer-motion'
import { useCookieConsent } from '@/lib/legal/hooks/useCookieConsent'

const Analytics = dynamic(() => import('@vercel/analytics/next').then(module => module.Analytics), { ssr: false })
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then(module => module.SpeedInsights), { ssr: false })

export default function AppClientProviders({ children, analyticsEnabled }: { children: React.ReactNode; analyticsEnabled: boolean }) {
  const { consent } = useCookieConsent()
  return (
    <MotionConfig reducedMotion="user">
      {children}
      {analyticsEnabled && consent?.mesure === true && <><Analytics /><SpeedInsights /></>}
    </MotionConfig>
  )
}
