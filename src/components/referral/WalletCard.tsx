'use client'

import { Wallet, AlertCircle, Building2, CreditCard } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { WALLET_MIN_WITHDRAWAL } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { WalletData } from '@/hooks/useReferralData'

interface WalletCardProps {
  wallet: WalletData
  withdrawAmount: string
  withdrawMethod: 'paypal' | 'bank'
  withdrawIban: string
  withdrawBic: string
  withdrawPaypal: string
  withdrawing: boolean
  onWithdraw: () => void
  setWithdrawAmount: (val: string) => void
  setWithdrawMethod: (val: 'paypal' | 'bank') => void
  setWithdrawIban: (val: string) => void
  setWithdrawBic: (val: string) => void
  setWithdrawPaypal: (val: string) => void
}

export default function WalletCard({
  wallet,
  withdrawAmount,
  withdrawMethod,
  withdrawIban,
  withdrawBic,
  withdrawPaypal,
  withdrawing,
  onWithdraw,
  setWithdrawAmount,
  setWithdrawMethod,
  setWithdrawIban,
  setWithdrawBic,
  setWithdrawPaypal,
}: WalletCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Balance */}
      <Card>
        <CardContent>
          <h2 className="text-sm font-semibold text-white/60 mb-4">Wallet</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <span className="text-sm text-white/50">Solde disponible</span>
              <span
                className="text-xl font-bold text-white"
                data-testid="wallet-balance"
              >
                {formatPrice(wallet.balance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40">En attente</span>
              <span className="text-sm text-amber-400">{formatPrice(wallet.pending_balance)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/40">Total gagne</span>
              <span className="text-sm text-emerald-400">{formatPrice(wallet.total_earned)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal form */}
      <Card>
        <CardContent>
          <h2 className="text-sm font-semibold text-white/60 mb-4">Retrait</h2>
          <div className="space-y-4">
            <Input
              label="Montant (EUR)"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder={`Min ${WALLET_MIN_WITHDRAWAL} EUR`}
              data-testid="withdraw-amount"
            />

            {wallet.balance < WALLET_MIN_WITHDRAWAL && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">
                  Solde minimum de {formatPrice(WALLET_MIN_WITHDRAWAL)} requis pour un retrait.
                </p>
              </div>
            )}

            {/* Method selector */}
            <div>
              <label className="text-xs font-medium text-white/40 mb-2 block">Methode</label>
              <div className="flex gap-2">
                {[
                  { id: 'bank' as const, label: 'Virement bancaire', icon: Building2 },
                  { id: 'paypal' as const, label: 'PayPal', icon: CreditCard },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setWithdrawMethod(m.id)}
                    data-testid={`withdraw-method-${m.id}`}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all',
                      withdrawMethod === m.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                    )}
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bank details */}
            {withdrawMethod === 'bank' && (
              <div className="space-y-3">
                <Input
                  label="IBAN"
                  value={withdrawIban}
                  onChange={(e) => setWithdrawIban(e.target.value)}
                  placeholder="FR76..."
                  data-testid="withdraw-iban"
                />
                <Input
                  label="BIC"
                  value={withdrawBic}
                  onChange={(e) => setWithdrawBic(e.target.value)}
                  placeholder="BNPAFRPP"
                  data-testid="withdraw-bic"
                />
              </div>
            )}

            {/* PayPal details */}
            {withdrawMethod === 'paypal' && (
              <Input
                label="Email PayPal"
                type="email"
                value={withdrawPaypal}
                onChange={(e) => setWithdrawPaypal(e.target.value)}
                placeholder="email@paypal.com"
                data-testid="withdraw-paypal"
              />
            )}

            <Button
              onClick={onWithdraw}
              loading={withdrawing}
              disabled={wallet.balance < WALLET_MIN_WITHDRAWAL}
              className="w-full"
              data-testid="withdraw-btn"
            >
              <Wallet className="h-4 w-4" />
              Demander un retrait
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
