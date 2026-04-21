import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { creditWallet } from '@/lib/smart-split'
import { logApiCall } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// CRON quotidien (00h05 UTC) — redistribution du pool_balances.user_pool
// vers les wallets des utilisateurs actifs.
//
// Règle CLAUDE.md §20 (Wealth Engine) :
//   « GAINS DIRECTS — Revenu quotidien (20% pool ÷ users actifs CRON minuit) »
//
// Flow :
//   1. Auth Bearer CRON_SECRET (pattern aligné auto-plan / upgrade-ots-proofs).
//   2. Idempotence : vérifie qu'aucune pool_transactions
//      (reason='karma_daily_distribution', metadata.date=YYYY-MM-DD)
//      n'existe déjà pour aujourd'hui.
//   3. Fetch pool_balances.user_pool.
//   4. Amount à distribuer = balance × RATE (default 0.20, override env).
//   5. Fetch utilisateurs actifs : profiles.last_active_at ≥ now - 7j.
//   6. per_user = floor(amount × 100 / N) / 100 (cents precision).
//      effective_total = per_user × N (≤ amount, reste arrondi stocké).
//   7. Décrémente user_pool (balance, total_out) + insert pool_transactions 'out'.
//   8. Boucle users : creditWallet(mode='split', source='karma_daily_distribution').
//   9. Retourne JSON récap + logApiCall.
//
// Propriétés :
//   - Idempotent (lock par date dans pool_transactions).
//   - Atomicité best-effort : pool_balances debit AVANT crédits users. Si une
//     itération creditWallet échoue → la fraction correspondante reste due à
//     l'user, l'audit trail dans pool_transactions.metadata.failed[] permet
//     réexécution manuelle.
//   - Scale : BATCH_LIMIT 2000 users/run. maxDuration 300s. Si N > BATCH_LIMIT
//     on prend les 2000 derniers actifs (ceux avec last_active_at le plus récent).
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET
const DISTRIBUTION_RATE = Number(process.env.KARMA_DISTRIBUTION_RATE ?? 0.2)
const ACTIVE_WINDOW_DAYS = Number(process.env.KARMA_ACTIVE_WINDOW_DAYS ?? 7)
const BATCH_LIMIT = 2000
const LOCK_REASON = 'karma_daily_distribution'

type ActiveUser = { id: string; last_active_at: string | null }

function todayKey(): string {
  // Clé date UTC (YYYY-MM-DD) — un CRON run par jour.
  return new Date().toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET(request: Request): Promise<Response> {
  const startedAt = Date.now()

  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (DISTRIBUTION_RATE <= 0 || DISTRIBUTION_RATE > 1) {
    return NextResponse.json(
      {
        error: 'invalid_rate',
        detail: `KARMA_DISTRIBUTION_RATE must be in (0,1], got ${DISTRIBUTION_RATE}`,
      },
      { status: 500 },
    )
  }

  const supabase = createServiceClient()
  const dateKey = todayKey()

  // 1. Idempotence : check lock pour la date du jour.
  const { data: existingLock } = await supabase
    .from('pool_transactions')
    .select('id, metadata')
    .eq('reason', LOCK_REASON)
    .contains('metadata', { date: dateKey })
    .limit(1)
    .maybeSingle<{ id: string; metadata: Record<string, unknown> }>()

  if (existingLock) {
    return NextResponse.json({
      skipped: true,
      reason: 'already_distributed_today',
      date: dateKey,
      existing_tx_id: existingLock.id,
    })
  }

  // 2. Fetch pool user_pool.
  const { data: pool, error: poolErr } = await supabase
    .from('pool_balances')
    .select('balance, total_out')
    .eq('pool_type', 'user_pool')
    .maybeSingle<{ balance: number; total_out: number }>()

  if (poolErr) {
    await logApiCall(
      null,
      'karma-split',
      '/api/cron/karma-split-distribute',
      'error',
      Date.now() - startedAt,
      `pool fetch: ${poolErr.message}`,
    )
    return NextResponse.json(
      { error: 'pool_fetch', detail: poolErr.message },
      { status: 500 },
    )
  }
  const poolBalance = Number(pool?.balance ?? 0)

  if (poolBalance <= 0) {
    await logApiCall(
      null,
      'karma-split',
      '/api/cron/karma-split-distribute',
      'success',
      Date.now() - startedAt,
      undefined,
    )
    return NextResponse.json({
      skipped: true,
      reason: 'empty_pool',
      pool_balance: poolBalance,
      date: dateKey,
    })
  }

  // 3. Montant à distribuer.
  const amountToDistribute = round2(poolBalance * DISTRIBUTION_RATE)
  if (amountToDistribute <= 0) {
    return NextResponse.json({
      skipped: true,
      reason: 'amount_below_cent',
      pool_balance: poolBalance,
      rate: DISTRIBUTION_RATE,
      date: dateKey,
    })
  }

  // 4. Utilisateurs actifs (last_active_at dans la fenêtre).
  const cutoffIso = new Date(
    Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000,
  ).toISOString()

  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id, last_active_at')
    .gte('last_active_at', cutoffIso)
    .order('last_active_at', { ascending: false })
    .limit(BATCH_LIMIT)
    .returns<ActiveUser[]>()

  if (usersErr) {
    return NextResponse.json(
      { error: 'users_fetch', detail: usersErr.message },
      { status: 500 },
    )
  }

  const activeUsers = users ?? []
  if (activeUsers.length === 0) {
    return NextResponse.json({
      skipped: true,
      reason: 'no_active_users',
      pool_balance: poolBalance,
      amount: amountToDistribute,
      date: dateKey,
    })
  }

  // 5. Part par user (floor cents → reste en pool).
  const N = activeUsers.length
  const perUser = Math.floor((amountToDistribute * 100) / N) / 100
  if (perUser <= 0) {
    return NextResponse.json({
      skipped: true,
      reason: 'per_user_below_cent',
      amount: amountToDistribute,
      active_users: N,
      date: dateKey,
    })
  }
  const effectiveTotal = round2(perUser * N)

  // 6. Debit du pool + lock idempotence (1 seule pool_transactions 'out').
  const newBalance = round2(poolBalance - effectiveTotal)
  const newTotalOut = round2(Number(pool?.total_out ?? 0) + effectiveTotal)

  const updatePool = await supabase
    .from('pool_balances')
    .update({
      balance: newBalance,
      total_out: newTotalOut,
      updated_at: new Date().toISOString(),
    })
    .eq('pool_type', 'user_pool')

  if (updatePool.error) {
    return NextResponse.json(
      { error: 'pool_debit', detail: updatePool.error.message },
      { status: 500 },
    )
  }

  const lockInsert = await supabase
    .from('pool_transactions')
    .insert({
      pool_type: 'user_pool',
      amount: effectiveTotal,
      direction: 'out',
      reason: LOCK_REASON,
      metadata: {
        date: dateKey,
        rate: DISTRIBUTION_RATE,
        active_window_days: ACTIVE_WINDOW_DAYS,
        pool_balance_before: poolBalance,
        active_users: N,
        per_user: perUser,
        amount_planned: amountToDistribute,
        remainder_cents: Math.round((amountToDistribute - effectiveTotal) * 100),
      },
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (lockInsert.error || !lockInsert.data) {
    // Rollback best-effort : restaurer la balance pool (on n'a encore rien crédité).
    await supabase
      .from('pool_balances')
      .update({
        balance: poolBalance,
        total_out: Number(pool?.total_out ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('pool_type', 'user_pool')
    return NextResponse.json(
      {
        error: 'lock_insert',
        detail: lockInsert.error?.message ?? 'insert returned no row',
      },
      { status: 500 },
    )
  }

  // 7. Crédit chaque user via creditWallet (mode='split' → sub-wallets).
  let credited = 0
  const failed: Array<{ user_id: string; error: string }> = []

  for (const user of activeUsers) {
    try {
      await creditWallet({
        userId: user.id,
        amount: perUser,
        source: LOCK_REASON,
        description: `Redistribution quotidienne du pool collectif (${dateKey})`,
        mode: 'split',
      })
      credited += 1
    } catch (err) {
      failed.push({
        user_id: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // 8. Si des crédits ont échoué → patch la lock row pour audit.
  if (failed.length > 0) {
    await supabase
      .from('pool_transactions')
      .update({
        metadata: {
          date: dateKey,
          rate: DISTRIBUTION_RATE,
          active_window_days: ACTIVE_WINDOW_DAYS,
          pool_balance_before: poolBalance,
          active_users: N,
          per_user: perUser,
          amount_planned: amountToDistribute,
          remainder_cents: Math.round((amountToDistribute - effectiveTotal) * 100),
          credited,
          failed,
        },
      })
      .eq('id', lockInsert.data.id)
  }

  const durationMs = Date.now() - startedAt
  await logApiCall(
    null,
    'karma-split',
    '/api/cron/karma-split-distribute',
    failed.length > 0 ? 'partial' : 'success',
    durationMs,
    failed.length > 0 ? `${failed.length} credits failed` : undefined,
  )

  return NextResponse.json({
    date: dateKey,
    pool_balance_before: poolBalance,
    rate: DISTRIBUTION_RATE,
    amount_planned: amountToDistribute,
    effective_total: effectiveTotal,
    active_users: N,
    per_user: perUser,
    credited,
    failed_count: failed.length,
    remainder_cents: Math.round((amountToDistribute - effectiveTotal) * 100),
    pool_balance_after: newBalance,
    duration_ms: durationMs,
    lock_tx_id: lockInsert.data.id,
  })
}
