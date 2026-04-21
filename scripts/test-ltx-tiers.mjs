#!/usr/bin/env node
// Tests du tier routing V7.1 pour LTX + tracking video_generations.
//
// Offline : node --test scripts/test-ltx-tiers.mjs
//   → Logique pure selectEngine (sans I/O).
//
// DB      : LTX_TRACK_DB=1 node --test scripts/test-ltx-tiers.mjs
//   → Insert + select dans sutra.video_generations contre VPS Supabase + cleanup.

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

const DB = process.env.LTX_TRACK_DB === '1'
const SUPER_ADMIN = 'matiss.frasne@gmail.com'

// Ré-implémentation de selectEngine (iso avec src/lib/ltx.ts) pour test sans tsx.
function isSuperAdmin(email) {
  return email === SUPER_ADMIN
}

function selectEngine(plan, userEmail) {
  if (userEmail && isSuperAdmin(userEmail)) {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'enterprise' || plan === 'admin') {
    return { engine: 'ltx-pro', model: 'ltx-2-3-pro' }
  }
  if (plan === 'starter' || plan === 'creator' || plan === 'empire') {
    return { engine: 'ltx-fast', model: 'ltx-2-3-fast' }
  }
  return { engine: 'wan-classic', model: 'wan-2.2' }
}

test('super_admin → ltx-2-3-pro (tous plans)', () => {
  for (const plan of ['free', 'starter', 'creator', 'empire', 'enterprise', 'admin']) {
    const r = selectEngine(plan, SUPER_ADMIN)
    assert.equal(r.engine, 'ltx-pro')
    assert.equal(r.model, 'ltx-2-3-pro')
  }
})

test('enterprise + admin → ltx-2-3-pro', () => {
  for (const plan of ['enterprise', 'admin']) {
    const r = selectEngine(plan, 'someone@example.com')
    assert.equal(r.engine, 'ltx-pro', `plan=${plan}`)
    assert.equal(r.model, 'ltx-2-3-pro', `plan=${plan}`)
  }
})

test('starter/creator/empire → ltx-2-3-fast', () => {
  for (const plan of ['starter', 'creator', 'empire']) {
    const r = selectEngine(plan, 'user@example.com')
    assert.equal(r.engine, 'ltx-fast', `plan=${plan}`)
    assert.equal(r.model, 'ltx-2-3-fast', `plan=${plan}`)
  }
})

test('free → wan-2.2 direct (pas de LTX)', () => {
  const r = selectEngine('free', 'user@example.com')
  assert.equal(r.engine, 'wan-classic')
  assert.equal(r.model, 'wan-2.2')
})

test('free sans email → wan-2.2', () => {
  const r = selectEngine('free', null)
  assert.equal(r.engine, 'wan-classic')
})

test('super_admin override free plan', () => {
  const r = selectEngine('free', SUPER_ADMIN)
  assert.equal(r.engine, 'ltx-pro')
})

test(
  'DB : insert dans video_generations + lecture + cleanup',
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

    // On utilise le user super admin existant (bc865aa4...)
    const { data: superAdminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', SUPER_ADMIN)
      .maybeSingle()

    if (!superAdminUser?.id) {
      assert.fail('super admin profile not found — seed first')
      return
    }

    const testRunMarker = `TEST_V71_D1_${Date.now()}`
    const { data: inserted, error: insertErr } = await supabase
      .from('video_generations')
      .insert({
        user_id: superAdminUser.id,
        user_plan: 'enterprise',
        engine_requested: 'ltx',
        model_requested: 'ltx-2-3-pro',
        engine_used: 'ltx',
        model_used: 'ltx-2-3-pro',
        fallback_triggered: false,
        fallback_reason: null,
        duration_ms: 42000,
        cost_eur_estimated: 0.05,
        success: true,
        error_message: null,
        request_metadata: { test_marker: testRunMarker },
      })
      .select('id')
      .single()
    assert.equal(insertErr, null, `insert failed: ${insertErr?.message}`)
    assert.ok(inserted?.id, 'insert returned id')

    const { data: read } = await supabase
      .from('video_generations')
      .select('user_plan, engine_used, model_used, fallback_triggered, success')
      .eq('id', inserted.id)
      .single()
    assert.equal(read.user_plan, 'enterprise')
    assert.equal(read.engine_used, 'ltx')
    assert.equal(read.model_used, 'ltx-2-3-pro')
    assert.equal(read.fallback_triggered, false)
    assert.equal(read.success, true)

    // Test insert fallback scenario
    await supabase.from('video_generations').insert({
      user_id: superAdminUser.id,
      user_plan: 'free',
      engine_requested: 'ltx',
      model_requested: 'ltx-2-3-fast',
      engine_used: 'wan',
      model_used: 'wan-2.2',
      fallback_triggered: true,
      fallback_reason: 'ltx_timeout_180s',
      duration_ms: 189000,
      success: true,
      request_metadata: { test_marker: testRunMarker },
    })

    // Test CHECK engine_used invalide
    const { error: badErr } = await supabase.from('video_generations').insert({
      user_id: superAdminUser.id,
      user_plan: 'free',
      engine_requested: 'ltx',
      model_requested: 'ltx-2-3-fast',
      engine_used: 'gpt-4o',
      model_used: 'gpt-4o',
      fallback_triggered: false,
      success: true,
      request_metadata: { test_marker: testRunMarker },
    })
    assert.ok(badErr, 'CHECK should reject invalid engine_used')

    // Cleanup
    const { error: delErr } = await supabase
      .from('video_generations')
      .delete()
      .contains('request_metadata', { test_marker: testRunMarker })
    assert.equal(delErr, null, `cleanup failed: ${delErr?.message}`)
  },
)
