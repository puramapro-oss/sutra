import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { sendNotification, sendAdminNotification, logActivity } from '@/lib/logger'
import { sendSubscriptionEmail } from '@/lib/emails'
import { creditWallet } from '@/lib/smart-split'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret non configure' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch {
      return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const plan = session.metadata?.plan ?? 'starter'
        const referralCode = session.metadata?.referral_code
        const crossPromoSource = session.metadata?.cross_promo_source
        const crossPromoCoupon = session.metadata?.cross_promo_coupon

        if (!userId) break

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
        for (const t of tranches) {
          await serviceClient.from('prime_payouts').upsert(
            { user_id: userId, app_id: 'sutra', ...t },
            { onConflict: 'user_id,app_id,tranche' }
          )
        }

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

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
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
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
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

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
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

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
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

        break
      }

      // V6 section 11 — charge.refunded → rétractation + prime déduite si <30j
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const customerId = charge.customer as string
        if (!customerId) break

        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id, subscription_started_at')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!profile) break

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

        break
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur webhook', details: message }, { status: 500 })
  }
}
