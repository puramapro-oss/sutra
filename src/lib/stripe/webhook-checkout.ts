import { sendNotification, logActivity } from '@/lib/logger'
import { sendSubscriptionEmail } from '@/lib/emails'
import { creditWallet } from '@/lib/smart-split'
import type Stripe from 'stripe'
import type { ServiceClient } from './webhook-types'

/**
 * checkout.session.completed — activation abonnement, prime 3 paliers,
 * parrainage V4 (N1/N2/N3), cross-promo V7, email de bienvenue.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts
 * (partagée avec la route interne stripe-fulfillment).
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  serviceClient: ServiceClient
): Promise<void> {
  const userId = session.metadata?.user_id
  const plan = session.metadata?.plan ?? 'starter'
  const referralCode = session.metadata?.referral_code
  const crossPromoSource = session.metadata?.cross_promo_source
  const crossPromoCoupon = session.metadata?.cross_promo_coupon

  if (!userId) return

  // V7 — Marquer la conversion cross-promo si cookie purama_promo détecté au checkout
  if (crossPromoSource && crossPromoCoupon) {
    try {
      await serviceClient
        .from('cross_promos')
        .update({ converted: true, converted_at: new Date().toISOString(), user_id: userId })
        .eq('source_app', crossPromoSource)
        .eq('coupon_code', crossPromoCoupon)
        .eq('user_id', userId)
    } catch {
      // Non-blocking
    }
  }

  // V6 section 10 — subscription_started_at (clé retrait wallet 30j)
  // Ne l'écrase pas si déjà set (ex: réactivation après pause).
  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('subscription_started_at')
    .eq('id', userId)
    .single()

  const startedAt = existingProfile?.subscription_started_at ?? new Date().toISOString()

  await serviceClient
    .from('profiles')
    .update({
      plan,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'active',
      subscription_started_at: startedAt,
    })
    .eq('id', userId)

  // V6 section 11 — source de vérité Stripe
  await serviceClient.from('subscriptions').upsert(
    {
      user_id: userId,
      app_id: 'sutra',
      stripe_subscription_id: session.subscription as string,
      stripe_customer_id: session.customer as string,
      status: 'active',
      plan,
      started_at: startedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  )

  // V6 section 10 — Prime 3 paliers (J0: 25€, M+1: 25€, M+2: 50€)
  // Tranche 1 créditée immédiatement en wallet (points en phase 1 = 2500pts = 25€).
  const phase = process.env.PURAMA_PHASE === '2' ? 2 : 1
  const walletUnit = phase === 2 ? 'euros' : 'points'
  const now = new Date()
  const m1 = new Date(now); m1.setMonth(m1.getMonth() + 1)
  const m2 = new Date(now); m2.setMonth(m2.getMonth() + 2)
  const tranches = [
    { tranche: 1, amount_cents: 2500, scheduled_at: now.toISOString(), credited_at: now.toISOString(), status: 'credited' },
    { tranche: 2, amount_cents: 2500, scheduled_at: m1.toISOString(), status: 'scheduled' },
    { tranche: 3, amount_cents: 5000, scheduled_at: m2.toISOString(), status: 'scheduled' },
  ]
  await serviceClient.from('prime_payouts').upsert(
    tranches.map((t) => ({ user_id: userId, app_id: 'sutra', ...t })),
    { onConflict: 'user_id,app_id,tranche' }
  )

  // Créditer tranche 1 en wallet (25€ en euros ou 2500 points en phase 1)
  if (walletUnit === 'points') {
    const { data: p } = await serviceClient.from('profiles').select('purama_points').eq('id', userId).single()
    await serviceClient.from('profiles').update({
      purama_points: (p?.purama_points ?? 0) + 2500,
    }).eq('id', userId)
    await serviceClient.from('wallet_transactions').insert({
      user_id: userId,
      type: 'credit',
      amount: 25,
      source: 'prime_welcome_t1',
      description: 'Prime de bienvenue — tranche 1/3 (J0)',
    })
  } else {
    await creditWallet({
      userId,
      amount: 25,
      source: 'prime_welcome_t1',
      description: 'Prime de bienvenue — tranche 1/3 (J0)',
      mode: 'split',
    })
  }

  await serviceClient.from('payments').insert({
    user_id: userId,
    stripe_payment_id: session.payment_intent as string,
    amount: session.amount_total ?? 0,
    amount_after_discount: session.amount_total ?? 0,
    discount_applied: 0,
    currency: session.currency ?? 'eur',
    status: 'succeeded',
    plan,
    billing_period: session.metadata?.billing_period ?? 'monthly',
  })

  if (referralCode && referralCode.length > 0) {
    const { data: referrer } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('referral_code', referralCode)
      .single()

    if (referrer && referrer.id !== userId) {
      const nowIso = new Date().toISOString()
      await serviceClient.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: userId,
        referral_code: referralCode,
        status: 'active',
        level: 1,
        active_since: nowIso,
      })

      // V6 Section 10 — créer automatiquement N2 et N3
      // N2 : parrain du parrain → userId
      const { data: n2Referral } = await serviceClient
        .from('referrals')
        .select('referrer_id, referral_code')
        .eq('referred_id', referrer.id)
        .eq('level', 1)
        .eq('status', 'active')
        .maybeSingle()

      if (n2Referral?.referrer_id && n2Referral.referrer_id !== userId) {
        await serviceClient.from('referrals').insert({
          referrer_id: n2Referral.referrer_id,
          referred_id: userId,
          referral_code: n2Referral.referral_code ?? 'N2_AUTO',
          status: 'active',
          level: 2,
          active_since: nowIso,
        })

        // N3 : parrain du parrain du parrain
        const { data: n3Referral } = await serviceClient
          .from('referrals')
          .select('referrer_id, referral_code')
          .eq('referred_id', n2Referral.referrer_id)
          .eq('level', 1)
          .eq('status', 'active')
          .maybeSingle()

        if (n3Referral?.referrer_id && n3Referral.referrer_id !== userId) {
          await serviceClient.from('referrals').insert({
            referrer_id: n3Referral.referrer_id,
            referred_id: userId,
            referral_code: n3Referral.referral_code ?? 'N3_AUTO',
            status: 'active',
            level: 3,
            active_since: nowIso,
          })
        }
      }

      const commissionAmount = (session.amount_total ?? 0) * 0.5
      await serviceClient.from('referral_commissions').insert({
        referrer_id: referrer.id,
        referred_id: userId,
        beneficiary_id: referrer.id,
        type: 'first_payment_50pct',
        amount: commissionAmount / 100,
        status: 'pending',
      })

      await creditWallet({
        userId: referrer.id,
        amount: commissionAmount / 100,
        source: 'referral',
        description: `Commission 50% premier paiement plan ${plan}`,
        mode: 'split',
      })

      await sendNotification(referrer.id, {
        type: 'referral',
        title: 'Nouveau filleul !',
        message: `Un nouveau filleul a souscrit au plan ${plan}. Commission de ${(commissionAmount / 100).toFixed(2)} EUR creditee.`,
      })
    }
  }

  const { data: userProfile } = await serviceClient
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (userProfile?.email) {
    await sendSubscriptionEmail(userProfile.email, plan, session.amount_total ?? 0).catch(() => {})
  }

  await sendNotification(userId, {
    type: 'payment',
    title: 'Abonnement active !',
    message: `Ton plan ${plan} est maintenant actif.`,
  })

  await logActivity(userId, 'subscription_started', `Abonnement ${plan} active`, {
    plan,
    amount: session.amount_total,
  })
}
