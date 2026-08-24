'use client'

import { Copy, Check, Share2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'

interface ReferralCodeCardProps {
  referralCode: string
  shareUrl: string
  copied: boolean
  copiedLink: boolean
  onCopyCode: () => void
  onCopyLink: () => void
}

export default function ReferralCodeCard({
  referralCode,
  shareUrl,
  copied,
  copiedLink,
  onCopyCode,
  onCopyLink,
}: ReferralCodeCardProps) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Code */}
          <div className="flex-1">
            <label className="text-xs font-medium text-white/40 mb-1.5 block">Ton code de parrainage</label>
            <div className="flex items-center gap-2">
              <div
                data-testid="referral-code"
                className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-lg font-mono font-bold text-violet-400 tracking-wider"
              >
                {referralCode || 'Chargement...'}
              </div>
              <button
                onClick={onCopyCode}
                data-testid="copy-code-btn"
                className="p-3 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Share link */}
          <div className="flex-1">
            <label className="text-xs font-medium text-white/40 mb-1.5 block">Lien de partage</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/50 truncate">
                {shareUrl || 'Chargement...'}
              </div>
              <button
                onClick={onCopyLink}
                data-testid="copy-link-btn"
                className="p-3 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                {copiedLink ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Commission info */}
        <div className="mt-4 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-white/30">Filleul obtient</p>
              <p className="text-sm font-semibold text-violet-400">-50% 1er mois</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Tu gagnes</p>
              <p className="text-sm font-semibold text-emerald-400">50% du 1er paiement</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Recurrent</p>
              <p className="text-sm font-semibold text-amber-400">10% chaque mois</p>
            </div>
            <div>
              <p className="text-xs text-white/30">Palier /10 filleuls</p>
              <p className="text-sm font-semibold text-pink-400">+30% bonus</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
