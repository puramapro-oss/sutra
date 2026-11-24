import { sendNotification, sendAdminNotification, logActivity } from '@/lib/logger'
import { upsertAccountFromStripe } from '@/lib/connect'
import type Stripe from 'stripe'
import type { ServiceClient } from './webhook-types'

/**
 * account.updated (V7.1) — sync connect_accounts depuis état Stripe.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  try {
    await upsertAccountFromStripe(account)
    await logActivity(
      (account.metadata?.user_id as string) ?? '',
      'connect_account_updated',
      `Connect ${account.id} synchronise`,
      {
        stripe_account_id: account.id,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        currently_due: account.requirements?.currently_due ?? [],
      },
    )
  } catch (err) {
    // Pas de profile associé encore (webhook très tôt) → ignore.
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('not found')) {
      await sendAdminNotification({
        type: 'connect_sync_error',
        title: 'Connect account sync failed',
        message: `${account.id} : ${message}`,
        data: { stripe_account_id: account.id },
      })
    }
  }
}

/**
 * transfer.created (V7.1) — wallet user → Connect (traçabilité SEPA).
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handleTransferCreated(
  transfer: Stripe.Transfer,
  serviceClient: ServiceClient
): Promise<void> {
  const userId = (transfer.metadata?.user_id as string) ?? null
  if (userId) {
    await serviceClient.from('wallet_transactions').insert({
      user_id: userId,
      type: 'debit',
      amount: (transfer.amount ?? 0) / 100,
      source: 'stripe_transfer',
      stripe_transfer_id: transfer.id,
      description: `Retrait wallet ${((transfer.amount ?? 0) / 100).toFixed(2)}€ → Connect ${transfer.destination}`,
    })
    await logActivity(userId, 'transfer_created', 'Transfer Stripe Connect', {
      transfer_id: transfer.id,
      amount: transfer.amount,
      destination: transfer.destination,
    })
  }
}

/**
 * payout.paid (V7.1) — SEPA arrivé sur l'IBAN user → notification.
 * Logique extraite à l'identique de src/app/api/stripe/webhook/route.ts.
 */
export async function handlePayoutPaid(
  payout: Stripe.Payout,
  eventAccount: string | undefined,
  serviceClient: ServiceClient
): Promise<void> {
  // Le payout est émis côté compte Connect → on retrouve le user via metadata
  // Stripe ne propage pas les metadata du transfer vers le payout, donc on
  // retrouve par destination (stripe_account_id) si le webhook est envoyé
  // dans le contexte du Connect account (Stripe-Account header).
  if (eventAccount) {
    const { data: connectRow } = await serviceClient
      .from('connect_accounts')
      .select('user_id')
      .eq('stripe_account_id', eventAccount)
      .maybeSingle()
    if (connectRow?.user_id) {
      await sendNotification(connectRow.user_id as string, {
        type: 'payment',
        title: 'Retrait arrivé !',
        message: `Tes ${((payout.amount ?? 0) / 100).toFixed(2)}€ sont sur ton compte bancaire 🎉`,
      })
      await logActivity(connectRow.user_id as string, 'payout_paid', 'Payout SEPA arrivé', {
        payout_id: payout.id,
        amount: payout.amount,
        arrival_date: payout.arrival_date,
      })
    }
  }
}
