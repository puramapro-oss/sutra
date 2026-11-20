import { sendNotification, sendAdminNotification, logActivity } from '@/lib/logger'
import { creditWallet } from '@/lib/smart-split'
import { applyKarmaSplit } from '@/lib/karma-split'
import type Stripe from 'stripe'
import type { ServiceClient } from './webhook-types'

/**
 * invoice.paid — enregistrement paiement, commissions parrainage V4
 * (N1=50%, N2=15%, N3=7%, anti-fraude 30j), karma split V7.1.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  serviceClient: ServiceClient
): Promise<void> {
  const customerId = invoice.customer as string

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, plan')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await serviceClient.from('payments').insert({
      user_id: profile.id,
      stripe_payment_id: (invoice as unknown as Record<string, unknown>).payment_intent as string ?? invoice.id,
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid,
      amount_after_discount: invoice.amount_paid,
      discount_applied: 0,
      currency: invoice.currency,
      status: 'succeeded',
      plan: profile.plan,
      billing_period: 'monthly',
    })

    // V6 section 10 — Parrainage V4 3 niveaux (N1=50%, N2=15%, N3=7%)
    // Anti-fraude : 30j activité réelle avant versement (active_since + 30j)
    const { data: referrals } = await serviceClient
      .from('referrals')
      .select('id, referrer_id, level, active_since')
      .eq('referred_id', profile.id)
      .eq('status', 'active')

    const RATES: Record<number, number> = { 1: 0.5, 2: 0.15, 3: 0.07 }
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const now = Date.now()

    if (referrals && referrals.length > 0) {
      for (const referral of referrals) {
        const level = (referral.level as number) ?? 1
        const rate = RATES[level] ?? 0
        if (rate === 0) continue

        // Anti-fraude 30j
        const activeSince = referral.active_since ? new Date(referral.active_since).getTime() : now
        if (now - activeSince < thirtyDaysMs) continue

        const commissionAmount = (invoice.amount_paid * rate) / 100

        await serviceClient.from('referral_commissions').insert({
          referrer_id: referral.referrer_id,
          referred_id: profile.id,
          beneficiary_id: referral.referrer_id,
          type: `recurring_n${level}`,
          level,
          amount: commissionAmount,
          status: 'pending',
        })

        await creditWallet({
          userId: referral.referrer_id,
          amount: commissionAmount,
          source: 'referral',
          description: `Commission parrainage N${level} (${Math.round(rate * 100)}%)`,
          mode: 'split',
        })
      }
    }

    await logActivity(profile.id, 'invoice_paid', 'Facture payee', {
      invoice_id: invoice.id,
      amount: invoice.amount_paid,
    })

    // V7.1 — Karma Split 50/10/40 sur le HT de chaque invoice.
    // Idempotent via UNIQUE(stripe_invoice_id) → retry webhook safe.
    try {
      const split = await applyKarmaSplit(invoice, profile.id)
      if (!split.applied && split.reason === 'error') {
        await sendAdminNotification({
          type: 'karma_split_error',
          title: 'Karma split failed',
          message: `Invoice ${invoice.id} : ${split.detail ?? 'unknown'}`,
          data: { invoice_id: invoice.id, user_id: profile.id },
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await sendAdminNotification({
        type: 'karma_split_exception',
        title: 'Karma split threw',
        message: `Invoice ${invoice.id} : ${message}`,
        data: { invoice_id: invoice.id, user_id: profile.id },
      })
    }
  } else {
    // Pas de profile matché (ex: invoice pour un client Stripe externe Purama)
    // → split quand même appliqué, user_id null (cross-app Purama multi-app).
    try {
      await applyKarmaSplit(invoice, null)
    } catch {
      // non-blocking
    }
  }
}

/**
 * invoice.payment_failed — passage en past_due + notifications user/admin.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  serviceClient: ServiceClient
): Promise<void> {
  const customerId = invoice.customer as string

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await serviceClient
      .from('profiles')
      .update({ subscription_status: 'past_due' })
      .eq('id', profile.id)

    await sendNotification(profile.id, {
      type: 'warning',
      title: 'Paiement echoue',
      message: 'Ton dernier paiement a echoue. Mets a jour ton moyen de paiement pour conserver ton abonnement.',
    })

    await sendAdminNotification({
      type: 'payment_failed',
      title: 'Paiement echoue',
      message: `Paiement echoue pour ${profile.email}`,
      data: { user_id: profile.id, invoice_id: invoice.id },
    })
  }
}
