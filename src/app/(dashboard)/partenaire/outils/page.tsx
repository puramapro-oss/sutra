'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Copy,
  QrCode,
  Link2,
  Download,
  CheckCircle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export default function PartnerToolsPage() {
  const { profile } = useAuth()
  const partnerCode = profile?.referral_code ?? ''
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${baseUrl}/scan/${partnerCode}`

  const [copied, setCopied] = useState(false)
  const [utmSource, setUtmSource] = useState('')
  const [utmMedium, setUtmMedium] = useState('')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [utmCopied, setUtmCopied] = useState(false)

  const utmUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (utmSource) params.set('utm_source', utmSource)
    if (utmMedium) params.set('utm_medium', utmMedium)
    if (utmCampaign) params.set('utm_campaign', utmCampaign)
    const qs = params.toString()
    return qs ? `${shareUrl}?${qs}` : shareUrl
  }, [shareUrl, utmSource, utmMedium, utmCampaign])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silencieux
    }
  }

  const handleCopyUtm = async () => {
    try {
      await navigator.clipboard.writeText(utmUrl)
      setUtmCopied(true)
      setTimeout(() => setUtmCopied(false), 2000)
    } catch {
      // Fallback silencieux
    }
  }

  const qrCodeUrl = partnerCode ? `/api/partner/qr/${encodeURIComponent(partnerCode)}` : ''

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard/partenaire"
            className="text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Outils Partenaire</h1>
            <p className="text-white/50 text-sm mt-1">
              Tout ce dont tu as besoin pour promouvoir SUTRA.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Copy link */}
          <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Link2 className="w-5 h-5 text-violet-400" />
              <h2 className="text-lg font-semibold text-white">Ton lien partenaire</h2>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/60 truncate">
                {shareUrl || 'Chargement...'}
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleCopyLink}
                data-testid="copy-partner-link"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copié' : 'Copier'}
              </Button>
            </div>
          </div>

          {/* QR Code */}
          <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">QR Code</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {qrCodeUrl ? (
                <div className="w-48 h-48 bg-white rounded-xl p-3 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="QR Code partenaire SUTRA"
                    width={180}
                    height={180}
                    data-testid="qr-code-img"
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-white/[0.03] border border-dashed border-white/[0.08] rounded-xl flex items-center justify-center">
                  <p className="text-white/30 text-sm">Chargement...</p>
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <p className="text-white/60 text-sm mb-4">
                  Scanne ce QR code ou telecharge-le pour le partager sur tes supports physiques et numériques.
                </p>
                {qrCodeUrl && (
                  <a href={qrCodeUrl} download={`sutra-qr-${partnerCode}.png`}>
                    <Button variant="secondary" size="sm" data-testid="download-qr">
                      <Download className="w-4 h-4" />
                      Telecharger le QR
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* UTM Generator */}
          <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ExternalLink className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Generateur UTM</h2>
            </div>
            <p className="text-white/50 text-sm mb-4">
              Ajoute des parametres UTM a ton lien pour tracker tes campagnes.
            </p>
            <div className="space-y-3 mb-4">
              {[
                {
                  key: 'source',
                  label: 'Source',
                  value: utmSource,
                  set: setUtmSource,
                  placeholder: 'instagram, youtube, blog...',
                },
                {
                  key: 'medium',
                  label: 'Medium',
                  value: utmMedium,
                  set: setUtmMedium,
                  placeholder: 'social, email, video...',
                },
                {
                  key: 'campaign',
                  label: 'Campagne',
                  value: utmCampaign,
                  set: setUtmCampaign,
                  placeholder: 'lancement-mai, promo-ete...',
                },
              ].map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-white/40 text-sm w-24 shrink-0">{field.label}</span>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    placeholder={field.placeholder}
                    data-testid={`utm-${field.key}`}
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-xs text-white/50 break-all mb-3">
              {utmUrl}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyUtm}
              data-testid="copy-utm-link"
            >
              {utmCopied ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {utmCopied ? 'Copié' : 'Copier le lien UTM'}
            </Button>
          </div>

          {/* Download Kit */}
          <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Download className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Kit Marketing</h2>
            </div>
            <p className="text-white/50 text-sm mb-4">
              Bannieres, logos et visuels prets a l&apos;emploi pour promouvoir SUTRA sur tes supports.
            </p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                // Kit download will be available soon
                window.alert('Le kit marketing sera bientot disponible.')
              }}
              data-testid="download-kit"
            >
              <Download className="w-4 h-4" />
              Telecharger le kit
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
