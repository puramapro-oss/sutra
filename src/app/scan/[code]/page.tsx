'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Film } from 'lucide-react'

export default function ScanPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code) return

    const trackScan = async () => {
      try {
        const res = await fetch(`/api/partner/scan/${encodeURIComponent(code)}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || 'Code partenaire invalide.')
        }
        // Redirect to signup with referral code
        router.replace(`/signup?ref=${encodeURIComponent(code)}`)
      } catch (err) {
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue.')
      }
    }

    const timer = setTimeout(trackScan, 1200)
    return () => clearTimeout(timer)
  }, [code, router])

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-center px-4">
        {status === 'loading' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="flex flex-col items-center"
          >
            {/* SUTRA animated logo */}
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 20px rgba(139, 92, 246, 0.3)',
                  '0 0 60px rgba(139, 92, 246, 0.6)',
                  '0 0 20px rgba(139, 92, 246, 0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mb-8"
            >
              <Film className="w-10 h-10 text-white" />
            </motion.div>

            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <p className="text-white/80 text-lg font-medium" data-testid="scan-loading">
                Redirection en cours...
              </p>
            </motion.div>

            <p className="text-white/40 text-sm mt-3">
              Tu as été invité par un partenaire SUTRA
            </p>

            {/* Loading bar */}
            <div className="w-48 h-1 bg-white/10 rounded-full mt-6 overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-full h-full bg-gradient-to-r from-transparent via-violet-500 to-transparent"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
              <span className="text-2xl">&#x26A0;</span>
            </div>
            <p className="text-white text-lg font-medium mb-2" data-testid="scan-error">
              Lien invalide
            </p>
            <p className="text-white/50 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={() => router.push('/signup')}
              data-testid="scan-fallback-signup"
              className="px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
            >
              S&apos;inscrire sur SUTRA
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
