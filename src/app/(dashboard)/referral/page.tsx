'use client'

import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useReferralData } from '@/hooks/useReferralData'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import ReferralCodeCard from '@/components/referral/ReferralCodeCard'
import ReferralStats from '@/components/referral/ReferralStats'
import ReferralTiers from '@/components/referral/ReferralTiers'
import FilleulsList from '@/components/referral/FilleulsList'
import WalletCard from '@/components/referral/WalletCard'
import CommissionsHistory from '@/components/referral/CommissionsHistory'

export default function ReferralPage() {
  const { profile, loading: authLoading } = useAuth()

  const referralCode = profile?.referral_code ?? ''
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pricing?ref=${referralCode}`
    : ''

  const {
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
  } = useReferralData(profile?.id, referralCode, shareUrl)

  const totalCommissions = commissions.reduce((a, c) => a + c.amount, 0)
  const pendingCommissions = commissions.filter((c) => c.status === 'pending').reduce((a, c) => a + c.amount, 0)
  const activeFilleuls = filleuls.filter((f) => f.status === 'active').length

  const referralSkeleton = (
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

  if (authLoading) return referralSkeleton

  return (
    <LoadingTimeout loading={loading} onRetry={fetchData} skeleton={referralSkeleton}>
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
        <ReferralCodeCard
          referralCode={referralCode}
          shareUrl={shareUrl}
          copied={copied}
          copiedLink={copiedLink}
          onCopyCode={handleCopyCode}
          onCopyLink={handleCopyLink}
        />

        {/* Stats */}
        <ReferralStats
          activeFilleuls={activeFilleuls}
          totalCommissions={totalCommissions}
          pendingCommissions={pendingCommissions}
        />

        {/* Tiers de parrainage */}
        <ReferralTiers activeFilleuls={activeFilleuls} />

        {/* Filleuls list */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Tes filleuls</h2>
          <FilleulsList filleuls={filleuls} />
        </div>

        {/* Wallet section */}
        <WalletCard
          wallet={wallet}
          withdrawAmount={withdrawAmount}
          withdrawMethod={withdrawMethod}
          withdrawIban={withdrawIban}
          withdrawBic={withdrawBic}
          withdrawPaypal={withdrawPaypal}
          withdrawing={withdrawing}
          onWithdraw={handleWithdraw}
          setWithdrawAmount={setWithdrawAmount}
          setWithdrawMethod={setWithdrawMethod}
          setWithdrawIban={setWithdrawIban}
          setWithdrawBic={setWithdrawBic}
          setWithdrawPaypal={setWithdrawPaypal}
        />

        {/* Commission history */}
        <div>
          <h2 className="text-sm font-semibold text-white/60 mb-3">Historique des commissions</h2>
          <CommissionsHistory commissions={commissions} />
        </div>
      </motion.div>
    </LoadingTimeout>
  )
}
