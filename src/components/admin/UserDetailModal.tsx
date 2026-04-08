'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { formatDate, formatPrice } from '@/lib/utils'
import { Mail, Calendar, CreditCard, Video, Wallet, AlertCircle } from 'lucide-react'

interface ProfileFull {
  id: string
  email: string
  name: string | null
  plan: string
  is_admin: boolean
  credits: number
  wallet_balance: number
  monthly_video_count: number
  subscription_status: string | null
  created_at: string
  updated_at: string
  referral_code?: string | null
  preferred_niche?: string | null
}

interface VideoRow {
  id: string
  title: string | null
  status: string | null
  created_at: string
}

interface PaymentRow {
  id: string
  amount: number
  status: string
  plan: string | null
  created_at: string
}

interface DetailsResponse {
  profile: ProfileFull
  videos: VideoRow[]
  payments: PaymentRow[]
}

export function UserDetailModal({
  userId,
  open,
  onClose,
}: {
  userId: string | null
  open: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<DetailsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !userId) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/users/${userId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err?.error ?? 'Erreur chargement')
        }
        return res.json() as Promise<DetailsResponse>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, userId])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Profil utilisateur"
      data-testid="admin-user-modal"
      className="max-w-2xl max-h-[85vh] overflow-y-auto"
    >
      {loading && (
        <div className="space-y-3">
          <Skeleton height={48} rounded="lg" />
          <Skeleton height={120} rounded="lg" />
          <Skeleton height={120} rounded="lg" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Erreur</p>
            <p className="text-red-400/70">{error}</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-sm font-semibold text-amber-400">
                {(data.profile.name ?? data.profile.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-white truncate">
                  {data.profile.name ?? 'Sans nom'}
                </p>
                <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3" />
                  {data.profile.email}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="info" size="sm">{data.profile.plan}</Badge>
                  {data.profile.subscription_status && (
                    <Badge
                      variant={data.profile.subscription_status === 'banned' ? 'error' : 'success'}
                      size="sm"
                    >
                      {data.profile.subscription_status}
                    </Badge>
                  )}
                  {data.profile.is_admin && <Badge variant="warning" size="sm">Admin</Badge>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Credits</p>
                <p className="text-sm font-semibold text-white mt-0.5">{data.profile.credits}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Wallet</p>
                <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                  {formatPrice(data.profile.wallet_balance ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Videos</p>
                <p className="text-sm font-semibold text-violet-400 mt-0.5">
                  {data.profile.monthly_video_count ?? 0}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/30 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Inscrit le {formatDate(data.profile.created_at)}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Video className="h-4 w-4 text-violet-400" />
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Videos recentes
              </h3>
            </div>
            {data.videos.length === 0 ? (
              <p className="text-xs text-white/30 italic">Aucune video</p>
            ) : (
              <ul className="space-y-1.5">
                {data.videos.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0"
                  >
                    <span className="text-white/70 truncate flex-1 mr-2">
                      {v.title ?? 'Sans titre'}
                    </span>
                    <span className="text-white/30 shrink-0">{formatDate(v.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Paiements recents
              </h3>
            </div>
            {data.payments.length === 0 ? (
              <p className="text-xs text-white/30 italic">Aucun paiement</p>
            ) : (
              <ul className="space-y-1.5">
                {data.payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0"
                  >
                    <span className="text-white/70">
                      {p.plan ?? '—'} <span className="text-white/30">·</span> {formatDate(p.created_at)}
                    </span>
                    <span className="text-amber-400 font-medium">{formatPrice(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.profile.referral_code && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Wallet className="h-3 w-3" />
              Code de parrainage : <code className="text-amber-400">{data.profile.referral_code}</code>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
