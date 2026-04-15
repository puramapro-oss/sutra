import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { logActivity } from '@/lib/logger'

// V6 Section 11 — Pause abonnement 1 mois via Stripe pause_collection
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 })
  }

  const resumeAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

  try {
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      pause_collection: { behavior: 'void', resumes_at: resumeAt },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur Stripe'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await service
    .from('profiles')
    .update({ subscription_status: 'paused' })
    .eq('id', user.id)

  await service
    .from('subscriptions')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', profile.stripe_subscription_id)

  await logActivity(user.id, 'subscription_paused', 'Abonnement mis en pause 1 mois', { resume_at: resumeAt })

  return NextResponse.json({ ok: true, resumes_at: resumeAt })
}
