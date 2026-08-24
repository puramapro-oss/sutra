import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { copyToClipboard } from '@/lib/utils'
import { WALLET_MIN_WITHDRAWAL, WALLET_MAX_WITHDRAWAL } from '@/lib/constants'
import type { ReferralCommission } from '@/types'

const supabase = createClient()

export interface Filleul {
  id: string
  email: string
  name: string | null
  status: 'active' | 'cancelled'
  created_at: string
}

export interface WalletData {
  balance: number
  pending_balance: number
  total_earned: number
}

export function useReferralData(userId: string | undefined, referralCode: string, shareUrl: string) {
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [filleuls, setFilleuls] = useState<Filleul[]>([])
  const [commissions, setCommissions] = useState<ReferralCommission[]>([])
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, pending_balance: 0, total_earned: 0 })

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState<'paypal' | 'bank'>('bank')
  const [withdrawIban, setWithdrawIban] = useState('')
  const [withdrawBic, setWithdrawBic] = useState('')
  const [withdrawPaypal, setWithdrawPaypal] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [filleulsRes, commissionsRes, walletRes] = await Promise.all([
        supabase
          .from('referrals')
          .select('referred_id, status, created_at, profiles!referrals_referred_id_fkey(id, email, name)')
          .eq('referrer_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('referral_commissions')
          .select('*')
          .eq('beneficiary_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('wallets')
          .select('balance, pending_balance, total_earned')
          .eq('user_id', userId)
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

    } catch {
      // Keep defaults on error
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (userId) fetchData()
  }, [userId, fetchData])

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
      toast.error(`Montant minimum : ${WALLET_MIN_WITHDRAWAL} EUR`)
      return
    }
    if (amount > WALLET_MAX_WITHDRAWAL) {
      toast.error(`Montant maximum : ${WALLET_MAX_WITHDRAWAL} EUR`)
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

  return {
    loading,
    copied,
    copiedLink,
    filleuls,
    commissions,
    wallet,
    withdrawAmount,
    withdrawMethod,
    withdrawIban,
    withdrawBic,
    withdrawPaypal,
    withdrawing,
    fetchData,
    handleCopyCode,
    handleCopyLink,
    handleWithdraw,
    setWithdrawAmount,
    setWithdrawMethod,
    setWithdrawIban,
    setWithdrawBic,
    setWithdrawPaypal,
  }
}
