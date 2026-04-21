import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'
import { logApiCall } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// CRON mensuel (1er du mois, 09h00 UTC) — virement du pool_balances.asso vers
// l'Association PURAMA (mécénat → réduction IS 60%).
//
// Règle CLAUDE.md V7.1 §20 (Wealth Engine) :
//   « 10% abonnements → Association PURAMA (mécénat, réduction IS 60%) »
//   Accumulés dans pool_balances.asso via applyKarmaSplit à chaque invoice.paid.
//   Vidés mensuellement vers IBAN Asso par ce CRON.
//
// Phase 1 (PURAMA_PHASE=1, Treezor pas live) :
//   1. Auth Bearer \$CRON_SECRET.
//   2. Idempotence : lock pool_transactions reason='asso_monthly_transfer'
//      + metadata.month=YYYY-MM (même pattern que karma-split-distribute).
//   3. Lit pool_balances.asso.
//   4. Si balance >= MIN_TRANSFER_EUR → debit + lock tx 'out' + email Tissma.
//   5. Email Resend → matiss.frasne@gmail.com avec montant + RNA Asso.
//
// Phase 2 (TREEZOR_ACTIVE=true) :
//   Ajouter ici l'appel Treezor SEPA credit transfer vers IBAN Asso.
//   Pour l'instant : record + email (manuel).
//
// Base légale :
//   - Mécénat art. 238 bis CGI → reçu fiscal → réduction IS 60% SASU.
//   - RNA Association PURAMA (Solenne DORNIER) — à remplir ASSO_RNA env.
// ---------------------------------------------------------------------------

const CRON_SECRET = process.env.CRON_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ASSO_NOTIFY_EMAIL = process.env.ASSO_NOTIFY_EMAIL ?? 'matiss.frasne@gmail.com'
const ASSO_RNA = process.env.ASSO_RNA ?? '(RNA non configuré)'
const ASSO_IBAN = process.env.ASSO_IBAN ?? '(IBAN non configuré)'
const MIN_TRANSFER_EUR = Number(process.env.ASSO_MIN_TRANSFER_EUR ?? 10)
const LOCK_REASON = 'asso_monthly_transfer'
const TREEZOR_ACTIVE = process.env.TREEZOR_ACTIVE === 'true'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function monthKey(): string {
  // Clé YYYY-MM UTC.
  return new Date().toISOString().slice(0, 7)
}

async function notifyTissma(opts: {
  amountEur: number
  poolBalanceBefore: number
  month: string
  lockTxId: string
}): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { sent: false, error: 'RESEND_API_KEY manquant' }
  }
  try {
    const resend = new Resend(RESEND_API_KEY)
    const subject = `[Purama / Asso] Virement mensuel ${opts.month} — ${opts.amountEur.toFixed(2)} €`
    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#06050e;color:#f8fafc;padding:40px;border-radius:12px">
        <h1 style="color:#8b5cf6;margin:0 0 16px">Virement Asso PURAMA — ${opts.month}</h1>
        <p style="color:rgba(255,255,255,0.8);line-height:1.6">
          Le CRON mensuel vient de préparer le virement des 10% mécénat du mois.
          Tant que Treezor n'est pas actif, il est à exécuter à la main depuis le compte PURAMA SASU.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:24px 0;background:rgba(255,255,255,0.03);border-radius:8px;overflow:hidden">
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">Montant</td><td style="padding:12px 16px;font-weight:600">${opts.amountEur.toFixed(2)} €</td></tr>
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">Mois</td><td style="padding:12px 16px">${opts.month}</td></tr>
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">Pool asso avant</td><td style="padding:12px 16px">${opts.poolBalanceBefore.toFixed(2)} €</td></tr>
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">Association RNA</td><td style="padding:12px 16px">${ASSO_RNA}</td></tr>
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">IBAN destinataire</td><td style="padding:12px 16px;font-family:monospace">${ASSO_IBAN}</td></tr>
          <tr><td style="padding:12px 16px;color:rgba(255,255,255,0.5)">Réf. audit</td><td style="padding:12px 16px;font-family:monospace;font-size:11px">${opts.lockTxId}</td></tr>
        </table>

        <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6">
          Base légale : mécénat art. 238 bis CGI → demander reçu fiscal à l'Association
          pour bénéficier de la réduction d'IS de 60% (plafond 20 000 € ou 0,5% CA HT).
        </p>

        <p style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:32px">
          Automation SUTRA V7.1 · asso-transfer CRON · ${new Date().toISOString()}
        </p>
      </div>
    `
    await resend.emails.send({
      from: 'SUTRA by Purama <noreply@purama.dev>',
      to: ASSO_NOTIFY_EMAIL,
      subject,
      html,
    })
    return { sent: true }
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function GET(request: Request): Promise<Response> {
  const startedAt = Date.now()

  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const month = monthKey()

  // 1. Idempotence.
  const { data: existingLock } = await supabase
    .from('pool_transactions')
    .select('id')
    .eq('reason', LOCK_REASON)
    .contains('metadata', { month })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (existingLock) {
    return NextResponse.json({
      skipped: true,
      reason: 'already_transferred_this_month',
      month,
      existing_tx_id: existingLock.id,
    })
  }

  // 2. Fetch pool asso.
  const { data: pool, error: poolErr } = await supabase
    .from('pool_balances')
    .select('balance, total_out')
    .eq('pool_type', 'asso')
    .maybeSingle<{ balance: number; total_out: number }>()

  if (poolErr) {
    await logApiCall(
      null,
      'asso-transfer',
      '/api/cron/asso-transfer',
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

  if (poolBalance < MIN_TRANSFER_EUR) {
    return NextResponse.json({
      skipped: true,
      reason: 'below_min_threshold',
      pool_balance: poolBalance,
      min: MIN_TRANSFER_EUR,
      month,
    })
  }

  const amountEur = round2(poolBalance)

  // 3. Debit + lock tx (atomique côté SUTRA).
  const newBalance = 0
  const newTotalOut = round2(Number(pool?.total_out ?? 0) + amountEur)

  const updatePool = await supabase
    .from('pool_balances')
    .update({
      balance: newBalance,
      total_out: newTotalOut,
      updated_at: new Date().toISOString(),
    })
    .eq('pool_type', 'asso')

  if (updatePool.error) {
    return NextResponse.json(
      { error: 'pool_debit', detail: updatePool.error.message },
      { status: 500 },
    )
  }

  const lockInsert = await supabase
    .from('pool_transactions')
    .insert({
      pool_type: 'asso',
      amount: amountEur,
      direction: 'out',
      reason: LOCK_REASON,
      metadata: {
        month,
        pool_balance_before: poolBalance,
        asso_rna: ASSO_RNA,
        asso_iban_tail: ASSO_IBAN.slice(-4),
        treezor_active: TREEZOR_ACTIVE,
        phase: TREEZOR_ACTIVE ? 2 : 1,
      },
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (lockInsert.error || !lockInsert.data) {
    // Rollback pool.
    await supabase
      .from('pool_balances')
      .update({
        balance: poolBalance,
        total_out: Number(pool?.total_out ?? 0),
        updated_at: new Date().toISOString(),
      })
      .eq('pool_type', 'asso')
    return NextResponse.json(
      {
        error: 'lock_insert',
        detail: lockInsert.error?.message ?? 'insert returned no row',
      },
      { status: 500 },
    )
  }

  // 4. Phase 2 : ici appel Treezor SEPA credit transfer.
  //    Tant que TREEZOR_ACTIVE=false, on se contente de notifier Tissma par
  //    email : il déclenche le virement manuel depuis le compte SASU.
  let treezorResult: { executed: boolean; reference?: string } = { executed: false }
  if (TREEZOR_ACTIVE) {
    // Phase 2 : brancher Treezor SEPA (TREEZOR_ACTIVE=true → wallet Treezor
    // débloqué, on pourra appeler leur API /sepa-credit-transfer ici).
    // Laissé en hook conscient — les credentials Treezor ne sont pas encore
    // provisionnés, et la V4.1 exige d'activer ça uniquement via PURAMA_PHASE=2.
    treezorResult = { executed: false }
  }

  // 5. Notification email Tissma.
  const email = await notifyTissma({
    amountEur,
    poolBalanceBefore: poolBalance,
    month,
    lockTxId: lockInsert.data.id,
  })

  const durationMs = Date.now() - startedAt
  await logApiCall(
    null,
    'asso-transfer',
    '/api/cron/asso-transfer',
    'success',
    durationMs,
    email.sent ? undefined : `email_failed: ${email.error ?? 'unknown'}`,
  )

  return NextResponse.json({
    month,
    pool_balance_before: poolBalance,
    amount_transferred: amountEur,
    pool_balance_after: newBalance,
    lock_tx_id: lockInsert.data.id,
    treezor_executed: treezorResult.executed,
    email_sent: email.sent,
    email_error: email.error,
    phase: TREEZOR_ACTIVE ? 2 : 1,
    duration_ms: durationMs,
  })
}
