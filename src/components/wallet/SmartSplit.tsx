'use client'

import { useEffect, useState } from 'react'
import { Wallet, Zap, Shield, Target, Clock, Heart } from 'lucide-react'
import { SUB_WALLET_LABELS, type SubWallet, type SubWalletBalances } from '@/lib/smart-split'

const CONFIG: Array<{
  key: SubWallet
  icon: typeof Wallet
  color: string
  bg: string
  pct: number
  description: string
}> = [
  { key: 'principal', icon: Wallet, color: 'text-violet-300', bg: 'bg-violet-400/15 border-violet-400/30', pct: 55, description: 'Dispo retrait + carte' },
  { key: 'boost',     icon: Zap,    color: 'text-amber-300',  bg: 'bg-amber-400/10 border-amber-400/25',    pct: 15, description: 'Bloqué 30j → +2%/mois, retour Principal' },
  { key: 'emergency', icon: Shield, color: 'text-red-300',    bg: 'bg-red-400/10 border-red-400/25',        pct: 10, description: 'Filet de sécurité plafonné' },
  { key: 'dream',     icon: Target, color: 'text-cyan-300',   bg: 'bg-cyan-400/10 border-cyan-400/25',      pct: 10, description: 'Vers ton objectif — confettis quand atteint' },
  { key: 'pending',   icon: Clock,  color: 'text-slate-300',  bg: 'bg-white/[0.03] border-white/10',        pct: 5,  description: 'Gains en vérification' },
  { key: 'solidaire', icon: Heart,  color: 'text-pink-300',   bg: 'bg-pink-400/10 border-pink-400/25',      pct: 5,  description: 'Virement mensuel auto → Asso PURAMA' },
]

export function SmartSplit() {
  const [balances, setBalances] = useState<SubWalletBalances | null>(null)
  const [totalBoost, setTotalBoost] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.sub_wallets) setBalances(d.sub_wallets)
        if (d?.boost_locked != null) setTotalBoost(d.boost_locked)
      })
      .catch(() => {})
  }, [])

  if (!balances) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-white/5 rounded" />)}
        </div>
      </div>
    )
  }

  const total = Object.values(balances).reduce((s, v) => s + v, 0)

  return (
    <div className="glass-card p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="font-semibold text-lg">Mon wallet — Smart Split</h3>
        <div className="font-mono font-bold text-xl">{total.toFixed(2)} €</div>
      </div>

      <p className="text-xs text-white/55 mb-5">
        Chaque gain est automatiquement réparti sur 6 sous-wallets pour t'aider à épargner, investir et donner sans y penser.
      </p>

      <div className="grid gap-2.5">
        {CONFIG.map((c) => {
          const Icon = c.icon
          const value = balances[c.key]
          return (
            <div key={c.key} className={`p-3.5 rounded-xl border ${c.bg}`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${c.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{SUB_WALLET_LABELS[c.key]}</span>
                      <span className="text-[10px] font-mono text-white/50">{c.pct}%</span>
                    </div>
                    <span className="font-mono font-semibold">{value.toFixed(2)} €</span>
                  </div>
                  <p className="text-xs text-white/60 mt-0.5">{c.description}</p>
                  {c.key === 'boost' && totalBoost != null && totalBoost > 0 && (
                    <p className="text-xs text-amber-300/80 mt-1">
                      {totalBoost.toFixed(2)} € en tranches actives (intérêts +2%/mois)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 pt-5 border-t border-white/10 text-xs text-white/50">
        <strong className="text-white/75">Retrait :</strong> uniquement depuis Principal.
        Les autres sous-wallets ont un rôle d'épargne auto, de solidarité ou d'objectif.
      </div>
    </div>
  )
}
