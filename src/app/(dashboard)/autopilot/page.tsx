'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Zap, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PLAN_LIMITS, NICHES } from '@/lib/constants'
import Button from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { LoadingTimeout } from '@/components/ui/LoadingTimeout'
import { EmptyState } from '@/components/ui/EmptyState'
import AutopilotUpgradePrompt from '@/components/autopilot/AutopilotUpgradePrompt'
import AutopilotSeriesForm from '@/components/autopilot/AutopilotSeriesForm'
import AutopilotSeriesCard from '@/components/autopilot/AutopilotSeriesCard'
import type { AutopilotSeries } from '@/types'

const supabase = createClient()

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

  if (!hasAutopilot) return <AutopilotUpgradePrompt />

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
      <AutopilotSeriesForm
        show={showForm}
        formName={formName}
        setFormName={setFormName}
        formNiche={formNiche}
        setFormNiche={setFormNiche}
        formFrequency={formFrequency}
        setFormFrequency={setFormFrequency}
        formNetworks={formNetworks}
        toggleNetwork={toggleNetwork}
        formApproval={formApproval}
        setFormApproval={setFormApproval}
        saving={saving}
        onSave={handleCreate}
        onCancel={resetForm}
      />

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
            <AutopilotSeriesCard
              key={s.id}
              series={s}
              index={i}
              togglingId={togglingId}
              deletingId={deletingId}
              onToggle={toggleSeriesActive}
              onDelete={deleteSeries}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
