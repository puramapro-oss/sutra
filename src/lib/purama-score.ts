// V6 Section 10 — Purama Score 0-1000
// Nature 30% | Streak 20% | Filleuls 20% | Marketplace 15% | Missions 15%

import { createServiceClient } from './supabase'

export type ScoreBreakdown = {
  score: number
  nature_score: number
  streak_score: number
  filleuls_score: number
  marketplace_score: number
  missions_score: number
}

export async function computePuramaScore(userId: string): Promise<ScoreBreakdown> {
  const service = createServiceClient()

  // Streak → max 200 pts (100 jours = max)
  const { data: profile } = await service
    .from('profiles')
    .select('streak')
    .eq('id', userId)
    .single()
  const streakDays = Math.min(Number(profile?.streak ?? 0), 100)
  const streakScore = Math.round((streakDays / 100) * 200)

  // Nature score → max 300 pts (Nature Rewards cumulés, 200€ = max)
  const { data: natureTx } = await service
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'credit')
    .like('source', 'nature%')
  const natureTotal = (natureTx ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const natureScore = Math.round((Math.min(natureTotal, 200) / 200) * 300)

  // Filleuls → max 200 pts (100 filleuls actifs = max)
  const { data: referrals } = await service
    .from('referrals')
    .select('id')
    .eq('referrer_id', userId)
    .eq('status', 'active')
    .eq('level', 1)
  const filleulsCount = Math.min(referrals?.length ?? 0, 100)
  const filleulsScore = Math.round((filleulsCount / 100) * 200)

  // Marketplace → max 150 pts (50 ventes = max)
  const { data: salesTx } = await service
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'credit')
    .eq('source', 'marketplace')
  const salesCount = Math.min((salesTx ?? []).length, 50)
  const marketplaceScore = Math.round((salesCount / 50) * 150)

  // Missions → max 150 pts (50 missions = max)
  const { data: missionTx } = await service
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'credit')
    .eq('source', 'mission')
  const missionCount = Math.min((missionTx ?? []).length, 50)
  const missionsScore = Math.round((missionCount / 50) * 150)

  const score = Math.min(1000, natureScore + streakScore + filleulsScore + marketplaceScore + missionsScore)

  const breakdown: ScoreBreakdown = {
    score,
    nature_score: natureScore,
    streak_score: streakScore,
    filleuls_score: filleulsScore,
    marketplace_score: marketplaceScore,
    missions_score: missionsScore,
  }

  // Cache en DB (upsert)
  await service.from('purama_scores').upsert(
    {
      user_id: userId,
      ...breakdown,
      calculated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  return breakdown
}
