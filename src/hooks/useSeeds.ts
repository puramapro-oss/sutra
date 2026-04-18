'use client'

import { useCallback, useEffect, useState } from 'react'

export interface SeedTransaction {
  id: string
  amount: number
  direction: 'earn' | 'spend'
  source: string
  reason: string | null
  created_at: string
}

export interface SeedsState {
  balance: number
  lifetime_earned: number
  lifetime_spent: number
  level: string
  level_index: number
  next_level: string | null
  next_level_threshold: number | null
  progress_percent: number
  transactions: SeedTransaction[]
}

const INITIAL: SeedsState = {
  balance: 0,
  lifetime_earned: 0,
  lifetime_spent: 0,
  level: 'Novice',
  level_index: 0,
  next_level: 'Sadhaka',
  next_level_threshold: 101,
  progress_percent: 0,
  transactions: [],
}

export function useSeeds() {
  const [state, setState] = useState<SeedsState>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/karma/seeds', { cache: 'no-store' })
      if (res.status === 401) {
        setState(INITIAL)
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setState({
        balance: data.balance ?? 0,
        lifetime_earned: data.lifetime_earned ?? 0,
        lifetime_spent: data.lifetime_spent ?? 0,
        level: data.level ?? 'Novice',
        level_index: data.level_index ?? 0,
        next_level: data.next_level ?? null,
        next_level_threshold: data.next_level_threshold ?? null,
        progress_percent: data.progress_percent ?? 0,
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, loading, error, refresh }
}
