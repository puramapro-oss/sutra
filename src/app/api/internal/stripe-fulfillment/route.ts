import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { dispatchStripeEvent } from '@/lib/stripe/webhook-dispatch'
import type Stripe from 'stripe'

/**
 * Route interne de fulfillment — même logique de traitement que
 * /api/stripe/webhook (dispatch partagé src/lib/stripe/webhook-dispatch.ts),
 * protégée par x-internal-secret en plus de la signature Stripe.
 */
export async function POST(req: Request) {
  const internalSecret = req.headers.get('x-internal-secret')
  if (internalSecret !== process.env.INTERNAL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('x-stripe-signature')

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

    await dispatchStripeEvent(event)

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur webhook', details: message }, { status: 500 })
  }
}
