#!/usr/bin/env node
// Tests du Karma Split 50/10/10/30.
//
// Offline (défaut) : node --test scripts/test-karma-split.mjs
//   → Logique pure de calcul du split, 0 I/O.
//
// DB-integration   : KARMA_SPLIT_DB=1 node --test scripts/test-karma-split.mjs
//   → Applique un split fake dans la DB, vérifie karma_pool_transactions,
//     pool_balances et pool_transactions, puis cleanup. Live VPS Supabase.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const envRaw = readFileSync(resolve(rootDir, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const DB = process.env.KARMA_SPLIT_DB === '1'

// Ré-implémentation pure du split (identique à src/lib/karma-split.ts) pour tester
// sans besoin de tsx/ts-node. Doit rester iso avec la lib TS.
const SPLIT = { user_pool: 0.5, asso: 0.1, adya: 0.1, sasu: 0.3 }

function round2(n) {
  return Math.round(n * 100) / 100
}

function computeSplit(invoice) {
  const amountTtcCents = invoice.amount_paid ?? 0
  const taxCents =
    (invoice.tax ?? 0) ||
    (invoice.total_taxes ?? []).reduce((s, t) => s + (t.amount ?? 0), 0) ||
    0
  const amountHtCentsRaw = invoice.total_excluding_tax ?? Math.max(0, amountTtcCents - taxCents)
  const amountHtEur = amountHtCentsRaw / 100
  const amountTtcEur = amountTtcCents / 100
  const tvaRate = amountHtCentsRaw > 0 ? taxCents / amountHtCentsRaw : 0

  const userPool = round2(amountHtEur * SPLIT.user_pool)
  const asso = round2(amountHtEur * SPLIT.asso)
  const adya = round2(amountHtEur * SPLIT.adya)
  const sasu = round2(amountHtEur - userPool - asso - adya)
  return {
    amountHtEur,
    amountTtcEur,
    tvaRate,
    splits: { user_pool: userPool, asso, adya, sasu },
  }
}

// ---------------------------------------------------------------------------
// OFFLINE — Logique pure
// ---------------------------------------------------------------------------

test('Split sur 9.99€ franchise 293B (0% TVA)', () => {
  const r = computeSplit({ amount_paid: 999, tax: 0, total_excluding_tax: 999 })
  assert.equal(r.amountHtEur, 9.99)
  assert.equal(r.amountTtcEur, 9.99)
  assert.equal(r.tvaRate, 0)
  assert.equal(r.splits.user_pool, 5.0)
  assert.equal(r.splits.asso, 1.0)
  assert.equal(r.splits.adya, 1.0)
  assert.equal(r.splits.sasu, 2.99)
  const sum = r.splits.user_pool + r.splits.asso + r.splits.adya + r.splits.sasu
  assert.equal(round2(sum), 9.99, 'sum must equal HT')
})

test('Split sur 100€ TTC avec TVA 20% (HT=83.33€)', () => {
  const r = computeSplit({
    amount_paid: 10000,
    tax: 1667,
    total_excluding_tax: 8333,
  })
  assert.equal(r.amountHtEur, 83.33)
  assert.equal(r.amountTtcEur, 100)
  assert.ok(Math.abs(r.tvaRate - 0.2) < 0.001)
  assert.equal(r.splits.user_pool, 41.67)
  assert.equal(r.splits.asso, 8.33)
  assert.equal(r.splits.adya, 8.33)
  assert.equal(r.splits.sasu, 25.0)
  const sum = round2(r.splits.user_pool + r.splits.asso + r.splits.adya + r.splits.sasu)
  assert.equal(sum, 83.33, 'sum must equal HT exactly (sasu absorbs rounding)')
})

test('Split sur amount 0 → tous à 0', () => {
  const r = computeSplit({ amount_paid: 0 })
  assert.equal(r.amountHtEur, 0)
  assert.equal(r.splits.user_pool, 0)
  assert.equal(r.splits.asso, 0)
  assert.equal(r.splits.adya, 0)
  assert.equal(r.splits.sasu, 0)
})

test('Fallback sans total_excluding_tax : HT = TTC - tax', () => {
  const r = computeSplit({ amount_paid: 1200, tax: 200 })
  assert.equal(r.amountHtEur, 10)
  assert.equal(r.splits.user_pool, 5)
  assert.equal(r.splits.asso, 1)
  assert.equal(r.splits.adya, 1)
  assert.equal(r.splits.sasu, 3)
})

test('Format total_taxes[] moderne Stripe 2025+', () => {
  const r = computeSplit({
    amount_paid: 1200,
    total_taxes: [{ amount: 200 }],
    total_excluding_tax: 1000,
  })
  assert.equal(r.amountHtEur, 10)
  assert.equal(r.splits.user_pool, 5)
})

test('Invariant : somme des splits == HT pour 100 invoices aléatoires', () => {
  for (let i = 0; i < 100; i++) {
    const amount = Math.floor(Math.random() * 100000) + 1 // 1 cent → 1000€
    const r = computeSplit({ amount_paid: amount, tax: 0, total_excluding_tax: amount })
    const sum = round2(r.splits.user_pool + r.splits.asso + r.splits.adya + r.splits.sasu)
    assert.equal(sum, r.amountHtEur, `invariant failed for amount=${amount}: sum=${sum} ht=${r.amountHtEur}`)
  }
})

// ---------------------------------------------------------------------------
// DB — appliqué contre VPS Supabase (opt-in)
// ---------------------------------------------------------------------------

test(
  'DB : applique split sur invoice fake → archive + pool_balances + pool_transactions',
  { skip: !DB },
  async () => {
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        db: { schema: 'sutra' },
        auth: { autoRefreshToken: false, persistSession: false },
      },
    )

    const invoiceId = `in_test_karma_${Date.now()}`
    const split = computeSplit({ amount_paid: 999, tax: 0, total_excluding_tax: 999 })

    // Snapshot balances avant
    const { data: beforePools } = await supabase
      .from('pool_balances')
      .select('pool_type, balance')
      .in('pool_type', ['user_pool', 'asso', 'adya', 'sasu'])

    const beforeMap = Object.fromEntries(
      (beforePools ?? []).map((p) => [p.pool_type, Number(p.balance)]),
    )

    // Insert archive (trigger vérifie sum == HT)
    const { data: archive, error: archErr } = await supabase
      .from('karma_pool_transactions')
      .insert({
        stripe_invoice_id: invoiceId,
        amount_ttc_eur: split.amountTtcEur,
        amount_ht_eur: split.amountHtEur,
        tva_rate: split.tvaRate,
        split_user_pool: split.splits.user_pool,
        split_asso: split.splits.asso,
        split_adya: split.splits.adya,
        split_sasu: split.splits.sasu,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    assert.equal(archErr, null, `insert archive: ${archErr?.message}`)
    assert.ok(archive?.id, 'archive id returned')

    // Simule les 4 pool updates + pool_transactions (ce que fait applyKarmaSplit)
    const moves = [
      { pool: 'user_pool', amount: split.splits.user_pool },
      { pool: 'asso', amount: split.splits.asso },
      { pool: 'adya', amount: split.splits.adya },
      { pool: 'sasu', amount: split.splits.sasu },
    ]
    for (const { pool, amount } of moves) {
      const { data: current } = await supabase
        .from('pool_balances')
        .select('balance, total_in')
        .eq('pool_type', pool)
        .single()
      await supabase
        .from('pool_balances')
        .update({
          balance: round2(Number(current.balance) + amount),
          total_in: round2(Number(current.total_in ?? 0) + amount),
        })
        .eq('pool_type', pool)
      await supabase.from('pool_transactions').insert({
        pool_type: pool,
        amount,
        direction: 'in',
        reason: 'karma_split_test',
        metadata: { stripe_invoice_id: invoiceId },
      })
    }

    // Vérif : balances ont augmenté des bons montants
    const { data: afterPools } = await supabase
      .from('pool_balances')
      .select('pool_type, balance')
      .in('pool_type', ['user_pool', 'asso', 'adya', 'sasu'])

    for (const p of afterPools ?? []) {
      const expected = round2(beforeMap[p.pool_type] + split.splits[p.pool_type])
      assert.equal(
        round2(Number(p.balance)),
        expected,
        `${p.pool_type}: expected ${expected}, got ${p.balance}`,
      )
    }

    // Vérif : trigger refuse un split incorrect (sanity check)
    const { error: badErr } = await supabase.from('karma_pool_transactions').insert({
      stripe_invoice_id: `in_test_bad_${Date.now()}`,
      amount_ttc_eur: 10,
      amount_ht_eur: 10,
      tva_rate: 0,
      split_user_pool: 1, // 1+1+1+1 != 10 → trigger rejects
      split_asso: 1,
      split_adya: 1,
      split_sasu: 1,
    })
    assert.ok(badErr, 'trigger should reject invalid split')
    assert.match(badErr.message, /Karma split integrity/i, `unexpected error: ${badErr?.message}`)

    // Cleanup : reverse pool updates + delete archive + delete test pool_transactions
    for (const { pool, amount } of moves) {
      const { data: current } = await supabase
        .from('pool_balances')
        .select('balance, total_in')
        .eq('pool_type', pool)
        .single()
      await supabase
        .from('pool_balances')
        .update({
          balance: round2(Number(current.balance) - amount),
          total_in: round2(Number(current.total_in ?? 0) - amount),
        })
        .eq('pool_type', pool)
    }
    await supabase.from('pool_transactions').delete().eq('reason', 'karma_split_test')
    await supabase.from('karma_pool_transactions').delete().eq('stripe_invoice_id', invoiceId)
  },
)
