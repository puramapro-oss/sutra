import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const PostSchema = z.object({
  action: z.enum(['earn', 'spend']),
  amount: z.number().int().min(1).max(1000000),
  source: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const MILESTONES = [
  { threshold: 25000, euros: 2.5 },
  { threshold: 50000, euros: 5 },
  { threshold: 100000, euros: 10 },
  { threshold: 250000, euros: 25 },
  { threshold: 500000, euros: 50 },
  { threshold: 1000000, euros: 100 },
] as const

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [pointsRes, txRes, profileRes] = await Promise.all([
      service
        .from('purama_points')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .single(),
      service
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      service
        .from('profiles')
        .select('streak, level, xp, purama_points')
        .eq('id', user.id)
        .single(),
    ])

    return NextResponse.json({
      points: {
        balance: pointsRes.data?.balance ?? 0,
        lifetime_earned: pointsRes.data?.lifetime_earned ?? 0,
      },
      transactions: txRes.data ?? [],
      streak: profileRes.data?.streak ?? 0,
      level: profileRes.data?.level ?? 1,
      xp: profileRes.data?.xp ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { action, amount, source, description } = parsed.data
    const service = createServiceClient()

    // Get or create purama_points row
    let { data: points } = await service
      .from('purama_points')
      .select('balance, lifetime_earned')
      .eq('user_id', user.id)
      .single()

    if (!points) {
      const { data: created } = await service
        .from('purama_points')
        .insert({ user_id: user.id, balance: 0, lifetime_earned: 0 })
        .select('balance, lifetime_earned')
        .single()
      points = created ?? { balance: 0, lifetime_earned: 0 }
    }

    if (action === 'spend') {
      if (points.balance < amount) {
        return NextResponse.json(
          { error: `Solde insuffisant. Tu as ${points.balance} points, il en faut ${amount}.` },
          { status: 400 }
        )
      }

      const newBalance = points.balance - amount

      await service
        .from('purama_points')
        .update({ balance: newBalance })
        .eq('user_id', user.id)

      await service.from('point_transactions').insert({
        user_id: user.id,
        amount: -amount,
        type: 'spend',
        source,
        description: description ?? `Depense de ${amount} points (${source})`,
      })

      // Update profile purama_points
      await service
        .from('profiles')
        .update({ purama_points: newBalance })
        .eq('id', user.id)

      return NextResponse.json({
        success: true,
        action: 'spend',
        amount,
        newBalance,
      })
    }

    // action === 'earn'
    const newBalance = points.balance + amount
    const newLifetime = points.lifetime_earned + amount

    await service
      .from('purama_points')
      .update({ balance: newBalance, lifetime_earned: newLifetime })
      .eq('user_id', user.id)

    await service.from('point_transactions').insert({
      user_id: user.id,
      amount,
      type: 'earn',
      source,
      description: description ?? `Gain de ${amount} points (${source})`,
    })

    // Update profile purama_points
    await service
      .from('profiles')
      .update({ purama_points: newBalance })
      .eq('id', user.id)

    // Check milestones for auto-conversion
    const newlyUnlocked: Array<{ threshold: number; euros: number }> = []

    for (const milestone of MILESTONES) {
      if (newLifetime >= milestone.threshold) {
        // Check if already claimed
        const { data: existing } = await service
          .from('point_milestones')
          .select('id')
          .eq('user_id', user.id)
          .eq('milestone_reached', milestone.threshold)
          .single()

        if (!existing) {
          // Record milestone
          await service.from('point_milestones').insert({
            user_id: user.id,
            milestone_reached: milestone.threshold,
            amount_converted: milestone.euros,
          })

          // Add to wallet balance on profile
          const { data: profile } = await service
            .from('profiles')
            .select('wallet_balance')
            .eq('id', user.id)
            .single()

          const currentWallet = profile?.wallet_balance ?? 0
          await service
            .from('profiles')
            .update({ wallet_balance: currentWallet + milestone.euros })
            .eq('id', user.id)

          // Also update wallets table if it exists
          const { data: wallet } = await service
            .from('wallets')
            .select('balance, total_earned')
            .eq('user_id', user.id)
            .single()

          if (wallet) {
            await service
              .from('wallets')
              .update({
                balance: wallet.balance + milestone.euros,
                total_earned: wallet.total_earned + milestone.euros,
              })
              .eq('user_id', user.id)

            await service.from('wallet_transactions').insert({
              user_id: user.id,
              type: 'credit',
              amount: milestone.euros,
              source: 'points_milestone',
              description: `Conversion auto : ${milestone.threshold} points atteints = ${milestone.euros} EUR`,
            })
          }

          newlyUnlocked.push(milestone)
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: 'earn',
      amount,
      newBalance,
      newLifetime,
      milestones: newlyUnlocked.length > 0 ? newlyUnlocked : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
