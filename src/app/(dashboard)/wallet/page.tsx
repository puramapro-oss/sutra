'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPrice, formatDate } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { Input } from '@/components/ui/Input'
import Button from '@/components/ui/Button'

interface WalletData {
  balance: number
  pending_balance: number
  total_earned: number
  currency: string
}

interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  source: string
  description: string | null
  created_at: string
}

interface WithdrawalRecord {
  id: string
  amount: number
  status: string
  created_at: string
}

export default function WalletPage() {
  const { profile, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, pending_balance: 0, total_earned: 0, currency: 'EUR' })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])

  const [iban, setIban] = useState('')
  const [amount, setAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/wallet')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setWallet(data.wallet)
      setTransactions(data.transactions)
      setWithdrawals(data.withdrawals)
    } catch {
      // defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchData()
  }, [authLoading, profile?.id, fetchData])

  const handleWithdraw = async () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount < 5) {
      toast.error('Montant minimum : 5 EUR')
      return
    }
    if (numAmount > wallet.balance) {
      toast.error('Solde insuffisant')
      return
    }
    if (!iban || iban.length < 15) {
      toast.error('IBAN invalide')
      return
    }

    setWithdrawing(true)
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, iban }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur')
      }
      toast.success('Demande de retrait envoyee')
      setAmount('')
      setIban('')
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du retrait')
    } finally {
      setWithdrawing(false)
    }
  }

  const sourceLabels: Record<string, string> = {
    referral: 'Parrainage',
    contest: 'Concours',
    withdrawal: 'Retrait',
    bonus: 'Bonus',
    admin: 'Admin',
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton width={200} height={32} rounded="lg" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height={100} rounded="xl" />)}
        </div>
        <Skeleton width="100%" height={300} rounded="xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Wallet</h1>
        <p className="text-sm text-white/40 mt-1">Tes gains de parrainage et concours</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">Solde disponible</p>
                <p className="text-xl font-bold text-white">
                  <AnimatedCounter value={wallet.balance} decimals={2} suffix=" EUR" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">En attente</p>
                <p className="text-xl font-bold text-white">{formatPrice(wallet.pending_balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <ArrowDownLeft className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-white/40">Total gagne</p>
                <p className="text-xl font-bold text-white">{formatPrice(wallet.total_earned)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw section */}
      <Card>
        <CardContent>
          <h2 className="text-sm font-semibold text-white/60 mb-4">Retirer des fonds</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Montant (EUR)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Min 5 EUR"
              data-testid="withdraw-amount"
            />
            <Input
              label="IBAN"
              value={iban}
              onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="FR76 XXXX XXXX XXXX"
              data-testid="withdraw-iban"
            />
          </div>
          <Button
            onClick={handleWithdraw}
            loading={withdrawing}
            disabled={wallet.balance < 5}
            className="mt-4"
            data-testid="withdraw-btn"
          >
            <Send className="h-4 w-4" />
            Demander un retrait
          </Button>
          {wallet.balance < 5 && (
            <p className="text-xs text-amber-400/60 mt-2">Solde minimum de 5 EUR requis</p>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Historique</h2>
        {transactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Aucune transaction"
            description="Tes gains de parrainage et concours apparaitront ici."
          />
        ) : (
          <Card>
            <div className="divide-y divide-white/[0.04]">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    tx.type === 'credit' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                  )}>
                    {tx.type === 'credit'
                      ? <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                      : <ArrowUpRight className="h-4 w-4 text-red-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate">
                      {tx.description ?? sourceLabels[tx.source] ?? tx.source}
                    </p>
                    <p className="text-xs text-white/30">{formatDate(tx.created_at)}</p>
                  </div>
                  <p className={cn(
                    'text-sm font-medium tabular-nums',
                    tx.type === 'credit' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {tx.type === 'credit' ? '+' : '-'}{formatPrice(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Withdrawal requests */}
      {withdrawals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Demandes de retrait</h2>
          <Card>
            <div className="divide-y divide-white/[0.04]">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-5 py-3.5">
                  {w.status === 'pending' && <Clock className="h-4 w-4 text-amber-400" />}
                  {w.status === 'processed' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  {w.status === 'rejected' && <XCircle className="h-4 w-4 text-red-400" />}
                  <div className="flex-1">
                    <p className="text-sm text-white/70">{formatPrice(w.amount)}</p>
                    <p className="text-xs text-white/30">{formatDate(w.created_at)}</p>
                  </div>
                  <Badge
                    variant={w.status === 'processed' ? 'success' : w.status === 'rejected' ? 'error' : 'warning'}
                    size="sm"
                  >
                    {w.status === 'pending' ? 'En attente' : w.status === 'processed' ? 'Traite' : 'Refuse'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  )
}
