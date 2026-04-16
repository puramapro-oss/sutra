'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Copy, Check, Share2, QrCode, Gift } from 'lucide-react'
import QRCode from 'qrcode'

interface ReferralStats {
  referral_code: string | null
  filleuls_count: number
  total_earned: number
  pending_amount: number
  share_url: string | null
}

export function ReferralBlock() {
  const router = useRouter()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReferralStats | null) => {
        if (data) setStats(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (showQR && stats?.share_url && !qrDataUrl) {
      QRCode.toDataURL(stats.share_url, {
        width: 240,
        margin: 1,
        color: { dark: '#FFFFFF', light: '#0A0A0F' },
      })
        .then(setQrDataUrl)
        .catch(() => {})
    }
  }, [showQR, stats?.share_url, qrDataUrl])

  const copyLink = useCallback(async () => {
    if (!stats?.share_url) return
    try {
      await navigator.clipboard.writeText(stats.share_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard denied
    }
  }, [stats?.share_url])

  const share = useCallback(async () => {
    if (!stats?.share_url) return
    const shareData = {
      title: 'Rejoins SUTRA',
      text: 'Crée des vidéos IA époustouflantes avec SUTRA. Tu gagnes aussi 100€ de prime de bienvenue.',
      url: stats.share_url,
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled or share failed — fallback to copy
      }
    }
    await copyLink()
  }, [stats?.share_url, copyLink])

  if (!stats || !stats.referral_code) {
    return null
  }

  const hasFilleuls = stats.filleuls_count > 0
  const totalGain = (stats.total_earned + stats.pending_amount).toFixed(2)

  return (
    <motion.section
      data-testid="bloc-parrainage"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5 sm:p-6 relative overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(600px circle at 20% 0%, rgba(139, 92, 246, 0.25), transparent 60%)',
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base sm:text-lg">
                Invite tes amis, gagne à vie
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                50% sur chaque filleul (N1) · 15% N2 · 7% N3
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-white/50">
              {hasFilleuls ? 'Gains cumulés' : 'Potentiel'}
            </div>
            <div className="text-2xl font-bold font-mono text-violet-200 tabular-nums">
              {hasFilleuls ? `${totalGain} €` : '100+ €'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 p-2 mb-4">
          <div className="flex-1 min-w-0 px-3 py-2 text-sm font-mono text-white/80 truncate">
            sutra.purama.dev/signup?ref={stats.referral_code}
          </div>
          <button
            data-testid="copy-referral-link"
            onClick={copyLink}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-200 text-xs font-medium hover:bg-violet-500/30 transition-colors"
            aria-label="Copier le lien de parrainage"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" /> Copié !
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            data-testid="share-referral"
            onClick={share}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white text-sm font-semibold hover:from-violet-400 hover:to-cyan-400 transition-all shadow-lg shadow-violet-500/20 active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" />
            Partager mon lien
          </button>
          <button
            data-testid="toggle-qr"
            onClick={() => setShowQR((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors active:scale-[0.98]"
            aria-expanded={showQR}
          >
            <QrCode className="h-4 w-4" /> QR
          </button>
          <button
            data-testid="open-referral-page"
            onClick={() => router.push('/referral')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            Mon arbre de parrainage
          </button>
        </div>

        <AnimatePresence>
          {showQR && qrDataUrl && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
            >
              <img src={qrDataUrl} alt="QR code de parrainage" className="w-28 h-28 rounded-lg" />
              <div className="text-xs text-white/70 leading-relaxed">
                <strong className="text-white block mb-1">Partage en scannant.</strong>
                Tes amis atterrissent directement sur l'inscription avec ton code appliqué.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
          {hasFilleuls ? (
            <>
              <Users className="h-3.5 w-3.5" />
              <span data-testid="filleuls-count">
                {stats.filleuls_count} filleul{stats.filleuls_count > 1 ? 's' : ''} actif
                {stats.filleuls_count > 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <>
              <Gift className="h-3.5 w-3.5 text-violet-300" />
              <span>
                Ton premier filleul te rapporte <strong className="text-violet-200">au moins 5 €</strong>{' '}
                dès son premier paiement.
              </span>
            </>
          )}
        </div>
      </div>
    </motion.section>
  )
}
