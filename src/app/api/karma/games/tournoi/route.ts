import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { PILIER_ORDER } from '@/lib/karma-piliers'

function currentMonthFirstDay(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

interface ScoreRow {
  user_id: string
  score_mental: number
  score_corps: number
  score_social: number
  score_impact: number
  score_vision: number
  score_consistance: number
  score_innovation: number
  total_score: number
  rank: number | null
  seeds_awarded: number
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()
    const period = currentMonthFirstDay()

    // Top 100 du mois courant
    const { data: scoresRaw } = await service
      .from('karma_tournoi_scores')
      .select('*')
      .eq('period_month', period)
      .order('total_score', { ascending: false })
      .limit(100)

    const scores = (scoresRaw ?? []) as ScoreRow[]

    // Enrichir top avec profils
    const userIds = scores.map(s => s.user_id)
    let profilesMap: Record<string, { full_name: string | null; avatar: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name, avatar')
        .in('id', userIds)
      profilesMap = Object.fromEntries(
        (profiles ?? []).map(p => [p.id, { full_name: p.full_name, avatar: p.avatar }])
      )
    }

    const leaderboard = scores.map((s, i) => ({
      rank: i + 1,
      user_id: s.user_id,
      profile: profilesMap[s.user_id] ?? { full_name: null, avatar: null },
      total_score: s.total_score,
      scores: {
        mental: s.score_mental,
        corps: s.score_corps,
        social: s.score_social,
        impact: s.score_impact,
        vision: s.score_vision,
        consistance: s.score_consistance,
        innovation: s.score_innovation,
      },
    }))

    let myScore: (ScoreRow & { rank_computed: number }) | null = null
    if (user) {
      const mine = scores.find(s => s.user_id === user.id)
      if (mine) {
        const rank = scores.findIndex(s => s.user_id === user.id) + 1
        myScore = { ...mine, rank_computed: rank }
      } else {
        // Pas encore dans le top 100 — lire son propre score s'il existe
        const { data: self } = await service
          .from('karma_tournoi_scores')
          .select('*')
          .eq('period_month', period)
          .eq('user_id', user.id)
          .maybeSingle()
        if (self) myScore = { ...(self as ScoreRow), rank_computed: 0 }
      }
    }

    return NextResponse.json({
      period_month: period,
      piliers: PILIER_ORDER,
      leaderboard,
      my_score: myScore,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
