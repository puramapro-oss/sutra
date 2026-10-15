'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'

interface Schedule {
  id: string
  name: string
  is_active: boolean
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
  days: string[]
  time: string
  timezone: string
}

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const FREQ: Array<{ id: Schedule['frequency']; label: string }> = [
  { id: 'daily', label: 'Quotidien' },
  { id: 'weekly', label: 'Hebdomadaire' },
  { id: 'biweekly', label: 'Toutes les 2 semaines' },
  { id: 'monthly', label: '1er jour choisi du mois' },
]

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const loadRequest = useRef<AbortController | null>(null)
  const saveRequest = useRef<AbortController | null>(null)
  const draftId = useRef<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<Schedule['frequency']>('weekly')
  const [days, setDays] = useState<string[]>(['MO'])
  const [time, setTime] = useState('10:00')

  const fetchSchedules = useCallback(async () => {
    if (loadRequest.current) return
    const controller = new AbortController()
    loadRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/auto/config', { cache: 'no-store', signal: controller.signal })
      if (!res.ok) throw new Error('load_failed')
      const json = await res.json()
      if (!json || typeof json !== 'object' || !('config' in json) || (json.config != null && !Array.isArray(json.config.schedules))) throw new Error('invalid_schedules')
      if (loadRequest.current !== controller || controller.signal.aborted) return
      setSchedules(json.config?.schedules ?? [])
    } catch {
      if (loadRequest.current === controller) setLoadError(true)
    } finally {
      clearTimeout(timeout)
      if (loadRequest.current === controller) {
        loadRequest.current = null
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchSchedules()
    return () => {
      loadRequest.current?.abort()
      saveRequest.current?.abort()
      loadRequest.current = null
      saveRequest.current = null
    }
  }, [fetchSchedules])

  const saveSchedules = useCallback(async (next: Schedule[]) => {
    if (saveRequest.current) return false
    const controller = new AbortController()
    saveRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    setSaving(true)
    setSaveError(false)
    try {
      const res = await fetch('/api/auto/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: next }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('save_failed')
      const json = await res.json()
      if (!Array.isArray(json.config?.schedules)) throw new Error('invalid_schedules')
      if (saveRequest.current !== controller || controller.signal.aborted) return false
      setSchedules(json.config.schedules)
      toast.success('Planning sauvegarde')
      return true
    } catch {
      if (saveRequest.current === controller) setSaveError(true)
      return false
    } finally {
      clearTimeout(timeout)
      if (saveRequest.current === controller) {
        saveRequest.current = null
        setSaving(false)
      }
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (saveRequest.current) return
    if (!name.trim()) {
      toast.error('Donne un nom au planning')
      return
    }
    const next: Schedule[] = [
      ...schedules,
      {
        id: draftId.current ?? (draftId.current = crypto.randomUUID()),
        name: name.trim(),
        is_active: true,
        frequency,
        days,
        time,
        timezone: 'Europe/Paris',
      },
    ]
    if (!await saveSchedules(next)) return
    draftId.current = null
    setName('')
    setFrequency('weekly')
    setDays(['MO'])
    setTime('10:00')
    setShowForm(false)
  }, [name, frequency, days, time, schedules, saveSchedules])

  const handleDelete = useCallback(
    async (id: string) => saveSchedules(schedules.filter((s) => s.id !== id)),
    [schedules, saveSchedules]
  )

  const toggleDay = useCallback((d: string) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }, [])

  if (loading) return <div role="status" aria-label="Chargement des plannings"><Skeleton width="100%" height={300} rounded="xl" /></div>
  if (loadError) return (
    <div role="alert" data-testid="schedule-load-error" className="space-y-3 rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">
      <p>Impossible de vérifier les plannings. Leur état est indisponible.</p>
      <Button variant="secondary" onClick={() => void fetchSchedules()}>Réessayer</Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {saveError && <p role="alert" data-testid="schedule-save-error" className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Sauvegarde non confirmée. Ton brouillon est conservé. Vérifie la connexion avant de réessayer ; une réponse perdue ne confirme pas l&apos;échec de l&apos;enregistrement.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/60">{schedules.length} planning(s) configure(s)</p>
        <Button onClick={() => setShowForm(true)} disabled={saving} data-testid="schedule-add">
          <Plus className="h-4 w-4" /> Nouveau planning
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <Input
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vidéo motivation lundi"
              data-testid="schedule-name"
            />

            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Frequence</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FREQ.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFrequency(f.id)}
                    aria-pressed={frequency === f.id}
                    data-testid={`schedule-freq-${f.id}`}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                      frequency === f.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/70 hover:text-white'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {frequency !== 'daily' && (
              <div>
                <label className="text-sm font-medium text-white/60 mb-2 block">Jours</label>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      aria-pressed={days.includes(d)}
                      className={cn(
                        'px-2 py-2 rounded-lg text-xs font-medium border transition-all',
                        days.includes(d)
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/70'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="schedule-time" className="text-sm font-medium text-white/60 mb-2 block">Heure (Europe/Paris)</label>
              <input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/40"
                data-testid="schedule-time"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={handleCreate} loading={saving} data-testid="schedule-save">
                Creer le planning
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {schedules.length === 0 && !showForm ? (
        <EmptyState
          icon={Calendar}
          title="Aucun planning"
          description="Cree un planning pour automatiser la production de tes videos."
          action={{ label: 'Creer un planning', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} hover data-testid={`schedule-${s.id}`}>
              <CardContent className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-violet-300" />
                  </div>
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-white/70">
                      {FREQ.find((f) => f.id === s.frequency)?.label} -{' '}
                      {s.frequency !== 'daily' && s.days.join(', ')} - {s.time} ({s.timezone})
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(s.id)}
                  aria-label={`Supprimer le planning ${s.name}`}
                  disabled={saving}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  data-testid={`schedule-delete-${s.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
