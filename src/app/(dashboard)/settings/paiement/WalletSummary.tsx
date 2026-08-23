import { Wallet } from 'lucide-react'
import { MIN_WITHDRAWAL } from './types'

export default function WalletSummary({ principal }: { principal: number }) {
  return (
    <section
      data-testid="wallet-summary"
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-[#7C3AED]" />
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50">Solde Principal</p>
            <p className="text-2xl font-bold text-white">{principal.toFixed(2)}€</p>
          </div>
        </div>
        <p className="text-xs text-white/40">
          Seuil minimum retrait&nbsp;: <span className="font-mono text-white/70">{MIN_WITHDRAWAL}€</span>
        </p>
      </div>
    </section>
  )
}
