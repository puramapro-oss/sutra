import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// CRON mensuel 1er jour 00h30 — snapshot + rewards + reset
function verifyCron(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  return auth === `Bearer ${expected}`
}

function previousMonthFirstDay(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Répartition primes top 100 — pyramide
const PRIZE_TIERS: Array<{ from: number; to: number; seeds: number }> = [
  { from: 1,  to: 1,  seeds: 10000 },
  { from: 2,  to: 2,  seeds: 5000 },
  { from: 3,  to: 3,  seeds: 3000 },
  { from: 4,  to: 10, seeds: 1500 },
  { from: 11, to: 25, seeds: 800 },
  { from: 26, to: 50, seeds: 400 },
  { from: 51, to: 100, seeds: 200 },
]

function prizeForRank(rank: number): number {
  for (const t of PRIZE_TIERS) {
    if (rank >= t.from && rank <= t.to) return t.seeds
  }
  return 0
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const service = createServiceClient()
    const periodClosed = previousMonthFirstDay()

    const { data: scores } = await service
      .from('karma_tournoi_scores')
      .select('id, user_id, total_score')
      .eq('period_month', periodClosed)
      .order('total_score', { ascending: false })
      .limit(100)

    const ranked = (scores ?? []).filter(s => s.total_score > 0)

    for (let i = 0; i < ranked.length; i++) {
      const rank = i + 1
      const prize = prizeForRank(rank)
      const row = ranked[i]

      await service
        .from('karma_tournoi_scores')
        .update({ rank, seeds_awarded: prize })
        .eq('id', row.id)

      if (prize > 0) {
        const { data: current } = await service
          .from('karma_seeds')
          .select('balance, lifetime_earned')
          .eq('user_id', row.user_id)
          .maybeSingle()
        const balance = current?.balance ?? 0
        const lifetime = current?.lifetime_earned ?? 0
        await service.from('karma_seeds').upsert(
          {
            user_id: row.user_id,
            balance: balance + prize,
            lifetime_earned: lifetime + prize,
          },
          { onConflict: 'user_id' }
        )
        await service.from('karma_seed_transactions').insert({
          user_id: row.user_id,
          amount: prize,
          direction: 'earn',
          source: 'tournoi_rank',
          source_ref: row.id,
          reason: `Tournoi Karma rank #${rank} (${periodClosed.slice(0, 7)})`,
        })
      }
    }

    return NextResponse.json({
      period_closed: periodClosed,
      winners_count: ranked.length,
      total_seeds_distributed: ranked.reduce((s, _, i) => s + prizeForRank(i + 1), 0),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
