import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import { sendNotification, sendAdminNotification, logActivity } from '@/lib/logger'
import { sendSubscriptionEmail } from '@/lib/emails'
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

        if (!userId) break

        await serviceClient
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: 'active',
          })
          .eq('id', userId)

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
          const { data: referralCodeRow } = await serviceClient
            .from('referral_codes')
            .select('id, user_id')
            .eq('code', referralCode)
            .eq('is_active', true)
            .single()

          if (referralCodeRow && referralCodeRow.user_id !== userId) {
            await serviceClient.from('referrals').insert({
              referrer_id: referralCodeRow.user_id,
              referred_id: userId,
              referral_code_id: referralCodeRow.id,
              status: 'active',
              referred_subscription_id: session.subscription as string,
              first_payment_processed: false,
            })

            const commissionAmount = (session.amount_total ?? 0) * 0.5
            await serviceClient.from('commissions').insert({
              referral_id: referralCodeRow.id,
              beneficiary_id: referralCodeRow.user_id,
              type: 'first_payment_50pct',
              amount: commissionAmount,
              source_payment_amount: session.amount_total ?? 0,
              status: 'pending',
            })

            await sendNotification(referralCodeRow.user_id, {
              type: 'referral',
              title: 'Nouveau filleul !',
              message: `Un nouveau filleul a souscrit au plan ${plan}. Commission de ${(commissionAmount / 100).toFixed(2)} EUR en attente.`,
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

          const { data: referrals } = await serviceClient
            .from('referrals')
            .select('id, referrer_id')
            .eq('referred_id', profile.id)
            .eq('status', 'active')

          if (referrals && referrals.length > 0) {
            for (const referral of referrals) {
              const recurringAmount = invoice.amount_paid * 0.1
              await serviceClient.from('commissions').insert({
                referral_id: referral.id,
                beneficiary_id: referral.referrer_id,
                type: 'recurring_10pct',
                amount: recurringAmount,
                source_payment_amount: invoice.amount_paid,
                status: 'pending',
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
          await serviceClient
            .from('profiles')
            .update({
              plan: 'free',
              subscription_status: 'cancelled',
              stripe_subscription_id: null,
            })
            .eq('id', profile.id)

          await sendNotification(profile.id, {
            type: 'info',
            title: 'Abonnement annule',
            message: 'Ton abonnement a ete annule. Tu passes au plan gratuit.',
          })

          await logActivity(profile.id, 'subscription_cancelled', 'Abonnement annule')
        }

        break
      }
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur webhook', details: message }, { status: 500 })
  }
}
