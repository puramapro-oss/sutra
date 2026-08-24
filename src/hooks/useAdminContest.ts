import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface Contest {
  id: string
  type: 'weekly' | 'monthly'
  period_label: string
  period_start: string
  period_end: string
  total_submissions: number
  prize_pool_amount: number
  status: 'open' | 'judging' | 'completed'
  created_at: string
}

export interface Submission {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  video_title: string
  ai_score: number | null
  community_votes: number
  status: string
  created_at: string
}

export interface HallOfFameEntry {
  id: string
  user_name: string
  contest_label: string
  rank: number
  prize_amount: number
}

export function useAdminContest() {
  const [contests, setContests] = useState<Contest[]>([])
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [judgingId, setJudgingId] = useState<string | null>(null)
  const [confirmingWinners, setConfirmingWinners] = useState(false)
  const [triggeringDraw, setTriggeringDraw] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Erreur chargement concours')
      setContests([])
      setActiveContest(null)
      setSubmissions([])
      setHallOfFame([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const triggerDraw = async (type: 'weekly' | 'monthly') => {
    setTriggeringDraw(type)
    try {
      const res = await fetch(`/api/cron/contest-${type}`)
      const data = await res.json()
      if (res.ok) {
        toast.success(`Tirage ${type === 'weekly' ? 'hebdomadaire' : 'mensuel'} declenche`)
        fetchData()
      } else {
        toast.error(data?.error ?? 'Erreur lors du tirage')
      }
    } catch {
      toast.error('Erreur lors du declenchement')
    } finally {
      setTriggeringDraw(null)
    }
  }

  const handleJudge = async (submissionId: string) => {
    setJudgingId(submissionId)
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'judge_submission', submission_id: submissionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, ai_score: data.score ?? 0, status: 'judged' } : s
          )
        )
        toast.success('Evaluation terminee')
      } else {
        toast.error('Erreur lors de l\'evaluation')
      }
    } catch {
      toast.error('Erreur lors de l\'evaluation')
    } finally {
      setJudgingId(null)
    }
  }

  const handleConfirmWinners = async () => {
    if (!activeContest) return
    setConfirmingWinners(true)
    try {
      const res = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'confirm_winners', contest_id: activeContest.id }),
      })
      if (res.ok) {
        toast.success('Gagnants confirmes et recompenses distribues')
        fetchData()
      } else {
        toast.error('Erreur lors de la confirmation')
      }
    } catch {
      toast.error('Erreur lors de la confirmation')
    } finally {
      setConfirmingWinners(false)
    }
  }

  return {
    contests,
    activeContest,
    submissions,
    hallOfFame,
    loading,
    error,
    judgingId,
    confirmingWinners,
    triggeringDraw,
    fetchData,
    triggerDraw,
    handleJudge,
    handleConfirmWinners,
  }
}
