'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Wallet,
  TrendingUp,
  Clock,
  DollarSign,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn, formatPrice, formatDate, copyToClipboard } from '@/lib/utils'
import { WALLET_MIN_WITHDRAWAL, WALLET_MAX_WITHDRAWAL, REFERRAL_COMMISSIONS } from '@/lib/constants'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import type { ReferralCommission, Withdrawal } from '@/types'

const supabase = createClient()

interface Filleul {
  id: string
  email: string
  name: string | null
  status: 'active' | 'cancelled'
  created_at: string
}

interface WalletData {
  balance: number
  pending_balance: number
  total_earned: number
}

export default function ReferralPage() {
  const { profile, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [filleuls, setFilleuls] = useState<Filleul[]>([])
  const [commissions, setCommissions] = useState<ReferralCommission[]>([])
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, pending_balance: 0, total_earned: 0 })

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState<'paypal' | 'bank'>('bank')
  const [withdrawIban, setWithdrawIban] = useState('')
  const [withdrawBic, setWithdrawBic] = useState('')
  const [withdrawPaypal, setWithdrawPaypal] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const referralCode = profile?.referral_code ?? ''
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pricing?ref=${referralCode}`
    : ''

  useEffect(() => {
    if (authLoading || !profile) return

    async function fetchData() {
      setLoading(true)

      const [filleulsRes, commissionsRes, walletRes] = await Promise.all([
        supabase
          .from('referrals')
          .select('referred_id, status, created_at, profiles!referrals_referred_id_fkey(id, email, name)')
          .eq('referrer_id', profile!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('commissions')
          .select('*')
          .eq('beneficiary_id', profile!.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('wallets')
          .select('balance, pending_balance, total_earned')
          .eq('user_id', profile!.id)
          .single(),
      ])

      if (filleulsRes.data) {
        const mapped = filleulsRes.data.map((r: Record<string, unknown>) => {
          const p = r.profiles as Record<string, unknown> | null
          return {
            id: p?.id as string ?? '',
            email: p?.email as string ?? '',
            name: p?.name as string | null ?? null,
            status: r.status as 'active' | 'cancelled',
            created_at: r.created_at as string,
          }
        })
        setFilleuls(mapped)
      }

      if (commissionsRes.data) setCommissions(commissionsRes.data as ReferralCommission[])
      if (walletRes.data) setWallet(walletRes.data as WalletData)

      setLoading(false)
    }

    fetchData()
  }, [authLoading, profile])

  const handleCopyCode = useCallback(async () => {
    const ok = await copyToClipboard(referralCode)
    if (ok) {
      setCopied(true)
      toast.success('Code copie !')
      setTimeout(() => setCopied(false), 2000)
    }
  }, [referralCode])

  const handleCopyLink = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl)
    if (ok) {
      setCopiedLink(true)
      toast.success('Lien copie !')
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }, [shareUrl])

  const handleWithdraw = useCallback(async () => {
    const amount = parseFloat(withdrawAmount)

    if (isNaN(amount) || amount < WALLET_MIN_WITHDRAWAL) {
      toast.error(`Montant minimum : ${formatPrice(WALLET_MIN_WITHDRAWAL)}`)
      return
    }
    if (amount > WALLET_MAX_WITHDRAWAL) {
      toast.error(`Montant maximum : ${formatPrice(WALLET_MAX_WITHDRAWAL)}`)
      return
    }
    if (amount > wallet.balance) {
      toast.error('Solde insuffisant')
      return
    }

    if (withdrawMethod === 'bank' && (!withdrawIban.trim() || !withdrawBic.trim())) {
      toast.error('Renseigne ton IBAN et BIC')
      return
    }
    if (withdrawMethod === 'paypal' && !withdrawPaypal.trim()) {
      toast.error('Renseigne ton email PayPal')
      return
    }

    setWithdrawing(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: withdrawMethod,
          details: withdrawMethod === 'bank'
            ? { iban: withdrawIban, bic: withdrawBic }
            : { paypal_email: withdrawPaypal },
        }),
      })

      if (!res.ok) throw new Error('Withdrawal failed')
      toast.success('Demande de retrait envoyee !')
      setWithdrawAmount('')
      setWallet((prev) => ({
        ...prev,
        balance: prev.balance - amount,
        pending_balance: prev.pending_balance + amount,
      }))
    } catch {
      toast.error('Erreur lors du retrait')
    } finally {
      setWithdrawing(false)
    }
  }, [withdrawAmount, withdrawMethod, withdrawIban, withdrawBic, withdrawPaypal, wallet.balance])

  const totalCommissions = commissions.reduce((a, c) => a + c.amount, 0)
  const pendingCommissions = commissions.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0)
  const activeFilleuls = filleuls.filter((f) => f.status === 'active').length

  if (loading || authLoading) {
    return (
      <div className="space-y-6" data-testid="referral-loading">
        <Skeleton width={200} height={32} rounded="lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={100} rounded="xl" />
          ))}
        </div>
        <Skeleton width="100%" height={200} rounded="xl" />
        <Skeleton width="100%" height={300} rounded="xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Parrainage & Wallet</h1>
        <p className="text-sm text-white/40 mt-1">
          Invite des amis, gagne des commissions et retire tes gains
        </p>
      </div>

      {/* Referral code section */}
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
                  onClick={handleCopyCode}
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
                  onClick={handleCopyLink}
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Users,
            label: 'Filleuls actifs',
            value: activeFilleuls,
            color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
          },
          {
            icon: TrendingUp,
            label: 'Commissions gagnees',
            value: totalCommissions,
            prefix: '',
            suffix: ' EUR',
            decimals: 2,
            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          },
          {
            icon: Clock,
            label: 'En attente',
            value: pendingCommissions,
            prefix: '',
            suffix: ' EUR',
            decimals: 2,
            color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center border', stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-white/40">{stat.label}</p>
                  <p className="text-xl font-bold text-white">
                    <AnimatedCounter
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.decimals ?? 0}
                    />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filleuls list */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Tes filleuls</h2>
        {filleuls.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aucun filleul"
            description="Partage ton code pour commencer a gagner des commissions."
            data-testid="filleuls-empty"
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="filleuls-table">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Nom</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filleuls.map((f) => (
                    <tr key={f.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-sm text-white/70">{f.name ?? f.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/40">
                        {formatDate(f.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={f.status === 'active' ? 'success' : 'error'} size="sm">
                          {f.status === 'active' ? 'Actif' : 'Annule'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Wallet section */}
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
                onClick={handleWithdraw}
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

      {/* Commission history */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3">Historique des commissions</h2>
        {commissions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <DollarSign className="h-8 w-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">Aucune commission pour le moment</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="commissions-table">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Type</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Montant</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Statut</th>
                    <th className="text-left text-xs font-medium text-white/40 px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-3 text-sm text-white/70 capitalize">
                        {c.status === 'paid' ? 'Payee' : c.status === 'pending' ? 'En attente' : 'Annulee'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-400">
                        +{formatPrice(c.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            c.status === 'paid' ? 'success' : c.status === 'pending' ? 'warning' : 'error'
                          }
                          size="sm"
                        >
                          {c.status === 'paid' ? 'Payee' : c.status === 'pending' ? 'En attente' : 'Annulee'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/40">
                        {formatDate(c.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  )
}
