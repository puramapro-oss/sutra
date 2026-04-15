import { NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { logActivity } from '@/lib/logger'

const schema = z.object({ reason: z.string().min(1).max(200) })

// V6 Section 11 — Résiliation : cancel_at_period_end=true (accès jusqu'à fin période)
export async function POST(req: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Raison requise' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 })
  }

  let periodEnd: number | null = null
  try {
    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: { cancel_reason: parsed.data.reason },
    })
    periodEnd = (updated as unknown as { current_period_end: number }).current_period_end ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur Stripe'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await service
    .from('profiles')
    .update({ subscription_status: 'cancelling' })
    .eq('id', user.id)

  await service
    .from('subscriptions')
    .update({
      status: 'cancelling',
      cancelled_at: new Date().toISOString(),
      ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', profile.stripe_subscription_id)

  await logActivity(user.id, 'subscription_cancel_requested', parsed.data.reason, {
    ends_at: periodEnd,
  })

  return NextResponse.json({ ok: true, ends_at: periodEnd })
}
