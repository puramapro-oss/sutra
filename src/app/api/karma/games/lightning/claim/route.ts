import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const ClaimSchema = z.object({
  deal_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ClaimSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: deal } = await service
      .from('karma_lightning_deals')
      .select('id, status, starts_at, ends_at, seeds_reward, max_claimers, claimers_count, title')
      .eq('id', parsed.data.deal_id)
      .maybeSingle()

    if (!deal) {
      return NextResponse.json({ error: 'Deal introuvable' }, { status: 404 })
    }
    const now = new Date()
    if (deal.status !== 'active' || new Date(deal.starts_at) > now || new Date(deal.ends_at) < now) {
      return NextResponse.json({ error: 'Deal expiré.' }, { status: 400 })
    }
    if (deal.claimers_count >= deal.max_claimers) {
      return NextResponse.json({ error: 'Tous les tickets sont partis.' }, { status: 400 })
    }

    const { error: claimErr } = await service
      .from('karma_lightning_claims')
      .insert({
        deal_id: deal.id,
        user_id: user.id,
        seeds_awarded: deal.seeds_reward,
      })

    if (claimErr) {
      return NextResponse.json({ error: 'Tu as déjà claim ce deal.' }, { status: 400 })
    }

    // Incrémenter claimers_count
    await service
      .from('karma_lightning_deals')
      .update({ claimers_count: deal.claimers_count + 1 })
      .eq('id', deal.id)

    // Créditer graines
    const { data: current } = await service
      .from('karma_seeds')
      .select('balance, lifetime_earned')
      .eq('user_id', user.id)
      .maybeSingle()
    const balance = current?.balance ?? 0
    const lifetime = current?.lifetime_earned ?? 0
    await service.from('karma_seeds').upsert(
      {
        user_id: user.id,
        balance: balance + deal.seeds_reward,
        lifetime_earned: lifetime + deal.seeds_reward,
      },
      { onConflict: 'user_id' }
    )
    await service.from('karma_seed_transactions').insert({
      user_id: user.id,
      amount: deal.seeds_reward,
      direction: 'earn',
      source: 'lightning_deal',
      source_ref: deal.id,
      reason: `Lightning Deal « ${deal.title} »`,
    })

    return NextResponse.json({
      seeds_awarded: deal.seeds_reward,
      message: `+${deal.seeds_reward} 🌱 Bien joué.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
