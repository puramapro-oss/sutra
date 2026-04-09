import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

const CRON_SECRET = process.env.CRON_SECRET
const WEEKLY_POOL_PCT = 0.06 // 6% du CA
const WEEKLY_MIN = 10
// Distribution for 10 winners: 1er=2%, 2eme=1%, 3eme=0.7%, 4eme=0.5%, 5eme=0.4%, 6eme=0.3%, 7-10eme share 1.1%
const PRIZE_DISTRIBUTION = [0.333, 0.167, 0.117, 0.083, 0.067, 0.050, 0.046, 0.046, 0.046, 0.046]

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

  try {
    // 1. Get Stripe revenue for the past week
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    let weeklyRevenue = 0
    try {
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(weekAgo.getTime() / 1000) },
        limit: 100,
      })
      weeklyRevenue = charges.data
        .filter((c) => c.status === 'succeeded')
        .reduce((sum, c) => sum + c.amount, 0) / 100
    } catch {
      // Stripe unreachable — continue with 0
    }

    // 2. Close previous weekly contest
    const { data: prevContest } = await supabase
      .from('contests')
      .select('*')
      .eq('type', 'weekly')
      .eq('status', 'open')
      .order('period_end', { ascending: true })
      .limit(1)
      .single()

    if (prevContest) {
      const carriedOver = prevContest.carried_over_amount ?? 0
      const rawPool = weeklyRevenue * WEEKLY_POOL_PCT + carriedOver

      // Get entries with scores: parrainages×10 + abos×50 + actifs×5/j + missions×3
      const { data: entries } = await supabase
        .from('contest_entries')
        .select('user_id')
        .eq('contest_id', prevContest.id)

      const uniqueUserIds = [...new Set(entries?.map(e => e.user_id) ?? [])]

      if (uniqueUserIds.length >= 3 && rawPool >= WEEKLY_MIN) {
        // Calculate scores for each user
        const userScores: { user_id: string; score: number; name: string }[] = []

        for (const userId of uniqueUserIds) {
          // Count referrals
          const { count: referralCount } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', userId)

          // Count entries (proxy for activity)
          const entryCount = entries?.filter(e => e.user_id === userId).length ?? 0

          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, plan')
            .eq('id', userId)
            .single()

          const isSubscriber = profile?.plan && profile.plan !== 'free' ? 1 : 0
          const score = (referralCount ?? 0) * 10 + isSubscriber * 50 + entryCount * 5

          userScores.push({
            user_id: userId,
            score,
            name: profile?.name ?? profile?.email ?? 'Createur',
          })
        }

        // Sort by score descending
        userScores.sort((a, b) => b.score - a.score)

        // Take top 10
        const winnerCount = Math.min(10, userScores.length)
        const winners = userScores.slice(0, winnerCount)
        const rankings: Array<{ user_id: string; name: string; score: number; prize: number; rank: number }> = []
        const winnerIds: string[] = []
        const amounts: number[] = []

        for (let i = 0; i < winnerCount; i++) {
          const distPct = PRIZE_DISTRIBUTION[i] ?? PRIZE_DISTRIBUTION[PRIZE_DISTRIBUTION.length - 1]
          const prize = Math.round(rawPool * distPct * 100) / 100

          // Credit wallet on profiles
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', winners[i].user_id)
            .single()

          await supabase
            .from('profiles')
            .update({ wallet_balance: (existingProfile?.wallet_balance ?? 0) + prize })
            .eq('id', winners[i].user_id)

          // Notify winner
          await supabase.from('user_notifications').insert({
            user_id: winners[i].user_id,
            type: 'contest_win',
            title: `Tu es ${i + 1}${i === 0 ? 'er' : 'eme'} du classement hebdo !`,
            message: `Felicitations ! Tu remportes ${prize.toFixed(2)} EUR. Le montant a ete credite sur ton wallet.`,
          })

          rankings.push({
            user_id: winners[i].user_id,
            name: winners[i].name,
            score: winners[i].score,
            prize,
            rank: i + 1,
          })
          winnerIds.push(winners[i].user_id)
          amounts.push(prize)
        }

        // Save contest results
        await supabase.from('contest_results').insert({
          period: prevContest.period_label,
          type: 'weekly',
          winners: winnerIds.map((id, i) => ({ user_id: id, rank: i + 1, name: rankings[i].name })),
          amounts,
          total_pool: rawPool,
        })

        // Update pool_balances
        await supabase.from('pool_transactions').insert({
          pool_type: 'reward',
          amount: amounts.reduce((a, b) => a + b, 0),
          direction: 'out',
          reason: 'contest_payout',
          metadata: { contest_id: prevContest.id, type: 'weekly' },
        })

        // Close contest
        await supabase
          .from('contests')
          .update({
            status: 'completed',
            prize_pool_amount: rawPool,
            winner_ids: winnerIds,
            rankings,
          })
          .eq('id', prevContest.id)
      } else if (rawPool < WEEKLY_MIN) {
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)

        await createNextWeeklyContest(supabase, now, rawPool)
        return NextResponse.json({
          action: 'carried_over',
          amount: rawPool,
          reason: `Pool ${rawPool.toFixed(2)} EUR < minimum ${WEEKLY_MIN} EUR`,
        })
      } else {
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)
      }
    }

    // 3. Create new weekly contest
    await createNextWeeklyContest(supabase, now, 0)

    // 4. Record pool income (10% CA → reward pool)
    const rewardPoolIn = weeklyRevenue * 0.10
    if (rewardPoolIn > 0) {
      await supabase.from('pool_transactions').insert({
        pool_type: 'reward',
        amount: rewardPoolIn,
        direction: 'in',
        reason: 'ca_10pct',
      })
    }

    return NextResponse.json({
      status: 'ok',
      weeklyRevenue,
      pool: weeklyRevenue * WEEKLY_POOL_PCT,
      winners: 10,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function createNextWeeklyContest(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date,
  carriedOver: number
) {
  const nextSunday = new Date(now)
  nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7 || 7)
  nextSunday.setHours(23, 59, 0, 0)

  const weekNum = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  )

  await supabase.from('contests').insert({
    type: 'weekly',
    period_label: `Semaine ${weekNum} — ${now.getFullYear()}`,
    period_start: now.toISOString(),
    period_end: nextSunday.toISOString(),
    prize_pool_amount: 0,
    carried_over_amount: carriedOver,
    status: 'open',
  })

  // Auto-enter all active users
  const { data: profiles } = await supabase.from('profiles').select('id')
  if (profiles) {
    const { data: newContest } = await supabase
      .from('contests')
      .select('id')
      .eq('status', 'open')
      .eq('type', 'weekly')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (newContest) {
      const entries = profiles.map((p) => ({
        user_id: p.id,
        contest_id: newContest.id,
        source: 'signup',
      }))
      await supabase.from('contest_entries').insert(entries)
    }
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
