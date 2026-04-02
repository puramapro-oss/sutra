'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingTimeoutProps {
  loading: boolean
  timeout?: number
  onRetry: () => void
  children: React.ReactNode
  skeleton?: React.ReactNode
  className?: string
}

/**
 * Wraps a loading state with a 5s timeout.
 * Shows skeleton while loading, then a "Reessayer" button if timeout expires.
 */
export function LoadingTimeout({
  loading,
  timeout = 5000,
  onRetry,
  children,
  skeleton,
  className,
}: LoadingTimeoutProps) {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) {
      setTimedOut(false)
      return
    }

    setTimedOut(false)
    const timer = setTimeout(() => setTimedOut(true), timeout)
    return () => clearTimeout(timer)
  }, [loading, timeout])

  if (!loading) return <>{children}</>

  if (timedOut) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center text-center py-20 px-6',
          className
        )}
        data-testid="loading-timeout"
      >
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-5">
          <WifiOff className="h-7 w-7 text-white/30" />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">
          Chargement trop long
        </h3>
        <p className="text-sm text-white/50 max-w-sm mb-6">
          Les donnees n&apos;ont pas pu etre chargees. Verifie ta connexion et reessaie.
        </p>

        <button
          onClick={() => {
            setTimedOut(false)
            onRetry()
          }}
          data-testid="retry-button"
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
            'bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm',
            'transition-all duration-200 active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50'
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Reessayer
        </button>
      </div>
    )
  }

  return <>{skeleton}</>
}

export default LoadingTimeout
