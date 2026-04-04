import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

const CRON_SECRET = process.env.CRON_SECRET
const WEEKLY_POOL_PCT = 0.02
const WEEKLY_MIN = 10

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
      // Stripe unreachable — continue with 0 revenue
    }

    // 2. Close previous weekly contest and pick winner
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

      // Get all entries for this contest (weighted by number of places)
      const { data: entries } = await supabase
        .from('contest_entries')
        .select('user_id')
        .eq('contest_id', prevContest.id)

      if (entries && entries.length > 0 && rawPool >= WEEKLY_MIN) {
        // Weighted random pick
        const winnerIdx = Math.floor(Math.random() * entries.length)
        const winnerId = entries[winnerIdx].user_id

        // Get winner name
        const { data: winnerProfile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', winnerId)
          .single()

        const prizeAmount = Math.round(rawPool * 100) / 100

        // Credit wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance, total_earned')
          .eq('user_id', winnerId)
          .single()

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              balance: (wallet.balance ?? 0) + prizeAmount,
              total_earned: (wallet.total_earned ?? 0) + prizeAmount,
            })
            .eq('user_id', winnerId)
        } else {
          await supabase.from('wallets').insert({
            user_id: winnerId,
            balance: prizeAmount,
            total_earned: prizeAmount,
          })
        }

        // Save result
        await supabase.from('contest_results').insert({
          contest_id: prevContest.id,
          user_id: winnerId,
          rank: 1,
          prize_amount: prizeAmount,
        })

        // Close contest
        await supabase
          .from('contests')
          .update({
            status: 'completed',
            prize_pool_amount: prizeAmount,
            winner_ids: [winnerId],
            rankings: [{
              user_id: winnerId,
              name: winnerProfile?.name ?? winnerProfile?.email ?? 'Anonyme',
              score: entries.filter((e) => e.user_id === winnerId).length,
              prize: prizeAmount,
              rank: 1,
            }],
          })
          .eq('id', prevContest.id)
      } else if (rawPool < WEEKLY_MIN) {
        // Report: close without winner, carry over
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)

        // Carry over the amount to next contest
        const nextCarry = rawPool
        await createNextWeeklyContest(supabase, now, nextCarry)
        return NextResponse.json({
          action: 'carried_over',
          amount: nextCarry,
          reason: `Pool ${rawPool.toFixed(2)}€ < minimum ${WEEKLY_MIN}€`,
        })
      } else {
        // No entries
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)
      }
    }

    // 3. Create new weekly contest
    await createNextWeeklyContest(supabase, now, 0)

    return NextResponse.json({ status: 'ok', weeklyRevenue, pool: weeklyRevenue * WEEKLY_POOL_PCT })
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
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 || 7)
  nextMonday.setHours(12, 0, 0, 0)

  const weekNum = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  )

  await supabase.from('contests').insert({
    type: 'weekly',
    period_label: `Semaine ${weekNum} — ${now.getFullYear()}`,
    period_start: now.toISOString(),
    period_end: nextMonday.toISOString(),
    prize_pool_amount: 0,
    carried_over_amount: carriedOver,
    status: 'open',
  })

  // Auto-enter all users with 1 place per signup
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
