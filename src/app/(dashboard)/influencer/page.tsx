'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  DollarSign,
  TrendingUp,
  Link2,
  Copy,
  Check,
  QrCode,
  Wallet,
  Award,
  MessageCircle,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Download,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase'
import Button from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'

const supabase = createClient()

interface InfluencerStats {
  clicks: number
  signups: number
  conversions: number
  revenue: number
  conversion_rate: number
  tier: string
  slug: string
  wallet_balance: number
  pending_commissions: number
  total_earned: number
}

interface Referral {
  id: string
  referred_email: string | null
  status: string
  commission: number
  created_at: string
}

const TIERS = [
  { name: 'Bronze', min: 10, color: 'text-orange-400', commission: '10%' },
  { name: 'Argent', min: 25, color: 'text-gray-300', commission: '11%' },
  { name: 'Or', min: 50, color: 'text-yellow-400', commission: '12%' },
  { name: 'Platine', min: 100, color: 'text-blue-300', commission: '13%' },
  { name: 'Diamant', min: 250, color: 'text-cyan-400', commission: '15%' },
  { name: 'Legende', min: 500, color: 'text-violet-400', commission: '17%' },
  { name: 'Titan', min: 5000, color: 'text-amber-300', commission: '20%' },
  { name: 'Eternel', min: 10000, color: 'text-pink-400', commission: '25%' },
]

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'referrals', label: 'Filleuls', icon: <Users className="h-4 w-4" /> },
  { id: 'tools', label: 'Outils', icon: <Link2 className="h-4 w-4" /> },
  { id: 'wallet', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
]

export default function InfluencerDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState<InfluencerStats | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [statsRes, referralsRes] = await Promise.all([
          fetch('/api/partner/stats', {
            headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
          }),
          fetch('/api/partner/referrals', {
            headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
          }),
        ])
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
        if (referralsRes.ok) {
          const data = await referralsRes.json()
          setReferrals(data.referrals ?? [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const referralLink = stats?.slug
    ? `https://sutra.purama.dev/go/${stats.slug}`
    : `https://sutra.purama.dev/go/${profile?.referral_code ?? ''}`

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Lien copie !')
    setTimeout(() => setCopied(false), 2000)
  }, [referralLink])

  const currentTier = TIERS.reduce((acc, t) => ((stats?.conversions ?? 0) >= t.min ? t : acc), TIERS[0])
  const nextTier = TIERS.find((t) => t.min > (stats?.conversions ?? 0))

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Dashboard Influenceur
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Niveau{' '}
            <span className={cn('font-semibold', currentTier.color)}>
              {currentTier.name}
            </span>{' '}
            — Commission base {currentTier.commission}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/partenaire/coach">
            <Button variant="ghost" size="sm">
              <MessageCircle className="h-4 w-4" />
              Coach IA
            </Button>
          </Link>
          <Link href="/partenaire/outils">
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
              Kit createur
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Clics', value: stats?.clicks ?? 0, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Filleuls', value: stats?.conversions ?? 0, icon: Users, color: 'text-green-400' },
          { label: 'Gains totaux', value: formatPrice(stats?.total_earned ?? 0), icon: DollarSign, color: 'text-amber-400' },
          { label: 'Wallet', value: formatPrice(stats?.wallet_balance ?? 0), icon: Wallet, color: 'text-violet-400' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                  <span className="text-xs text-white/40">{kpi.label}</span>
                </div>
                <p className="text-xl font-bold text-white">{kpi.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tier Progress */}
      {nextTier && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">
                Progression vers <span className={cn('font-semibold', nextTier.color)}>{nextTier.name}</span>
              </span>
              <span className="text-xs text-white/40">
                {stats?.conversions ?? 0} / {nextTier.min} filleuls
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((stats?.conversions ?? 0) / nextTier.min) * 100, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        tabs={TABS}
        defaultTab="overview"
        className="mb-6"
      >
        {(activeTab) => (
          <>
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Taux de conversion</h3>
              <div className="flex items-end gap-4">
                <p className="text-3xl font-bold text-white">
                  {((stats?.conversion_rate ?? 0) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-white/40 pb-1">
                  {stats?.signups ?? 0} inscriptions / {stats?.clicks ?? 0} clics
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Commissions en attente</h3>
              <p className="text-3xl font-bold text-amber-400">
                {formatPrice(stats?.pending_commissions ?? 0)}
              </p>
              <p className="text-xs text-white/40 mt-1">
                Versees automatiquement dans ton wallet a chaque paiement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Paliers commissions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TIERS.slice(0, 8).map((t) => (
                  <div
                    key={t.name}
                    className={cn(
                      'p-3 rounded-xl border text-center',
                      (stats?.conversions ?? 0) >= t.min
                        ? 'bg-violet-500/10 border-violet-500/20'
                        : 'bg-white/[0.02] border-white/[0.06]'
                    )}
                  >
                    <p className={cn('text-xs font-semibold', t.color)}>{t.name}</p>
                    <p className="text-lg font-bold text-white mt-1">{t.commission}</p>
                    <p className="text-[10px] text-white/30">{t.min}+ filleuls</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="space-y-3">
          {referrals.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-8 w-8 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40">Aucun filleul pour le moment</p>
                <p className="text-xs text-white/25 mt-1">Partage ton lien pour commencer a gagner</p>
              </CardContent>
            </Card>
          ) : (
            referrals.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{r.referred_email ?? 'Utilisateur'}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={r.status === 'converted' ? 'success' : 'default'}>
                      {r.status === 'converted' ? 'Converti' : 'Inscrit'}
                    </Badge>
                    {r.commission > 0 && (
                      <span className="text-sm font-semibold text-green-400">
                        +{formatPrice(r.commission)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-4">
          {/* Referral Link */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Ton lien de parrainage</h3>
              <div className="flex gap-2">
                <div className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white/70 truncate">
                  {referralLink}
                </div>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/20 text-violet-400 hover:bg-violet-600/30 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">QR Code</h3>
              <p className="text-xs text-white/40 mb-3">
                Telecharge ton QR code pour le partager sur tes supports
              </p>
              <Link href="/partenaire/outils">
                <Button variant="secondary" size="sm">
                  <QrCode className="h-4 w-4" />
                  Generer QR Code
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Share Templates */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Templates de partage</h3>
              <div className="space-y-2">
                {[
                  { platform: 'Instagram / TikTok', text: `Genere des videos IA en 2 min avec SUTRA ! Essaie gratuitement : ${referralLink}` },
                  { platform: 'Twitter / X', text: `Je cree mes videos avec l'IA grace a @SutraPurama. 2 videos gratuites : ${referralLink}` },
                  { platform: 'Email / DM', text: `Salut ! J'utilise SUTRA pour generer des videos IA automatiquement (script, voix, visuels, musique). Tu peux essayer gratuitement ici : ${referralLink}` },
                ].map((tmpl) => (
                  <div
                    key={tmpl.platform}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white/60">{tmpl.platform}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(tmpl.text)
                          toast.success('Texte copie !')
                        }}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        Copier
                      </button>
                    </div>
                    <p className="text-xs text-white/40 leading-relaxed">{tmpl.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'wallet' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Solde disponible</h3>
              <p className="text-3xl font-bold text-white">
                {formatPrice(stats?.wallet_balance ?? 0)}
              </p>
              <p className="text-xs text-white/40 mt-1">
                Retrait IBAN des 5 EUR
              </p>
              <div className="mt-4">
                <Link href="/wallet">
                  <Button size="sm">
                    <ArrowUpRight className="h-4 w-4" />
                    Gerer mon wallet
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Historique gains</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Total gagne</span>
                  <span className="text-white font-semibold">{formatPrice(stats?.total_earned ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">En attente</span>
                  <span className="text-amber-400 font-semibold">{formatPrice(stats?.pending_commissions ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Retire</span>
                  <span className="text-green-400 font-semibold">
                    {formatPrice((stats?.total_earned ?? 0) - (stats?.wallet_balance ?? 0) - (stats?.pending_commissions ?? 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
          </>
        )}
      </Tabs>
    </div>
  )
}
