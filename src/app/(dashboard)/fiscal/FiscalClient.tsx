'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, Info, FileText, AlertCircle } from 'lucide-react'

type Totals = {
  total: number
  primes: number
  parrainage: number
  nature: number
  marketplace: number
  missions: number
}

type Summary = {
  year: number
  total_annuel: number | string
  pdf_url: string | null
} | null

export function FiscalClient({ totals, lastYearSummary }: { totals: Totals; lastYearSummary: Summary }) {
  const [downloading, setDownloading] = useState(false)
  const year = new Date().getFullYear()
  const THRESHOLD = 3000
  const isOverThreshold = totals.total >= THRESHOLD
  const remainingToThreshold = Math.max(0, THRESHOLD - totals.total)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/fiscal/summary', { method: 'POST' })
      if (!res.ok) throw new Error('Erreur téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recapitulatif-sutra-${year}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erreur lors de la génération du récapitulatif. Réessaie dans quelques instants.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Ma fiscalité {year}</h1>
        <p className="text-white/60 mt-1">
          Suivi transparent de tes gains et de tes obligations déclaratives.
        </p>
      </header>

      {isOverThreshold && (
        <div className="glass-card border-amber-400/40 bg-amber-400/10 p-5 flex gap-3">
          <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-200">Tu dois déclarer tes gains cette année</div>
            <p className="text-sm text-white/80 mt-1">
              Tu as dépassé le seuil de 3 000 € de gains via Purama. L'abattement forfaitaire de 34 % s'applique automatiquement.
              On t'enverra un récapitulatif PDF en janvier pour t'aider à déclarer.
            </p>
          </div>
        </div>
      )}

      <section className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4">Tes gains {year}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Stat label="Primes Purama" value={totals.primes} />
          <Stat label="Parrainage" value={totals.parrainage} />
          <Stat label="Nature Rewards" value={totals.nature} />
          <Stat label="Marketplace" value={totals.marketplace} />
          <Stat label="Missions" value={totals.missions} />
          <Stat label="Total" value={totals.total} highlight />
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Progression vers le seuil de déclaration (3 000 €)</span>
            <span className="font-mono font-semibold">
              {totals.total.toFixed(2)} € / 3 000,00 €
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all"
              style={{ width: `${Math.min(100, (totals.total / THRESHOLD) * 100)}%` }}
            />
          </div>
          {!isOverThreshold && (
            <p className="text-xs text-white/50 mt-2">
              Il te reste {remainingToThreshold.toFixed(2)} € avant d'atteindre le seuil.
            </p>
          )}
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5" /> Comment déclarer
        </h2>
        <ol className="space-y-3 list-decimal list-inside text-sm text-white/85">
          <li>
            Rends-toi sur <a href="https://www.impots.gouv.fr" target="_blank" rel="noreferrer" className="text-[var(--color-accent)] underline inline-flex items-center gap-1">
              impots.gouv.fr <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>Dans ta déclaration, remplis la <strong className="text-white">case 5NG</strong> (revenus des plateformes numériques).</li>
          <li>Indique le montant total que Purama t'a versé dans l'année (récapitulatif ci-dessous).</li>
        </ol>
        <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 text-sm">
          <div className="font-semibold text-white">Abattement forfaitaire de 34 %</div>
          <p className="text-white/70 mt-1">
            Exemple : si tu as gagné 5 000 €, tu es imposé·e sur 5 000 × 66 % = 3 300 € seulement.
          </p>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Récapitulatif annuel
        </h2>
        <p className="text-sm text-white/70 mb-4">
          Télécharge ton récapitulatif {year} à fournir lors de ta déclaration. Disponible à tout moment, régénéré en direct.
        </p>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-accent)] text-white font-semibold hover:opacity-90 disabled:opacity-50 transition"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Génération...' : `Télécharger récapitulatif ${year}`}
        </button>

        {lastYearSummary && (
          <div className="mt-4 text-sm text-white/70">
            Récapitulatif {lastYearSummary.year} disponible —{' '}
            <span className="font-mono">{Number(lastYearSummary.total_annuel).toFixed(2)} €</span>
          </div>
        )}
      </section>

      <section className="glass-card p-6 text-sm text-white/65">
        <h3 className="font-semibold text-white mb-2">Mention légale</h3>
        <p>
          Les gains perçus via Purama peuvent être soumis à l'impôt sur le revenu selon ta situation fiscale et le montant perçu.
          En France, un seuil de déclaration s'applique à partir de 3 000 € de revenus annuels via des plateformes numériques.
          Purama t'informe automatiquement lorsque tu approches de ce seuil mais ne peut être tenu responsable de tes obligations fiscales individuelles.
          Consulte un conseiller fiscal pour ta situation personnelle.
        </p>
        <p className="mt-3">
          <Link href="/contact" className="text-[var(--color-accent)] underline">Questions ? Contacte le support</Link>
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40' : 'bg-white/[0.03] border-white/10'}`}>
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1">{value.toFixed(2)} €</div>
    </div>
  )
}
