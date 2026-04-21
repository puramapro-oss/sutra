import { createServiceClient } from '@/lib/supabase'
import type Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Karma Split 50/10/10/30 — appliqué à chaque invoice.paid Stripe.
// Source of truth : STRIPE_CONNECT_KARMA_V4.md (§ flux économique global) + CLAUDE.md §35.
//
//   50% → user_pool  (pool gains users, redistribué via CRON quotidien)
//   10% → asso       (Association PURAMA — mécénat, réduction IS 60%)
//   10% → adya       (marketing ADYA)
//   30% → sasu       (SASU PURAMA — marge, 0% IS ZFRR 5 ans)
//
// Split appliqué sur le HT (hors TVA). La TVA collectée ne rentre pas dans le
// split (reversée à l'État). En franchise 293B (0% TVA) → HT = TTC.
//
// Override possible via env (Vercel) :
//   KARMA_SPLIT_USER_POOL / KARMA_SPLIT_ASSO / KARMA_SPLIT_ADYA / KARMA_SPLIT_SASU
// Les 4 valeurs doivent sommer à 1.0 (vérifié au load).
// ---------------------------------------------------------------------------

export type SplitRatios = {
  user_pool: number
  asso: number
  adya: number
  sasu: number
}

const DEFAULT_SPLIT: SplitRatios = {
  user_pool: 0.5,
  asso: 0.1,
  adya: 0.1,
  sasu: 0.3,
}

function loadSplit(): SplitRatios {
  const env: SplitRatios = {
    user_pool: Number(process.env.KARMA_SPLIT_USER_POOL ?? DEFAULT_SPLIT.user_pool),
    asso: Number(process.env.KARMA_SPLIT_ASSO ?? DEFAULT_SPLIT.asso),
    adya: Number(process.env.KARMA_SPLIT_ADYA ?? DEFAULT_SPLIT.adya),
    sasu: Number(process.env.KARMA_SPLIT_SASU ?? DEFAULT_SPLIT.sasu),
  }
  const sum = env.user_pool + env.asso + env.adya + env.sasu
  if (Math.abs(sum - 1) > 0.001) {
    // Fallback aux valeurs par défaut si config env incohérente (garde-fou prod).
    console.warn(
      `[karma-split] env ratios sum=${sum} != 1.0, using defaults 50/10/10/30`,
    )
    return { ...DEFAULT_SPLIT }
  }
  return env
}

export const KARMA_SPLIT: SplitRatios = loadSplit()

// ---------------------------------------------------------------------------
// Calcul du split (pur, testable sans I/O)
// ---------------------------------------------------------------------------

export type SplitBreakdown = {
  amountHtEur: number
  amountTtcEur: number
  tvaRate: number
  splits: {
    user_pool: number
    asso: number
    adya: number
    sasu: number
  }
  percents: SplitRatios
}

/**
 * Calcule le split à partir d'une invoice Stripe.
 * - En franchise 293B (0% TVA) → HT = TTC → ratios nets.
 * - Avec TVA → split sur HT, TVA reversée à l'État (hors split).
 *
 * Stripe :
 *   invoice.amount_paid          = TTC cents (inclut TVA si applicable)
 *   invoice.tax                  = TVA cents (null si 0)
 *   invoice.total_excluding_tax  = HT cents (null sur certains plans anciens)
 *
 * Arrondi : chaque split est arrondi à 2 décimales. Le reste d'arrondi est
 * ajouté au pool SASU pour garantir somme == amountHtEur (invariant trigger DB).
 */
export function computeSplitFromInvoice(invoice: Stripe.Invoice): SplitBreakdown {
  const amountTtcCents = invoice.amount_paid ?? 0

  // `invoice.tax` est deprecated dans Stripe 2024+ → on lit des champs legacy
  // ou calculés via TTC − HT. Accès via cast pour supporter les deux générations
  // de l'API SDK sans casser le build.
  const raw = invoice as unknown as {
    tax?: number | null
    total_excluding_tax?: number | null
    total_taxes?: Array<{ amount: number }> | null
  }
  const taxCents =
    (raw.tax ?? 0) ||
    (raw.total_taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0) ||
    0
  const amountHtCentsRaw =
    raw.total_excluding_tax ?? Math.max(0, amountTtcCents - taxCents)

  const amountHtEur = amountHtCentsRaw / 100
  const amountTtcEur = amountTtcCents / 100
  const tvaRate = amountHtCentsRaw > 0 ? taxCents / amountHtCentsRaw : 0

  const userPool = round2(amountHtEur * KARMA_SPLIT.user_pool)
  const asso = round2(amountHtEur * KARMA_SPLIT.asso)
  const adya = round2(amountHtEur * KARMA_SPLIT.adya)
  // Le SASU absorbe le reste d'arrondi pour garantir la somme exacte.
  const sasu = round2(amountHtEur - userPool - asso - adya)

  return {
    amountHtEur,
    amountTtcEur,
    tvaRate: round4(tvaRate),
    splits: { user_pool: userPool, asso, adya, sasu },
    percents: KARMA_SPLIT,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

// ---------------------------------------------------------------------------
// Application en DB (idempotent via UNIQUE stripe_invoice_id)
// ---------------------------------------------------------------------------

export type ApplyResult =
  | { applied: true; split: SplitBreakdown; archiveId: string }
  | { applied: false; reason: 'duplicate' | 'zero_amount' | 'error'; detail?: string }

/**
 * Applique le split sur les pool_balances + crée l'archive karma_pool_transactions
 * + les 4 pool_transactions (audit).
 *
 * Idempotent : UNIQUE(stripe_invoice_id) sur karma_pool_transactions garantit
 * qu'une invoice ne peut être comptée qu'une fois (retry webhook safe).
 */
export async function applyKarmaSplit(
  invoice: Stripe.Invoice,
  userId: string | null,
): Promise<ApplyResult> {
  const split = computeSplitFromInvoice(invoice)

  if (split.amountHtEur <= 0) {
    return { applied: false, reason: 'zero_amount' }
  }

  const supabase = createServiceClient()

  // 1. Archive par invoice (trigger vérifie sum = amount_ht_eur)
  const archiveInsert = await supabase
    .from('karma_pool_transactions')
    .insert({
      stripe_invoice_id: invoice.id,
      stripe_customer_id: invoice.customer as string,
      user_id: userId,
      amount_ttc_eur: split.amountTtcEur,
      amount_ht_eur: split.amountHtEur,
      tva_rate: split.tvaRate,
      split_user_pool: split.splits.user_pool,
      split_asso: split.splits.asso,
      split_adya: split.splits.adya,
      split_sasu: split.splits.sasu,
      split_user_pool_pct: split.percents.user_pool,
      split_asso_pct: split.percents.asso,
      split_adya_pct: split.percents.adya,
      split_sasu_pct: split.percents.sasu,
      processed_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (archiveInsert.error) {
    // Duplicate stripe_invoice_id → webhook retry safe
    if (archiveInsert.error.code === '23505') {
      return { applied: false, reason: 'duplicate' }
    }
    return {
      applied: false,
      reason: 'error',
      detail: archiveInsert.error.message,
    }
  }
  if (!archiveInsert.data) {
    return { applied: false, reason: 'error', detail: 'insert returned no row' }
  }

  // 2. Update pool_balances + insert 4 pool_transactions (audit)
  const moves: Array<{ pool: 'user_pool' | 'asso' | 'adya' | 'sasu'; amount: number }> = [
    { pool: 'user_pool', amount: split.splits.user_pool },
    { pool: 'asso', amount: split.splits.asso },
    { pool: 'adya', amount: split.splits.adya },
    { pool: 'sasu', amount: split.splits.sasu },
  ]

  for (const { pool, amount } of moves) {
    if (amount <= 0) continue

    // Update balance atomique (fetch + update — RLS service_role)
    const { data: current } = await supabase
      .from('pool_balances')
      .select('balance, total_in')
      .eq('pool_type', pool)
      .single<{ balance: number; total_in: number }>()

    const currentBalance = Number(current?.balance ?? 0)
    const currentTotalIn = Number(current?.total_in ?? 0)

    await supabase
      .from('pool_balances')
      .update({
        balance: round2(currentBalance + amount),
        total_in: round2(currentTotalIn + amount),
        updated_at: new Date().toISOString(),
      })
      .eq('pool_type', pool)

    await supabase.from('pool_transactions').insert({
      pool_type: pool,
      amount,
      direction: 'in',
      reason: 'karma_split_v7_1',
      metadata: {
        source: 'invoice.paid',
        stripe_invoice_id: invoice.id,
        user_id: userId,
        percent: split.percents[pool],
      },
    })
  }

  return { applied: true, split, archiveId: archiveInsert.data.id }
}
