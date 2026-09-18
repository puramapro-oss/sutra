import { sendNotification, logActivity } from '@/lib/logger'
import type Stripe from 'stripe'
import type { ServiceClient } from './webhook-types'

/**
 * customer.subscription.updated — sync statut abonnement.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  serviceClient: ServiceClient
): Promise<void> {
  const customerId = subscription.customer as string

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await serviceClient
      .from('profiles')
      .update({
        subscription_status: subscription.status as string,
        stripe_subscription_id: subscription.id,
      })
      .eq('id', profile.id)

    await serviceClient.from('subscriptions').upsert(
      {
        user_id: profile.id,
        app_id: 'sutra',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: subscription.status as string,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    )
  }
}

/**
 * customer.subscription.deleted — passage plan free + notification.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  serviceClient: ServiceClient
): Promise<void> {
  const customerId = subscription.customer as string

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    const cancelledAt = new Date().toISOString()
    await serviceClient
      .from('profiles')
      .update({
        plan: 'free',
        subscription_status: 'cancelled',
        stripe_subscription_id: null,
      })
      .eq('id', profile.id)

    await serviceClient
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: cancelledAt, ends_at: cancelledAt })
      .eq('stripe_subscription_id', subscription.id)

    await sendNotification(profile.id, {
      type: 'info',
      title: 'Abonnement annule',
      message: 'Ton abonnement a ete annule. Tu passes au plan gratuit.',
    })

    await logActivity(profile.id, 'subscription_cancelled', 'Abonnement annule')
  }
}

/**
 * charge.refunded (V6 section 11) — rétractation + prime déduite si <30j.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge,
  serviceClient: ServiceClient
): Promise<void> {
  const customerId = charge.customer as string
  if (!customerId) return

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, subscription_started_at')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) return

  // Calcul prime déjà versée à déduire si annulation <30j après souscription
  let primeDeductedCents = 0
  if (profile.subscription_started_at) {
    const startedAt = new Date(profile.subscription_started_at).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - startedAt < thirtyDaysMs) {
      const { data: credited } = await serviceClient
        .from('prime_payouts')
        .select('amount_cents')
        .eq('user_id', profile.id)
        .eq('status', 'credited')
      primeDeductedCents = (credited ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
    }
  }

  await serviceClient.from('retractions').insert({
    user_id: profile.id,
    app_id: 'sutra',
    amount_refunded_cents: charge.amount_refunded ?? 0,
    prime_deducted_cents: primeDeductedCents,
    stripe_charge_id: charge.id,
    processed: true,
    reason: (charge.refunds?.data?.[0]?.reason as string) ?? null,
  })

  await serviceClient
    .from('profiles')
    .update({ plan: 'free', subscription_status: 'refunded' })
    .eq('id', profile.id)

  await logActivity(profile.id, 'charge_refunded', 'Remboursement effectue', {
    charge_id: charge.id,
    amount_refunded: charge.amount_refunded,
    prime_deducted_cents: primeDeductedCents,
  })
}
