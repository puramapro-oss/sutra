'use client'

import { useEffect, useState, useCallback } from 'react'
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
  { id: 'biweekly', label: 'Bi-mensuel' },
  { id: 'monthly', label: 'Mensuel' },
]

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<Schedule['frequency']>('weekly')
  const [days, setDays] = useState<string[]>(['MO'])
  const [time, setTime] = useState('10:00')

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auto/config')
      const json = await res.json()
      setSchedules(json.config?.schedules ?? [])
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const saveSchedules = useCallback(async (next: Schedule[]) => {
    setSaving(true)
    try {
      const res = await fetch('/api/auto/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: next }),
      })
      const json = await res.json()
      if (json.config) {
        setSchedules(json.config.schedules ?? [])
        toast.success('Planning sauvegarde')
      }
    } catch {
      toast.error('Erreur sauvegarde')
    } finally {
      setSaving(false)
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Donne un nom au planning')
      return
    }
    const next: Schedule[] = [
      ...schedules,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        is_active: true,
        frequency,
        days,
        time,
        timezone: 'Europe/Paris',
      },
    ]
    await saveSchedules(next)
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

  if (loading) return <Skeleton width="100%" height={300} rounded="xl" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{schedules.length} planning(s) configure(s)</p>
        <Button onClick={() => setShowForm(true)} data-testid="schedule-add">
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
                    data-testid={`schedule-freq-${f.id}`}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                      frequency === f.id
                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70'
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
                      className={cn(
                        'px-2 py-2 rounded-lg text-xs font-medium border transition-all',
                        days.includes(d)
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/40'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-white/60 mb-2 block">Heure</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/40"
                data-testid="schedule-time"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Annuler</Button>
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
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-white/40">
                      {FREQ.find((f) => f.id === s.frequency)?.label} -{' '}
                      {s.frequency !== 'daily' && s.days.join(', ')} - {s.time}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(s.id)}
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
