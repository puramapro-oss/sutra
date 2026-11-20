'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestClientJson } from '@/lib/production-intent-client'

export interface AutoSchedulerConfig {
  is_active: boolean
  schedules: Array<{ id: string; name: string; frequency: string; time: string }>
  auto_publish: boolean
  require_approval_before_publish: boolean
}

function configFrom(body: Record<string, unknown>): AutoSchedulerConfig {
  const value = body.config as AutoSchedulerConfig | undefined
  if (!value || typeof value.is_active !== 'boolean' || !Array.isArray(value.schedules) ||
    typeof value.auto_publish !== 'boolean' || typeof value.require_approval_before_publish !== 'boolean' ||
    value.schedules.some(s => !s || !['id', 'name', 'frequency', 'time'].every(key => typeof s[key as keyof typeof s] === 'string'))) {
    throw new Error('Configuration non confirmée')
  }
  return value
}

export function useAutoScheduler() {
  const [config, setConfig] = useState<AutoSchedulerConfig | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('Lecture de la préférence enregistrée…')
  const [target, setTarget] = useState<boolean | null>(null)
  const lock = useRef(false)
  const desired = useRef<boolean | null>(null)
  const mounted = useRef(false)
  const initial = useRef<ReturnType<typeof requestClientJson> | null>(null)

  const accept = useCallback((next: AutoSchedulerConfig) => {
    setConfig(next)
    setMessage(next.is_active ? 'Planification autorisée dans la configuration.' : 'Planification en pause dans la configuration.')
  }, [])

  useEffect(() => {
    mounted.current = true
    initial.current ??= requestClientJson('/api/auto/config')
    void initial.current.then(result => {
      if (!mounted.current) return
      if (!result.ok) throw new Error('Lecture indisponible')
      accept(configFrom(result.body))
    }).catch(() => {
      if (mounted.current) { setError('Configuration indisponible. Réessaie la lecture.'); setMessage('État de la préférence inconnu.') }
    }).finally(() => { if (mounted.current) setBusy(false) })
    return () => { mounted.current = false }
  }, [accept])

  const update = useCallback(async (retry = false) => {
    if (lock.current || busy) return
    lock.current = true; setBusy(true); setError(null)
    if (!retry && config) { desired.current = !config.is_active; setTarget(desired.current) }
    const expected = desired.current
    setMessage(expected === null ? 'Lecture de la préférence…' : 'Vérification de la préférence…')
    try {
      // After a lost acknowledgement, read first: never invert the saved preference.
      if (retry || expected === null) {
        const result = await requestClientJson('/api/auto/config')
        if (!mounted.current) return
        if (!result.ok) throw new Error('Lecture indisponible')
        const next = configFrom(result.body)
        accept(next)
        if (expected === null || next.is_active === expected) {
          desired.current = null; setTarget(null); return
        }
      }
      const result = await requestClientJson('/api/auto/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: expected }),
      })
      if (!mounted.current) return
      if (!result.ok) throw new Error('Écriture indisponible')
      const next = configFrom(result.body)
      if (next.is_active !== expected) throw new Error('Préférence non confirmée')
      accept(next); desired.current = null; setTarget(null)
    } catch {
      if (mounted.current) {
        setError('Réponse non confirmée. Vérifie la préférence serveur avant toute nouvelle modification.')
        setMessage('L’état affiché peut avoir changé sur le serveur.')
      }
    } finally {
      lock.current = false
      if (mounted.current) setBusy(false)
    }
  }, [busy, config, accept])

  return { config, busy, error, message, target, toggle: () => update(), retry: () => update(true) }
}
