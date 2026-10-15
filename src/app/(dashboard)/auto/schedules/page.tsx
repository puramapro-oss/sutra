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
import type { AutoSchedule as Schedule } from '@/lib/sutra-auto-types'
import { requestClientJson } from '@/lib/production-intent-client'
import { reconcileScheduleChange, schedulesFromResponse, scheduleValidation, type ScheduleChange } from '@/lib/auto-schedule-client'

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
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
  const pendingChange = useRef<ScheduleChange | null>(null)
  const [editing, setEditing] = useState<Schedule | null>(null)
  const [validation, setValidation] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [timezone, setTimezone] = useState('Europe/Paris')
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
      const result = await requestClientJson('/api/auto/config', { signal: controller.signal })
      if (!result.ok) throw new Error('load_failed')
      const latest = schedulesFromResponse(result.body)
      if (loadRequest.current !== controller || controller.signal.aborted) return
      setSchedules(latest)
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

  const saveSchedules = useCallback(async (change: ScheduleChange) => {
    if (saveRequest.current) return false
    const intended = pendingChange.current ?? change
    pendingChange.current = intended
    const controller = new AbortController()
    saveRequest.current = controller
    setSaving(true); setSaveError(false); setMessage('Vérification et sauvegarde du planning…')
    try {
      const current = await requestClientJson('/api/auto/config', { signal: controller.signal })
      if (!current.ok) throw new Error('load_failed')
      const latest = schedulesFromResponse(current.body)
      const next = reconcileScheduleChange(latest, intended)
      let confirmed = latest
      if (!next.applied) {
        const result = await requestClientJson('/api/auto/config', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedules: next.schedules, expectedSchedules: latest }), signal: controller.signal,
        })
        if (result.status === 409) {
          // A concurrent writer may already have applied this exact intention.
          // Read once; never issue another PATCH automatically after a conflict.
          const fresh = await requestClientJson('/api/auto/config', { signal: controller.signal })
          if (!fresh.ok) throw new Error('save_unconfirmed')
          confirmed = schedulesFromResponse(fresh.body)
          if (!reconcileScheduleChange(confirmed, intended).applied) throw new Error('schedule_conflict')
        } else {
          if (!result.ok) throw new Error('save_failed')
          confirmed = schedulesFromResponse(result.body)
          if (!reconcileScheduleChange(confirmed, intended).applied) throw new Error('save_unconfirmed')
        }
      }
      if (saveRequest.current !== controller || controller.signal.aborted) return false
      setSchedules(confirmed); pendingChange.current = null
      setMessage('Planning sauvegardé. L’exécution dépend du moteur serveur et de l’autorisation globale.')
      toast.success('Planning sauvegarde')
      return true
    } catch (error) {
      if (saveRequest.current === controller) {
        setSaveError(true)
        setMessage(error instanceof Error && error.message === 'schedule_conflict'
          ? 'Ce planning a été modifié ailleurs. Recharge la page pour consulter sa version actuelle ; aucune écriture supplémentaire envoyée.'
          : 'Sauvegarde non confirmée. Vérifie son état avant toute nouvelle modification.')
      }
      return false
    } finally {
      if (saveRequest.current === controller) { saveRequest.current = null; setSaving(false) }
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (saveRequest.current) return
    const after: Schedule = {
      ...editing,
      id: editing?.id ?? draftId.current ?? (draftId.current = crypto.randomUUID()),
      name: name.trim(), is_active: editing?.is_active ?? true,
      frequency, days, time, timezone: timezone.trim(),
    }
    const invalid = scheduleValidation(after)
    setValidation(invalid)
    if (invalid) return
    if (!await saveSchedules({ before: editing, after })) return
    draftId.current = null; setEditing(null)
    setName(''); setFrequency('weekly'); setDays(['MO']); setTime('10:00'); setTimezone('Europe/Paris')
    setShowForm(false)
  }, [name, frequency, days, time, timezone, editing, saveSchedules])

  const handleDelete = useCallback(async (schedule: Schedule) => {
    await saveSchedules({ before: schedule, after: null })
  }, [saveSchedules])

  const editSchedule = (schedule: Schedule | null) => {
    setEditing(schedule); setName(schedule?.name ?? ''); setFrequency(schedule?.frequency ?? 'weekly')
    setDays(schedule?.days ?? ['MO']); setTime(schedule?.time ?? '10:00'); setTimezone(schedule?.timezone ?? 'Europe/Paris')
    draftId.current = null; setValidation(null); setShowForm(true)
  }

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
      <p role="status" aria-live="polite" className="text-sm text-white/80">{message}</p>
      <p className="text-sm text-white/70">Un planning actif autorise les prochaines occurrences. Le moteur serveur n’est pas vérifiable ici. Mettre en pause ou supprimer un planning n’annule pas une production déjà créée.</p>
      {saveError && <p role="alert" data-testid="schedule-save-error" className="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Sauvegarde non confirmée. Ton brouillon est conservé et reste figé jusqu’à confirmation. Réessayer consulte d’abord la configuration enregistrée ; une réponse perdue ne confirme pas l&apos;échec de l&apos;enregistrement.</p>}
      {saveError && !showForm && <Button variant="secondary" disabled={saving} onClick={() => pendingChange.current && void saveSchedules(pendingChange.current)}>Vérifier et réessayer</Button>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/60">{schedules.length} planning(s) configure(s)</p>
        <Button onClick={() => editSchedule(null)} disabled={saving || !!pendingChange.current} data-testid="schedule-add">
          <Plus className="h-4 w-4" /> Nouveau planning
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-semibold text-white">{editing ? 'Modifier le planning' : 'Nouveau planning'}</h2>
            {validation && <p role="alert" id="schedule-validation" className="text-red-200">{validation}</p>}
            <fieldset disabled={saving || !!pendingChange.current} className="space-y-4 min-w-0">
            <Input
              label="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vidéo motivation lundi"
              autoFocus
              aria-describedby={validation ? 'schedule-validation' : undefined}
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
                  {DAYS.map((d, index) => (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      aria-label={DAY_LABELS[index]}
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

            <Input label="Fuseau horaire IANA" data-testid="schedule-timezone" value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Europe/Paris" aria-describedby="schedule-dst" />
            <p id="schedule-dst" className="text-xs text-white/70">Heure locale du fuseau choisi. Si cette heure n’existe pas au passage à l’heure d’été, le moteur utilise la première minute valide suivante. Au retour à l’heure d’hiver, une seule occurrence est prévue.</p>
            <p className="text-xs text-white/70">Toutes les 2 semaines suit les semaines alternées du moteur, indépendamment de la date de création. Mensuel : première occurrence de chaque jour sélectionné dans le mois.</p>
            <div>
              <label htmlFor="schedule-time" className="text-sm font-medium text-white/60 mb-2 block">Heure ({timezone})</label>
              <input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/40"
                data-testid="schedule-time"
              />
            </div>

            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" disabled={saving || !!pendingChange.current} onClick={() => { setShowForm(false); setEditing(null); setValidation(null) }}>Annuler</Button>
              <Button onClick={handleCreate} loading={saving} data-testid="schedule-save">
                {pendingChange.current ? 'Vérifier la sauvegarde' : editing ? 'Enregistrer les modifications' : 'Creer le planning'}
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
          action={{ label: 'Creer un planning', onClick: () => editSchedule(null) }}
        />
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <Card key={s.id} hover data-testid={`schedule-${s.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-violet-300" />
                  </div>
                  <div className="min-w-0 break-words">
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-white/80">{s.is_active ? 'Actif · prochaines occurrences autorisées' : 'En pause · prochaines occurrences désactivées'}</p>
                    <p className="text-xs text-white/70">
                      {FREQ.find((f) => f.id === s.frequency)?.label} -{' '}
                      {s.frequency !== 'daily' && s.days.join(', ')} - {s.time} ({s.timezone})
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" disabled={saving || !!pendingChange.current || showForm} aria-label={`Modifier le planning ${s.name}`} onClick={() => editSchedule(s)}>Modifier</Button>
                <Button variant="secondary" size="sm" disabled={saving || !!pendingChange.current || showForm} aria-label={`${s.is_active ? 'Mettre en pause' : 'Reprendre'} le planning ${s.name}`} onClick={() => void saveSchedules({ before: s, after: { ...s, is_active: !s.is_active } })}>{s.is_active ? 'Pause' : 'Reprendre'}</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(s)}
                  aria-label={`Supprimer le planning ${s.name}`}
                  disabled={saving || !!pendingChange.current || showForm}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  data-testid={`schedule-delete-${s.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
