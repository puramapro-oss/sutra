import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'
import { levelFromLifetime, progressToNextLevel } from '@/lib/karma-level'

const PostSchema = z.object({
  action: z.enum(['earn', 'spend']),
  amount: z.number().int().min(1).max(1000000),
  source: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()

    const [seedsRes, txRes] = await Promise.all([
      service
        .from('karma_seeds')
        .select('balance, lifetime_earned, lifetime_spent, level_sanskrit, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      service
        .from('karma_seed_transactions')
        .select('id, amount, direction, source, reason, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const seeds = seedsRes.data ?? {
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      level_sanskrit: 'Novice',
      updated_at: new Date().toISOString(),
    }

    const level = levelFromLifetime(seeds.lifetime_earned)
    const progress = progressToNextLevel(seeds.lifetime_earned)

    return NextResponse.json({
      balance: seeds.balance,
      lifetime_earned: seeds.lifetime_earned,
      lifetime_spent: seeds.lifetime_spent,
      level: level.name,
      level_index: level.index,
      next_level: progress.nextLevel,
      next_level_threshold: progress.nextThreshold,
      progress_percent: progress.percent,
      updated_at: seeds.updated_at,
      transactions: txRes.data ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide', details: parsed.error.issues }, { status: 400 })
    }

    const { action, amount, source, reason } = parsed.data
    const service = createServiceClient()

    // Lecture balance courante
    const { data: current } = await service
      .from('karma_seeds')
      .select('balance, lifetime_earned, lifetime_spent')
      .eq('user_id', user.id)
      .maybeSingle()

    const balance = current?.balance ?? 0

    if (action === 'spend' && balance < amount) {
      return NextResponse.json(
        { error: `Solde insuffisant : ${balance} graines, ${amount} requises.` },
        { status: 400 }
      )
    }

    const nextBalance = action === 'earn' ? balance + amount : balance - amount
    const nextLifetimeEarned = (current?.lifetime_earned ?? 0) + (action === 'earn' ? amount : 0)
    const nextLifetimeSpent = (current?.lifetime_spent ?? 0) + (action === 'spend' ? amount : 0)

    const { error: upsertErr } = await service
      .from('karma_seeds')
      .upsert(
        {
          user_id: user.id,
          balance: nextBalance,
          lifetime_earned: nextLifetimeEarned,
          lifetime_spent: nextLifetimeSpent,
        },
        { onConflict: 'user_id' }
      )

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    const { error: txErr } = await service.from('karma_seed_transactions').insert({
      user_id: user.id,
      amount,
      direction: action,
      source,
      reason: reason ?? null,
    })

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 })
    }

    const level = levelFromLifetime(nextLifetimeEarned)
    const progress = progressToNextLevel(nextLifetimeEarned)

    return NextResponse.json({
      balance: nextBalance,
      lifetime_earned: nextLifetimeEarned,
      lifetime_spent: nextLifetimeSpent,
      level: level.name,
      level_index: level.index,
      next_level: progress.nextLevel,
      next_level_threshold: progress.nextThreshold,
      progress_percent: progress.percent,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
