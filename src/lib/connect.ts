import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'
import type Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Stripe Connect (Express + Embedded Components) — payout wallet → IBAN user.
// Source of truth : STRIPE_CONNECT_KARMA_V4.md §V4.1 (Embedded Components,
// pas de STRIPE_CONNECT_CLIENT_ID ca_... nécessaire).
//
// Flow :
//   1. User clique "Activer les retraits" sur /settings/paiement
//   2. createConnectAccount(userId, email) → Stripe Express FR + insert DB
//   3. createAccountSession(stripeAccountId) → client_secret → <ConnectComponentsProvider>
//   4. User fait KYC dans l'iframe Embedded (reste sur purama.dev)
//   5. Webhook account.updated → syncAccountStatus() met à jour payouts_enabled etc.
//   6. User demande retrait ≥20€ → createPayoutToConnect() → SEPA instant
// ---------------------------------------------------------------------------

export type ConnectAccountRow = {
  user_id: string
  stripe_account_id: string
  onboarding_completed: boolean
  payouts_enabled: boolean
  charges_enabled: boolean
  details_submitted: boolean
  requirements_currently_due: string[]
  requirements_past_due: string[]
  capabilities: Record<string, unknown>
  country: string
  default_currency: string
  kyc_verified_at: string | null
  last_webhook_at: string | null
  created_at: string
  updated_at: string
}

export type EnsuredAccount = {
  stripeAccountId: string
  payoutsEnabled: boolean
  onboardingCompleted: boolean
  alreadyExisted: boolean
}

// ---------------------------------------------------------------------------
// 1. Création ou récupération (idempotent) d'un compte Connect Express
// ---------------------------------------------------------------------------

/**
 * Garantit qu'un user a un compte Stripe Connect Express.
 * - Si déjà en DB → renvoie l'existant (0 appel Stripe).
 * - Sinon → Stripe Account create (controller.fees=account, losses=application)
 *         + insert connect_accounts + retour des champs.
 *
 * @throws Error si Stripe rejette (ex: email invalide).
 */
export async function ensureConnectAccount(
  userId: string,
  email: string,
): Promise<EnsuredAccount> {
  const supabase = createServiceClient()

  const existing = await supabase
    .from('connect_accounts')
    .select(
      'stripe_account_id, payouts_enabled, onboarding_completed',
    )
    .eq('user_id', userId)
    .maybeSingle<{
      stripe_account_id: string
      payouts_enabled: boolean
      onboarding_completed: boolean
    }>()

  if (existing.error) throw existing.error
  if (existing.data) {
    return {
      stripeAccountId: existing.data.stripe_account_id,
      payoutsEnabled: existing.data.payouts_enabled,
      onboardingCompleted: existing.data.onboarding_completed,
      alreadyExisted: true,
    }
  }

  // Depuis 2024, Stripe exige `controller` XOR `type` (mutuellement exclusifs).
  // Pour Embedded Components V4.1, on utilise `controller` qui définit un
  // comportement équivalent à Express (pas de dashboard Stripe visible user).
  const account = await stripe.accounts.create({
    country: 'FR',
    email,
    // card_payments requis par Stripe quand losses.payments='stripe'. Inutilisé
    // côté user dans SUTRA (Purama encaisse les abos avec son compte principal)
    // mais obligatoire à la capability pour satisfaire les règles Connect modernes.
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    controller: {
      fees: { payer: 'account' },
      // losses.payments='stripe' imposé par Stripe quand dashboard=none + collection=stripe.
      // Cohérent avec le cadre légal V4.1 : « Purama ne possède JAMAIS les fonds. »
      losses: { payments: 'stripe' },
      stripe_dashboard: { type: 'none' },
      requirement_collection: 'stripe',
    },
    metadata: { user_id: userId, app: 'sutra' },
  })

  const insert = await supabase.from('connect_accounts').insert({
    user_id: userId,
    stripe_account_id: account.id,
    country: account.country ?? 'FR',
    default_currency: account.default_currency ?? 'eur',
    capabilities: (account.capabilities ?? {}) as Record<string, unknown>,
  })
  if (insert.error) throw insert.error

  return {
    stripeAccountId: account.id,
    payoutsEnabled: false,
    onboardingCompleted: false,
    alreadyExisted: false,
  }
}

// ---------------------------------------------------------------------------
// 2. AccountSession — client_secret pour Embedded Components
// ---------------------------------------------------------------------------

/**
 * Crée une AccountSession pour les Embedded Components.
 * Les composants activés correspondent aux 7 URLs configurées côté Stripe
 * Dashboard (notification_banner, account_management, payouts, balances,
 * payments, documents, account_onboarding).
 *
 * @returns client_secret à passer à loadConnectAndInitialize() côté client.
 */
export async function createAccountSession(stripeAccountId: string): Promise<{
  clientSecret: string
  expiresAt: number
}> {
  const session = await stripe.accountSessions.create({
    account: stripeAccountId,
    components: {
      account_onboarding: { enabled: true },
      account_management: { enabled: true },
      notification_banner: { enabled: true },
      payouts: { enabled: true },
      payments: { enabled: true },
      balances: { enabled: true },
      documents: { enabled: true },
    },
  })
  return {
    clientSecret: session.client_secret,
    expiresAt: session.expires_at,
  }
}

// ---------------------------------------------------------------------------
// 3. Sync du statut depuis Stripe (appelé par webhook account.updated)
// ---------------------------------------------------------------------------

/**
 * Met à jour `connect_accounts` depuis l'état Stripe actuel.
 * Appelé par le webhook account.updated et éventuellement en sanity-check.
 */
export async function syncAccountStatus(stripeAccountId: string): Promise<ConnectAccountRow> {
  const account = await stripe.accounts.retrieve(stripeAccountId)
  return upsertAccountFromStripe(account)
}

/**
 * Variante sans appel Stripe quand on reçoit déjà l'objet account dans un webhook.
 */
export async function upsertAccountFromStripe(account: Stripe.Account): Promise<ConnectAccountRow> {
  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  const payoutsEnabled = Boolean(account.payouts_enabled)
  const chargesEnabled = Boolean(account.charges_enabled)
  const detailsSubmitted = Boolean(account.details_submitted)
  const onboardingCompleted = payoutsEnabled && detailsSubmitted

  const update = {
    payouts_enabled: payoutsEnabled,
    charges_enabled: chargesEnabled,
    details_submitted: detailsSubmitted,
    onboarding_completed: onboardingCompleted,
    requirements_currently_due: account.requirements?.currently_due ?? [],
    requirements_past_due: account.requirements?.past_due ?? [],
    capabilities: (account.capabilities ?? {}) as Record<string, unknown>,
    country: account.country ?? 'FR',
    default_currency: account.default_currency ?? 'eur',
    kyc_verified_at: payoutsEnabled ? nowIso : null,
    last_webhook_at: nowIso,
  }

  const { data, error } = await supabase
    .from('connect_accounts')
    .update(update)
    .eq('stripe_account_id', account.id)
    .select()
    .maybeSingle<ConnectAccountRow>()

  if (error) throw error
  if (!data) {
    throw new Error(`connect_accounts row not found for stripe_account_id=${account.id}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// 4. Payout vers Connect (retrait wallet → IBAN user)
// ---------------------------------------------------------------------------

export type PayoutResult = {
  transferId: string
  amountCents: number
  currency: string
  destination: string
}

/**
 * Transfère X€ depuis le solde Purama vers le compte Connect Express du user.
 * Stripe Connect créera ensuite le payout SEPA (instant si dispo, ~J+1 sinon).
 *
 * Pré-requis vérifiés côté caller (/api/wallet/withdraw) :
 *   - user authentifié
 *   - connect_accounts.payouts_enabled = true
 *   - wallet solde ≥ amountEur
 *   - amountEur ≥ 20 (seuil KARMA_MIN_WITHDRAWAL_EUR)
 */
export async function createPayoutToConnect(params: {
  userId: string
  stripeAccountId: string
  amountEur: number
  sourceReason?: string
}): Promise<PayoutResult> {
  const { userId, stripeAccountId, amountEur, sourceReason } = params
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    throw new Error(`Invalid amountEur: ${amountEur}`)
  }
  const amountCents = Math.round(amountEur * 100)

  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency: 'eur',
    destination: stripeAccountId,
    description: `SUTRA retrait wallet ${amountEur.toFixed(2)}€`,
    metadata: {
      user_id: userId,
      app: 'sutra',
      source: sourceReason ?? 'wallet_withdrawal',
    },
  })

  return {
    transferId: transfer.id,
    amountCents: transfer.amount,
    currency: transfer.currency,
    destination:
      typeof transfer.destination === 'string'
        ? transfer.destination
        : (transfer.destination?.id ?? stripeAccountId),
  }
}

// ---------------------------------------------------------------------------
// 5. Helpers de lecture (utilisés par API routes et webhook)
// ---------------------------------------------------------------------------

export async function getConnectAccountByUserId(
  userId: string,
): Promise<ConnectAccountRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('connect_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle<ConnectAccountRow>()
  if (error) throw error
  return data
}

export async function getConnectAccountByStripeId(
  stripeAccountId: string,
): Promise<ConnectAccountRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('connect_accounts')
    .select('*')
    .eq('stripe_account_id', stripeAccountId)
    .maybeSingle<ConnectAccountRow>()
  if (error) throw error
  return data
}
