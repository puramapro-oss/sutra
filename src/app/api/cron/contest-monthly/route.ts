import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Stripe from 'stripe'

const CRON_SECRET = process.env.CRON_SECRET
const MONTHLY_POOL_PCT = 0.03
const MONTHLY_MIN = 50
const MONTHLY_SPLIT = [0.60, 0.25, 0.15]

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
    const charges = await stripe.charges.list({
      created: { gte: Math.floor(monthAgo.getTime() / 1000) },
      limit: 100,
    })

    const monthlyRevenue = charges.data
      .filter((c) => c.status === 'succeeded')
      .reduce((sum, c) => sum + c.amount, 0) / 100

    // 2. Close previous monthly contest
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

      const { data: entries } = await supabase
        .from('contest_entries')
        .select('user_id')
        .eq('contest_id', prevContest.id)

      if (entries && entries.length >= 3 && rawPool >= MONTHLY_MIN) {
        // Pick 3 unique winners (weighted random)
        const shuffled = [...entries].sort(() => Math.random() - 0.5)
        const uniqueWinners: string[] = []
        for (const e of shuffled) {
          if (!uniqueWinners.includes(e.user_id)) {
            uniqueWinners.push(e.user_id)
          }
          if (uniqueWinners.length >= 3) break
        }

        const rankings = []
        for (let i = 0; i < uniqueWinners.length; i++) {
          const winnerId = uniqueWinners[i]
          const prizeAmount = Math.round(rawPool * MONTHLY_SPLIT[i] * 100) / 100

          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', winnerId)
            .single()

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

          await supabase.from('contest_results').insert({
            contest_id: prevContest.id,
            user_id: winnerId,
            rank: i + 1,
            prize_amount: prizeAmount,
          })

          rankings.push({
            user_id: winnerId,
            name: profile?.name ?? profile?.email ?? 'Anonyme',
            score: entries.filter((e) => e.user_id === winnerId).length,
            prize: prizeAmount,
            rank: i + 1,
          })
        }

        await supabase
          .from('contests')
          .update({
            status: 'completed',
            prize_pool_amount: rawPool,
            winner_ids: uniqueWinners,
            rankings,
          })
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
          reason: `Pool ${rawPool.toFixed(2)}€ < minimum ${MONTHLY_MIN}€`,
        })
      } else {
        await supabase
          .from('contests')
          .update({ status: 'completed', prize_pool_amount: 0 })
          .eq('id', prevContest.id)
      }
    }

    // 3. Create new monthly contest
    await createNextMonthlyContest(supabase, now, 0)

    return NextResponse.json({ status: 'ok', monthlyRevenue, pool: monthlyRevenue * MONTHLY_POOL_PCT })
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
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  endOfMonth.setHours(12, 0, 0, 0)

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
    }
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
