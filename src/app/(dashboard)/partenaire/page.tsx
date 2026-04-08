'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  DollarSign,
  Wallet,
  Award,
  Copy,
  QrCode,
  ArrowUpRight,
  CheckCircle,
  Clock,
  TrendingUp,
  MessageCircle,
  Wrench,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { cn, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const PartnerCommissionsChart = dynamic(
  () => import('@/components/partner/PartnerCommissionsChart').then((m) => m.PartnerCommissionsChart),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-white/[0.02] animate-pulse" /> }
)

interface MonthlyPoint {
  month: string
  count: number
  commissions: number
}

interface RecentReferral {
  id: string
  referred_email: string | null
  status: string
  created_at: string
  first_payment_at: string | null
}

interface PartnerStats {
  partner_code: string
  total_referrals: number
  total_commissions: number
  balance: number
  tier: string
  pending_commissions: number
  share_url: string
  monthly_graph?: MonthlyPoint[]
  recent_referrals?: RecentReferral[]
}

interface Referral {
  id: string
  email: string
  created_at: string
  status: 'active' | 'pending'
}

export default function PartenaireDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const partnerCode = stats?.partner_code ?? profile?.referral_code ?? ''
  const shareUrl = stats?.share_url ?? (typeof window !== 'undefined'
    ? `${window.location.origin}/scan/${partnerCode}`
    : '')

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        const [statsRes, referralsRes] = await Promise.all([
          fetch('/api/partner/stats'),
          fetch('/api/partner/referrals').catch(() => null),
        ])
        if (statsRes.ok) {
          const data = (await statsRes.json()) as PartnerStats
          setStats(data)
          // Fallback : use stats.recent_referrals if dedicated endpoint failed
          if (data.recent_referrals && (!referralsRes || !referralsRes.ok)) {
            setReferrals(
              data.recent_referrals.map((r) => ({
                id: r.id,
                email: r.referred_email ?? 'utilisateur',
                created_at: r.created_at,
                status: r.status === 'active' || r.status === 'converted' ? 'active' : 'pending',
              }))
            )
          }
        }
        if (referralsRes?.ok) {
          const data = await referralsRes.json()
          setReferrals(data?.referrals ?? [])
        }
      } catch {
        // Graceful: show empty state
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silencieux
    }
  }

  const handleRequestWithdrawal = () => {
    window.location.href = '/dashboard/wallet'
  }

  const statCards = [
    {
      label: 'Filleuls',
      display: String(stats?.total_referrals ?? 0),
      icon: Users,
      color: 'text-violet-400',
    },
    {
      label: 'Commissions totales',
      display: formatPrice(stats?.total_commissions ?? 0),
      icon: DollarSign,
      color: 'text-emerald-400',
    },
    {
      label: 'Solde disponible',
      display: formatPrice(stats?.balance ?? 0),
      icon: Wallet,
      color: 'text-blue-400',
    },
    {
      label: 'Palier',
      display: stats?.tier ?? 'Bronze',
      icon: Award,
      color: 'text-amber-400',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Partenaire</h1>
            <p className="text-white/50 text-sm mt-1">
              Suis tes performances et gère ton activité partenaire.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/partenaire/outils">
              <Button variant="secondary" size="sm" data-testid="link-outils">
                <Wrench className="w-4 h-4" />
                Outils
              </Button>
            </Link>
            <Link href="/dashboard/partenaire/coach">
              <Button variant="primary" size="sm" data-testid="link-coach">
                <MessageCircle className="w-4 h-4" />
                Coach IA
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <card.icon className={cn('w-5 h-5', card.color)} />
                <TrendingUp className="w-4 h-4 text-white/20" />
              </div>
              {loading ? (
                <Skeleton height={28} className="mb-1" />
              ) : (
                <p className="text-xl font-bold text-white">{card.display}</p>
              )}
              <p className="text-xs text-white/40 mt-1">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Commissions evolution chart */}
        <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Évolution des commissions
          </h2>
          <div data-testid="partner-commissions-chart">
            <PartnerCommissionsChart data={stats?.monthly_graph ?? []} loading={loading} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <button
            onClick={handleCopyLink}
            data-testid="action-copy-link"
            className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-5 text-left hover:border-white/[0.12] transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              {copied ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5 text-violet-400" />
              )}
              <span className="font-medium text-white group-hover:text-violet-400 transition-colors">
                {copied ? 'Copié !' : 'Copier mon lien'}
              </span>
            </div>
            <p className="text-xs text-white/40 truncate">{shareUrl || 'Chargement...'}</p>
          </button>

          <Link
            href="/dashboard/partenaire/outils"
            data-testid="action-qr-code"
            className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-5 text-left hover:border-white/[0.12] transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <QrCode className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-white group-hover:text-blue-400 transition-colors">
                Générer QR Code
              </span>
            </div>
            <p className="text-xs text-white/40">Télécharge ton QR code personnalisé</p>
          </Link>

          <button
            onClick={handleRequestWithdrawal}
            data-testid="action-withdrawal"
            className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-5 text-left hover:border-white/[0.12] transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                Demander un retrait
              </span>
            </div>
            <p className="text-xs text-white/40">Dès 5 € par virement IBAN</p>
          </button>
        </div>

        {/* Recent referrals */}
        <div className="bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Derniers filleuls
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={48} />
              ))}
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/50 text-sm">Aucun filleul pour le moment</p>
              <p className="text-white/30 text-xs mt-1">
                Partage ton lien pour commencer à gagner des commissions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.slice(0, 10).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-violet-400">
                        {ref.email?.[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-white/80">{ref.email}</p>
                      <p className="text-xs text-white/30">
                        {new Date(ref.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      ref.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    )}
                  >
                    {ref.status === 'active' ? 'Actif' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
