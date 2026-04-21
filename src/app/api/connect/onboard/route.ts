import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  ensureConnectAccount,
  createAccountSession,
  getConnectAccountByUserId,
} from '@/lib/connect'

/**
 * POST /api/connect/onboard
 *
 * Idempotent : si le user n'a pas encore de Stripe Connect Express,
 * on le crée puis on renvoie un client_secret pour les Embedded Components.
 * Si le compte existe déjà, on renvoie juste un nouveau client_secret
 * (sessions expirent ~60 min → à re-fetcher à chaque mount UI).
 *
 * Pas de Zod schema : aucune donnée body requise (tout vient de l'auth session).
 */
export async function POST(): Promise<Response> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }
    if (!user.email) {
      return NextResponse.json(
        { error: 'Email manquant sur le compte — contactez le support' },
        { status: 400 },
      )
    }

    const ensured = await ensureConnectAccount(user.id, user.email)
    const session = await createAccountSession(ensured.stripeAccountId)

    return NextResponse.json({
      accountId: ensured.stripeAccountId,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      payoutsEnabled: ensured.payoutsEnabled,
      onboardingCompleted: ensured.onboardingCompleted,
      alreadyExisted: ensured.alreadyExisted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Impossible d'initialiser Stripe Connect : ${message}` },
      { status: 500 },
    )
  }
}

/**
 * GET /api/connect/onboard → statut courant (pour l'UI qui polle).
 */
export async function GET(): Promise<Response> {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const account = await getConnectAccountByUserId(user.id)
  if (!account) {
    return NextResponse.json({
      exists: false,
      payoutsEnabled: false,
      onboardingCompleted: false,
    })
  }
  return NextResponse.json({
    exists: true,
    accountId: account.stripe_account_id,
    payoutsEnabled: account.payouts_enabled,
    chargesEnabled: account.charges_enabled,
    detailsSubmitted: account.details_submitted,
    onboardingCompleted: account.onboarding_completed,
    requirementsCurrentlyDue: account.requirements_currently_due,
    requirementsPastDue: account.requirements_past_due,
    kycVerifiedAt: account.kyc_verified_at,
  })
}
