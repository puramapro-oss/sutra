import { createServiceClient } from '@/lib/supabase'
import { handleCheckoutSessionCompleted } from './webhook-checkout'
import { handleInvoicePaid, handleInvoicePaymentFailed } from './webhook-invoices'
import { handleAccountUpdated, handleTransferCreated, handlePayoutPaid } from './webhook-connect'
import {
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleChargeRefunded,
} from './webhook-subscriptions'
import type Stripe from 'stripe'

/**
 * Dispatch partagé des webhooks Stripe — utilisé à la fois par
 * /api/stripe/webhook et la route interne /api/internal/stripe-fulfillment
 * pour garantir que les deux routes traitent les mêmes événements.
 * Les types d'événement non listés sont ignorés (fall-through).
 */
export async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  const serviceClient = createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, serviceClient)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice, serviceClient)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, serviceClient)
      break

    case 'account.updated':
      await handleAccountUpdated(event.data.object as Stripe.Account)
      break

    case 'transfer.created':
      await handleTransferCreated(event.data.object as Stripe.Transfer, serviceClient)
      break

    case 'payout.paid':
      await handlePayoutPaid(
        event.data.object as Stripe.Payout,
        (event as unknown as { account?: string }).account,
        serviceClient
      )
      break

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, serviceClient)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, serviceClient)
      break

    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge, serviceClient)
      break
  }
}
