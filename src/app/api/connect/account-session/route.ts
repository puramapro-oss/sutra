import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import {
  createAccountSession,
  getConnectAccountByUserId,
} from '@/lib/connect'

/**
 * POST /api/connect/account-session
 *
 * Renvoie un client_secret AccountSession pour un user qui a déjà onboardé.
 * Utilisé par le front pour rafraîchir la session Embedded Components
 * (sessions expirent ~60 min → re-fetch à chaque mount UI).
 *
 * Différence avec /api/connect/onboard :
 *   - onboard         : crée le compte s'il n'existe pas (première visite)
 *   - account-session : 404 si pas de compte (déjà onboardé attendu)
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

    const account = await getConnectAccountByUserId(user.id)
    if (!account) {
      return NextResponse.json(
        {
          error: 'Aucun compte Stripe Connect. Lance /api/connect/onboard d\'abord.',
          code: 'no_connect_account',
        },
        { status: 404 },
      )
    }

    const session = await createAccountSession(account.stripe_account_id)
    return NextResponse.json({
      accountId: account.stripe_account_id,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      payoutsEnabled: account.payouts_enabled,
      onboardingCompleted: account.onboarding_completed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json(
      { error: `Impossible de créer la session Connect : ${message}` },
      { status: 500 },
    )
  }
}
