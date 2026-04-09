import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

const CRON_SECRET = process.env.CRON_SECRET
const MONTHLY_POOL_PCT = 0.04 // 4% du CA
const MONTHLY_MIN = 50
// Distribution: 1er=1.2%, 2eme=0.8%, 3eme=0.6%, 4eme=0.4%, 5-10eme=0.2% each = 1.0%
const PRIZE_DISTRIBUTION = [0.30, 0.20, 0.15, 0.10, 0.05, 0.05, 0.05, 0.05, 0.025, 0.025]

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })

  try {
    const now = new Date()
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // 1. Get Stripe revenue for past month
    let monthlyRevenue = 0
    try {
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(monthAgo.getTime() / 1000) },
        limit: 100,
      })
      monthlyRevenue = charges.data
        .filter((c) => c.status === 'succeeded')
        .reduce((sum, c) => sum + c.amount, 0) / 100
    } catch {
      // Stripe unreachable — continue with 0
    }

    // 2. Close previous monthly contest (TIRAGE = random)
    const { data: prevContest } = await supabase
      .from('contests')
      .select('*')
      .eq('type', 'monthly')
      .eq('status', 'open')
      .order('period_end', { ascending: true })
      .limit(1)
      .single()

    if (prevContest) {
      const carriedOver = prevContest.carried_over_amount ?? 0
      const rawPool = monthlyRevenue * MONTHLY_POOL_PCT + carriedOver

      // Get lottery tickets for this draw
      const { data: tickets } = await supabase
        .from('lottery_tickets')
        .select('user_id')
        .eq('draw_id', prevContest.id)

      // Fallback to contest entries if no lottery tickets
      const entries = tickets && tickets.length > 0
        ? tickets
        : (await supabase
            .from('contest_entries')
            .select('user_id')
            .eq('contest_id', prevContest.id)
          ).data ?? []

      const uniqueUserIds = [...new Set(entries.map(e => e.user_id))]

      if (uniqueUserIds.length >= 3 && rawPool >= MONTHLY_MIN) {
        // Random tirage — shuffle and pick 10
        const shuffled = [...uniqueUserIds].sort(() => Math.random() - 0.5)
        const winnerCount = Math.min(10, shuffled.length)
        const winnerIds = shuffled.slice(0, winnerCount)

        const rankings: Array<{ user_id: string; name: string; prize: number; rank: number; tickets: number }> = []
        const amounts: number[] = []

        for (let i = 0; i < winnerCount; i++) {
          const distPct = PRIZE_DISTRIBUTION[i] ?? PRIZE_DISTRIBUTION[PRIZE_DISTRIBUTION.length - 1]
          const prize = Math.round(rawPool * distPct * 100) / 100

          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email, wallet_balance')
            .eq('id', winnerIds[i])
            .single()

          // Credit wallet
          await supabase
            .from('profiles')
            .update({ wallet_balance: (profile?.wallet_balance ?? 0) + prize })
            .eq('id', winnerIds[i])

          // Record lottery winner
          await supabase.from('lottery_winners').insert({
            draw_id: prevContest.id,
            user_id: winnerIds[i],
            rank: i + 1,
            amount_won: prize,
          })

          // Notify winner
          await supabase.from('user_notifications').insert({
            user_id: winnerIds[i],
            type: 'lottery_win',
            title: `Tu as gagne au tirage mensuel !`,
            message: `Place ${i + 1} — ${prize.toFixed(2)} EUR credites sur ton wallet !`,
          })

          const userTickets = entries.filter(e => e.user_id === winnerIds[i]).length
          rankings.push({
            user_id: winnerIds[i],
            name: profile?.name ?? profile?.email ?? 'Createur',
            prize,
            rank: i + 1,
            tickets: userTickets,
          })
          amounts.push(prize)
        }

        // Save contest results
        await supabase.from('contest_results').insert({
          period: prevContest.period_label,
          type: 'monthly',
          winners: winnerIds.map((id, i) => ({ user_id: id, rank: i + 1, name: rankings[i].name })),
          amounts,
          total_pool: rawPool,
        })

        // Pool transaction
        await supabase.from('pool_transactions').insert({
          pool_type: 'reward',
          amount: amounts.reduce((a, b) => a + b, 0),
          direction: 'out',
          reason: 'tirage_payout',
          metadata: { contest_id: prevContest.id, type: 'monthly' },
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

        // Update lottery_draws status
        await supabase
          .from('lottery_draws')
          .update({ status: 'completed', pool_amount: rawPool })
          .eq('id', prevContest.id)

      } else if (rawPool < MONTHLY_MIN) {
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)

        await createNextMonthlyContest(supabase, now, rawPool)
        return NextResponse.json({
          action: 'carried_over',
          amount: rawPool,
          reason: `Pool ${rawPool.toFixed(2)} EUR < minimum ${MONTHLY_MIN} EUR`,
        })
      } else {
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)
      }
    }

    // 3. Create new monthly contest + lottery draw
    await createNextMonthlyContest(supabase, now, 0)

    return NextResponse.json({
      status: 'ok',
      monthlyRevenue,
      pool: monthlyRevenue * MONTHLY_POOL_PCT,
      winners: 10,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function createNextMonthlyContest(
  supabase: ReturnType<typeof createServiceClient>,
  now: Date,
  carriedOver: number
) {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  endOfMonth.setHours(23, 59, 0, 0)

  const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre']

  await supabase.from('contests').insert({
    type: 'monthly',
    period_label: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
    period_start: now.toISOString(),
    period_end: endOfMonth.toISOString(),
    prize_pool_amount: 0,
    carried_over_amount: carriedOver,
    status: 'open',
  })

  // Create corresponding lottery draw
  await supabase.from('lottery_draws').insert({
    draw_date: endOfMonth.toISOString(),
    pool_amount: 0,
    status: 'upcoming',
  })

  // Auto-enter all users
  const { data: profiles } = await supabase.from('profiles').select('id')
  if (profiles) {
    const { data: newContest } = await supabase
      .from('contests')
      .select('id')
      .eq('status', 'open')
      .eq('type', 'monthly')
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

      // Give each user 1 inscription ticket
      const { data: draw } = await supabase
        .from('lottery_draws')
        .select('id')
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (draw) {
        const ticketEntries = profiles.map((p) => ({
          user_id: p.id,
          source: 'inscription' as const,
          draw_id: draw.id,
        }))
        await supabase.from('lottery_tickets').insert(ticketEntries)
      }
    }
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
