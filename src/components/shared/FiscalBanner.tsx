'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, X } from 'lucide-react'

const STORAGE_KEY = 'sutra_fiscal_banner_dismissed'

export function FiscalBanner() {
  const [total, setTotal] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const d = localStorage.getItem(STORAGE_KEY)
    if (d && Date.now() - Number(d) < 90 * 24 * 60 * 60 * 1000) {
      setDismissed(true)
      return
    }
    fetch('/api/fiscal/status')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.total != null) setTotal(d.total) })
      .catch(() => {})
  }, [])

  const now = new Date()
  const isBannerWindow = now.getMonth() >= 3 && now.getMonth() <= 5 // avril-juin
  if (dismissed || total == null || total < 3000 || !isBannerWindow) return null

  const onDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="glass-card border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-yellow-400/10 p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-amber-200">Tu as gagné plus de 3 000 € cette année</div>
          <div className="text-white/80 mt-0.5">
            Pense à le déclarer. Abattement forfaitaire 34 % automatique.
          </div>
        </div>
        <Link
          href="/fiscal"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-sm font-medium"
        >
          En savoir plus
        </Link>
        <button
          onClick={onDismiss}
          aria-label="Fermer"
          className="shrink-0 p-1 rounded text-white/60 hover:text-white hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
