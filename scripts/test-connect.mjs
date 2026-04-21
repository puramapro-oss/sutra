#!/usr/bin/env node
// Test d'intégration Stripe Connect (live mode).
// Valide que la config V4.1 (Embedded Components, controller fees=account)
// est bien acceptée par Stripe pour SUTRA sans STRIPE_CONNECT_CLIENT_ID.
//
// Scénario :
//   1. Create Connect Express account FR (controller fees=account, losses=application)
//   2. Create AccountSession avec 7 composants V4.1
//   3. Vérifier que client_secret renvoyé + expires_at > now
//   4. Delete le compte (cleanup — pas de facturation Stripe car 0 activité)
//
// Usage : node scripts/test-connect.mjs
// Prérequis : .env.local avec STRIPE_SECRET_KEY (sk_live_...)

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const SK = env.STRIPE_SECRET_KEY
if (!SK) {
  console.error('❌ STRIPE_SECRET_KEY missing')
  process.exit(1)
}

async function stripePost(path, body) {
  const formBody = new URLSearchParams()
  function walk(prefix, val) {
    if (val === undefined || val === null) return
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [k, v] of Object.entries(val)) walk(`${prefix}[${k}]`, v)
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => walk(`${prefix}[${i}]`, v))
    } else {
      formBody.append(prefix, String(val))
    }
  }
  for (const [k, v] of Object.entries(body)) walk(k, v)

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SK}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Stripe ${path} ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`)
  }
  return json
}

async function stripeDelete(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${SK}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Stripe DELETE ${path} ${res.status}: ${json.error?.message}`)
  return json
}

let passed = 0
let failed = 0
const fails = []

function ok(msg) {
  console.log(`✔ ${msg}`)
  passed++
}
function fail(msg, err) {
  console.log(`✖ ${msg}`)
  failed++
  fails.push(`${msg}: ${err?.message ?? err}`)
}

let accountId = null
try {
  // 1. Create FR avec controller (équivalent Express, V4.1 moderne)
  const account = await stripePost('/accounts', {
    country: 'FR',
    email: `sutra-connect-test-${Date.now()}@example.com`,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    controller: {
      fees: { payer: 'account' },
      losses: { payments: 'stripe' },
      stripe_dashboard: { type: 'none' },
      requirement_collection: 'stripe',
    },
    metadata: { test: 'sutra-v7.1-connect', timestamp: Date.now() },
  })
  accountId = account.id
  if (accountId?.startsWith('acct_')) {
    ok(`Express account created: ${accountId}`)
  } else {
    fail('Express account create', new Error(`invalid id: ${accountId}`))
  }

  // 2. Controller config check
  if (account.controller?.fees?.payer === 'account') ok('controller.fees.payer=account')
  else fail('controller.fees.payer should be "account"', new Error(JSON.stringify(account.controller)))
  if (account.controller?.losses?.payments === 'stripe') ok('controller.losses.payments=stripe')
  else fail('controller.losses.payments should be "stripe"', new Error(JSON.stringify(account.controller?.losses)))

  // 3. AccountSession avec 7 composants V4.1
  const session = await stripePost('/account_sessions', {
    account: accountId,
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
  if (session.client_secret && typeof session.client_secret === 'string' && session.client_secret.length > 20) {
    ok(`AccountSession client_secret received (${session.client_secret.slice(0, 15)}…)`)
  } else {
    fail('AccountSession client_secret missing', new Error(JSON.stringify(session)))
  }
  if (session.expires_at && session.expires_at * 1000 > Date.now()) {
    const mins = Math.round((session.expires_at * 1000 - Date.now()) / 60000)
    ok(`AccountSession expires in ~${mins} min`)
  } else {
    fail('AccountSession expires_at invalid', new Error(''))
  }

  // 4. Vérifier que les 7 composants sont tous actifs
  const comps = session.components ?? {}
  const expected = [
    'account_onboarding',
    'account_management',
    'notification_banner',
    'payouts',
    'payments',
    'balances',
    'documents',
  ]
  const missing = expected.filter((c) => !comps[c]?.enabled)
  if (missing.length === 0) ok(`7 components enabled on session`)
  else fail(`components not enabled: ${missing.join(',')}`, new Error(''))
} catch (err) {
  fail('uncaught exception during scenario', err)
}

// 5. Cleanup — delete test account
if (accountId) {
  try {
    const del = await stripeDelete(`/accounts/${accountId}`)
    if (del.deleted === true) ok(`cleanup: account ${accountId} deleted`)
    else fail('cleanup delete failed', new Error(JSON.stringify(del)))
  } catch (err) {
    fail('cleanup delete threw', err)
  }
}

console.log(`\nResult: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  fails.forEach((f) => console.log(`  - ${f}`))
}
process.exit(failed > 0 ? 1 : 0)
