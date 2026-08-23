import { ArrowDownCircle, Info } from 'lucide-react'
import { MIN_WITHDRAWAL, RECOMMENDED_WITHDRAWAL } from './types'
import type { WithdrawOk } from './types'

type WithdrawFormProps = {
  principal: number
  ready: boolean
  withdraw: {
    status: 'idle' | 'loading'
    amount: number
    result?: WithdrawOk
    error?: string
  }
  onAmountChange: (amount: number) => void
  onSubmit: () => void
}

export default function WithdrawForm({
  principal,
  ready,
  withdraw,
  onAmountChange,
  onSubmit,
}: WithdrawFormProps) {
  return (
    <section
      data-testid="withdraw-form"
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        <ArrowDownCircle className="h-5 w-5 text-[#06B6D4]" />
        <h2 className="text-xl font-semibold text-white">Retirer mes gains</h2>
      </div>

      <label className="block text-sm text-white/70">
        Montant (€)
        <input
          type="number"
          min={MIN_WITHDRAWAL}
          max={Math.max(MIN_WITHDRAWAL, Math.floor(principal))}
          step={1}
          value={withdraw.amount}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          className="mt-2 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 font-mono text-white placeholder-white/30 focus:border-[#7C3AED] focus:outline-none"
          disabled={withdraw.status === 'loading' || !ready}
        />
      </label>

      {withdraw.amount < RECOMMENDED_WITHDRAWAL && withdraw.amount >= MIN_WITHDRAWAL && (
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-300/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Astuce&nbsp;: retire à partir de {RECOMMENDED_WITHDRAWAL}€ pour payer moins de frais (frais
          fixes absorbés). Frais prélevés par Stripe, pas par Purama.
        </p>
      )}

      <button
        type="button"
        data-testid="withdraw-submit"
        onClick={onSubmit}
        disabled={
          withdraw.status === 'loading' ||
          withdraw.amount < MIN_WITHDRAWAL ||
          withdraw.amount > principal ||
          !ready
        }
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {withdraw.status === 'loading' ? 'En cours…' : `Retirer ${withdraw.amount}€`}
      </button>

      {withdraw.error && (
        <p
          data-testid="withdraw-error"
          className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300"
        >
          {withdraw.error}
        </p>
      )}
      {withdraw.result && (
        <div
          data-testid="withdraw-success"
          className="mt-4 space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200"
        >
          <p className="font-semibold">Retrait envoyé 🎉</p>
          <p className="text-xs text-emerald-200/80">
            Transfer ID : <span className="font-mono">{withdraw.result.transferId}</span>
          </p>
          <p className="text-xs text-emerald-200/80">
            Net estimé : {withdraw.result.netEstimatedEur.toFixed(2)}€ (frais ~
            {withdraw.result.estimatedFeesEur.toFixed(2)}€)
          </p>
          {withdraw.result.tipMessage && (
            <p className="text-xs text-amber-300/80">{withdraw.result.tipMessage}</p>
          )}
        </div>
      )}
    </section>
  )
}
