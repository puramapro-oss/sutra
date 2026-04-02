'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Plus,
  Play,
  Pause,
  Clock,
  Trash2,
  Settings,
  PlayCircle,
  Camera,
  CheckCircle2,
  Crown,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { PLAN_LIMITS, NICHES } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import type { AutopilotSeries } from '@/types'

const supabase = createClient()

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88A2.89 2.89 0 019.49 12.4v-3.5a6.37 6.37 0 00-6.38 6.38 6.37 6.37 0 006.38 6.38 6.37 6.37 0 006.38-6.38V9.42a8.16 8.16 0 004.72 1.49V7.46a4.85 4.85 0 01-1-.77z" />
  </svg>
)

const NETWORK_OPTIONS = [
  { id: 'youtube', label: 'YouTube', icon: PlayCircle },
  { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
  { id: 'instagram', label: 'Instagram', icon: Camera },
] as const

export default function AutopilotPage() {
  const { profile, plan, loading: authLoading } = useAuth()

  const [series, setSeries] = useState<AutopilotSeries[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formNiche, setFormNiche] = useState<string>(NICHES[0])
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [formNetworks, setFormNetworks] = useState<string[]>([])
  const [formApproval, setFormApproval] = useState<'auto' | 'manual'>('manual')

  const limits = PLAN_LIMITS[plan]
  const canCreate = series.length < limits.autopilot
  const hasAutopilot = limits.autopilot > 0

  const fetchSeries = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('autopilot_series')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (data) setSeries(data as AutopilotSeries[])
    } catch {
      setSeries([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  useEffect(() => {
    if (!authLoading && profile?.id) fetchSeries()
  }, [authLoading, profile?.id, fetchSeries])

  const resetForm = useCallback(() => {
    setFormName('')
    setFormNiche(NICHES[0])
    setFormFrequency('weekly')
    setFormNetworks([])
    setFormApproval('manual')
    setShowForm(false)
  }, [])

  const toggleNetwork = useCallback((id: string) => {
    setFormNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    )
  }, [])

  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      toast.error('Donne un nom a ta serie')
      return
    }
    if (formNetworks.length === 0) {
      toast.error('Selectionne au moins un reseau')
      return
    }
    if (!canCreate) {
      toast.error('Limite de series atteinte pour ton plan')
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase.from('autopilot_series').insert({
        user_id: profile!.id,
        name: formName.trim(),
        niche: formNiche,
        frequency: formFrequency,
        networks: formNetworks,
        approval_mode: formApproval,
        is_active: true,
        config: {},
      }).select().single()

      if (error) throw error
      if (data) setSeries((prev) => [data as AutopilotSeries, ...prev])
      toast.success('Serie creee avec succes !')
      resetForm()
    } catch {
      toast.error('Erreur lors de la creation')
    } finally {
      setSaving(false)
    }
  }, [formName, formNiche, formFrequency, formNetworks, formApproval, canCreate, profile, resetForm])

  const toggleSeriesActive = useCallback(async (seriesItem: AutopilotSeries) => {
    setTogglingId(seriesItem.id)
    try {
      const { error } = await supabase
        .from('autopilot_series')
        .update({ is_active: !seriesItem.is_active })
        .eq('id', seriesItem.id)

      if (error) throw error
      setSeries((prev) =>
        prev.map((s) =>
          s.id === seriesItem.id ? { ...s, is_active: !s.is_active } : s
        )
      )
      toast.success(seriesItem.is_active ? 'Serie desactivee' : 'Serie activee')
    } catch {
      toast.error('Erreur')
    } finally {
      setTogglingId(null)
    }
  }, [])

  const deleteSeries = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('autopilot_series')
        .delete()
        .eq('id', id)

      if (error) throw error
      setSeries((prev) => prev.filter((s) => s.id !== id))
      toast.success('Serie supprimee')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }, [])

  const autopilotSkeleton = (
    <div className="space-y-6" data-testid="autopilot-loading">
      <Skeleton width={250} height={32} rounded="lg" />
      <Skeleton width="100%" height={200} rounded="xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={180} rounded="xl" />
        ))}
      </div>
    </div>
  )

  if (authLoading) return autopilotSkeleton

  if (loading) {
    return (
      <LoadingTimeout loading={loading} onRetry={fetchSeries} skeleton={autopilotSkeleton}>
        <div />
      </LoadingTimeout>
    )
  }

  // Plan limitation
  if (!hasAutopilot) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-5">
            <Crown className="h-7 w-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="autopilot-upgrade-title">
            Autopilot est disponible a partir du plan Creator
          </h1>
          <p className="text-sm text-white/40 max-w-md mx-auto mb-6">
            Programme des series de videos automatiques qui se publient toutes seules sur tes reseaux.
          </p>
          <Button
            onClick={() => window.location.assign('/pricing')}
            data-testid="autopilot-upgrade"
          >
            <Crown className="h-4 w-4" />
            Passer a Creator
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="autopilot-title">
            Autopilot
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {series.length}/{limits.autopilot} series actives
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          disabled={!canCreate}
          data-testid="autopilot-create"
        >
          <Plus className="h-4 w-4" />
          Nouvelle serie
        </Button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card>
              <CardContent className="space-y-5">
                <h2 className="text-lg font-semibold text-white">Nouvelle serie</h2>

                {/* Name */}
                <Input
                  label="Nom de la serie"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Motivation quotidienne"
                  data-testid="autopilot-name-input"
                />

                {/* Niche */}
                <div>
                  <label className="text-sm font-medium text-white/60 mb-2 block">Niche</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {NICHES.map((niche) => (
                      <button
                        key={niche}
                        onClick={() => setFormNiche(niche)}
                        data-testid={`niche-${niche}`}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                          formNiche === niche
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                        )}
                      >
                        {niche.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className="text-sm font-medium text-white/60 mb-2 block">Frequence</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'daily' as const, label: 'Quotidien' },
                      { id: 'weekly' as const, label: 'Hebdomadaire' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFormFrequency(f.id)}
                        data-testid={`frequency-${f.id}`}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-xl text-sm font-medium border transition-all',
                          formFrequency === f.id
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Networks */}
                <div>
                  <label className="text-sm font-medium text-white/60 mb-2 block">Reseaux</label>
                  <div className="flex gap-3">
                    {NETWORK_OPTIONS.map((net) => {
                      const Icon = net.icon
                      const active = formNetworks.includes(net.id)
                      return (
                        <button
                          key={net.id}
                          onClick={() => toggleNetwork(net.id)}
                          data-testid={`network-${net.id}`}
                          className={cn(
                            'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all',
                            active
                              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/60'
                          )}
                        >
                          <Icon />
                          {net.label}
                          {active && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Approval mode */}
                <div>
                  <label className="text-sm font-medium text-white/60 mb-2 block">Mode de validation</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'auto' as const, label: 'Automatique', desc: 'Publie sans validation' },
                      { id: 'manual' as const, label: 'Validation manuelle', desc: 'Tu valides avant publication' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setFormApproval(m.id)}
                        data-testid={`approval-${m.id}`}
                        className={cn(
                          'flex-1 px-4 py-3 rounded-xl border transition-all text-left',
                          formApproval === m.id
                            ? 'bg-violet-500/20 border-violet-500/40'
                            : 'bg-white/[0.02] border-white/[0.06]'
                        )}
                      >
                        <p className={cn('text-sm font-medium', formApproval === m.id ? 'text-violet-400' : 'text-white/50')}>
                          {m.label}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="secondary"
                    onClick={resetForm}
                    data-testid="autopilot-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleCreate}
                    loading={saving}
                    data-testid="autopilot-submit"
                  >
                    <Zap className="h-4 w-4" />
                    Creer la serie
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Series list */}
      {series.length === 0 && !showForm ? (
        <EmptyState
          icon={Zap}
          title="Aucune serie autopilot"
          description="Cree ta premiere serie pour automatiser la creation et publication de videos."
          action={{ label: 'Creer une serie', onClick: () => setShowForm(true) }}
          data-testid="autopilot-empty"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {series.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card hover data-testid={`series-card-${s.id}`}>
                <CardContent>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{s.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="premium" size="sm" className="capitalize">{s.niche}</Badge>
                        <Badge variant={s.frequency === 'daily' ? 'warning' : 'info'} size="sm">
                          {s.frequency === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleSeriesActive(s)}
                      disabled={togglingId === s.id}
                      data-testid={`series-toggle-${s.id}`}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors',
                        s.is_active ? 'bg-violet-500' : 'bg-white/10'
                      )}
                    >
                      <motion.div
                        animate={{ x: s.is_active ? 20 : 2 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white"
                      />
                    </button>
                  </div>

                  {/* Networks */}
                  <div className="flex items-center gap-2 mb-3">
                    {s.networks.map((n) => {
                      const net = NETWORK_OPTIONS.find((no) => no.id === n)
                      if (!net) return null
                      const Icon = net.icon
                      return (
                        <div
                          key={n}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-xs text-white/50"
                        >
                          <Icon />
                          {net.label}
                        </div>
                      )
                    })}
                  </div>

                  {/* Info */}
                  <div className="flex items-center justify-between text-xs text-white/30">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.next_run_at
                        ? `Prochain: ${new Date(s.next_run_at).toLocaleDateString('fr-FR')}`
                        : 'Non programme'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      {s.approval_mode === 'auto' ? 'Auto' : 'Manuelle'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSeries(s.id)}
                      loading={deletingId === s.id}
                      data-testid={`series-delete-${s.id}`}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Limit warning */}
      {!canCreate && series.length > 0 && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <Crown className="h-5 w-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm text-white/70">
                Tu as atteint la limite de {limits.autopilot} serie{limits.autopilot > 1 ? 's' : ''} pour ton plan.
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                Passe au plan superieur pour creer plus de series.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.assign('/pricing')}
              data-testid="autopilot-upgrade-inline"
            >
              Upgrader
            </Button>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
