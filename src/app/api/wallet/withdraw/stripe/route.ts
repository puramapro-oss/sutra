import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { debitPrincipal, normalizeSubWallets } from '@/lib/smart-split'
import {
  getConnectAccountByUserId,
  createPayoutToConnect,
} from '@/lib/connect'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// POST /api/wallet/withdraw/stripe
//
// Retrait via Stripe Connect (SEPA vers l'IBAN du user configuré dans Connect).
// Coexiste avec /api/wallet/withdraw (V6 IBAN/PayPal manuel) — ne remplace pas.
//
// Flow :
//   1. Auth user
//   2. Récupère connect_accounts → vérifie payouts_enabled=true
//   3. Vérifie wallet.sub_wallets.principal ≥ amount_eur
//   4. Vérifie amount_eur entre KARMA_MIN_WITHDRAWAL_EUR (20€) et 1000€
//   5. Débit Principal via smart-split (atomique)
//   6. Stripe transfer → Connect account
//   7. Insert withdrawals (method='stripe_connect', status='stripe_transferred')
//   8. wallet_transactions debit loggé par le webhook transfer.created (B.4)
//
// Response :
//   200 { transferId, amountEur, estimatedFeesEur, tipMessage, principalAfter }
//   400 { error, code }
//   401 { error }
//   402 { error, code: 'insufficient_funds', principal_available }
//   409 { error, code: 'payouts_not_enabled' } — user n'a pas fini le KYC
// ---------------------------------------------------------------------------

const withdrawSchema = z.object({
  amount_eur: z.number().positive().max(1000),
})

const MIN_WITHDRAWAL_EUR = Number(process.env.KARMA_MIN_WITHDRAWAL_EUR ?? 20)
const RECOMMENDED_WITHDRAWAL_EUR = Number(
  process.env.KARMA_RECOMMENDED_WITHDRAWAL_EUR ?? 50,
)

/**
 * Estimation des frais Stripe (pris sur le compte Connect, pas Purama).
 * Grille officielle Stripe France : 0,25€ fixe + 0,25% du montant (SEPA).
 * Approximation pour UI — montant exact renvoyé par Stripe dans le webhook.
 */
function estimateStripeFeesEur(amountEur: number): number {
  return Math.round((0.25 + amountEur * 0.0025) * 100) / 100
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = withdrawSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Donnees invalides',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { amount_eur: amountEur } = parsed.data

    if (amountEur < MIN_WITHDRAWAL_EUR) {
      return NextResponse.json(
        {
          error: `Montant minimum : ${MIN_WITHDRAWAL_EUR}€`,
          code: 'below_min',
          min: MIN_WITHDRAWAL_EUR,
        },
        { status: 400 },
      )
    }

    // 1. Compte Connect existe + payouts actifs ?
    const connectAccount = await getConnectAccountByUserId(user.id)
    if (!connectAccount) {
      return NextResponse.json(
        {
          error:
            'Aucun compte de retrait configuré. Lance l\'onboarding Stripe Connect d\'abord.',
          code: 'no_connect_account',
        },
        { status: 409 },
      )
    }
    if (!connectAccount.payouts_enabled) {
      return NextResponse.json(
        {
          error: 'KYC non finalisé — termine l\'onboarding Stripe Connect.',
          code: 'payouts_not_enabled',
          requirementsCurrentlyDue: connectAccount.requirements_currently_due,
        },
        { status: 409 },
      )
    }

    // 2. Wallet solde Principal suffisant ?
    const service = createServiceClient()
    const { data: wallet } = await service
      .from('wallets')
      .select('balance, sub_wallets')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet introuvable', code: 'no_wallet' },
        { status: 402 },
      )
    }
    const principal = normalizeSubWallets(wallet.sub_wallets).principal
    if (principal < amountEur) {
      return NextResponse.json(
        {
          error: `Solde Principal insuffisant : ${principal.toFixed(2)}€ disponibles.`,
          code: 'insufficient_funds',
          principal_available: principal,
        },
        { status: 402 },
      )
    }

    // 3. Débit Principal ATOMIQUE avant le transfer Stripe
    // (si Stripe échoue, on crédite back via catch ci-dessous)
    const debit = await debitPrincipal({
      userId: user.id,
      amount: amountEur,
      source: 'stripe_connect_withdrawal',
      description: `Retrait Stripe Connect ${amountEur.toFixed(2)}€`,
    })
    if (!debit.ok) {
      return NextResponse.json(
        {
          error: 'Erreur débit wallet',
          code: 'debit_failed',
          principal_available: debit.principal_after,
        },
        { status: 402 },
      )
    }

    // 4. Stripe transfer
    let payout
    try {
      payout = await createPayoutToConnect({
        userId: user.id,
        stripeAccountId: connectAccount.stripe_account_id,
        amountEur,
        sourceReason: 'wallet_withdrawal',
      })
    } catch (stripeErr) {
      // Rollback : re-crédite le Principal pour ne pas perdre les fonds user.
      const { data: currentWallet } = await service
        .from('wallets')
        .select('balance, sub_wallets')
        .eq('user_id', user.id)
        .single()
      const currentSub = normalizeSubWallets(currentWallet?.sub_wallets)
      await service
        .from('wallets')
        .update({
          balance: Number(currentWallet?.balance ?? 0) + amountEur,
          sub_wallets: { ...currentSub, principal: currentSub.principal + amountEur },
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
      await service.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'credit',
        amount: amountEur,
        source: 'stripe_connect_rollback',
        description: `Rollback retrait Stripe échoué : ${stripeErr instanceof Error ? stripeErr.message : 'unknown'}`,
      })
      return NextResponse.json(
        {
          error: `Stripe a refusé le virement : ${stripeErr instanceof Error ? stripeErr.message : 'erreur inconnue'}`,
          code: 'stripe_transfer_failed',
        },
        { status: 500 },
      )
    }

    // 5. Insert withdrawals (audit trail)
    await service.from('withdrawals').insert({
      user_id: user.id,
      amount: amountEur,
      method: 'stripe_connect',
      details: { stripe_account_id: connectAccount.stripe_account_id, transfer_id: payout.transferId },
      status: 'stripe_transferred',
    })

    // 6. Astuce frais si < 50€
    const estimatedFeesEur = estimateStripeFeesEur(amountEur)
    const tipMessage =
      amountEur < RECOMMENDED_WITHDRAWAL_EUR
        ? `💡 Astuce : retire à partir de ${RECOMMENDED_WITHDRAWAL_EUR}€ pour payer moins de frais (frais fixes absorbés). Frais prélevés par Stripe, pas par Purama.`
        : null

    return NextResponse.json({
      transferId: payout.transferId,
      amountEur,
      amountCents: payout.amountCents,
      currency: payout.currency,
      destination: payout.destination,
      estimatedFeesEur,
      netEstimatedEur: Math.round((amountEur - estimatedFeesEur) * 100) / 100,
      tipMessage,
      principalAfter: debit.principal_after,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: `Erreur retrait : ${message}`, code: 'internal' },
      { status: 500 },
    )
  }
}
