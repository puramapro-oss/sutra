// A fresh disposable database, only on an explicitly confirmed loopback server.
// Does not contact the email provider or connect to an application database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { assertDisposableDatabase } from '../tooling/disposable-database.mjs'

const url = process.env.DATABASE_URL_LOCAL
assertDisposableDatabase(url, process.env.SUTRA_DISPOSABLE_DB)
const database = `sutra_ci_email_${randomUUID().replaceAll('-', '')}`
assert.match(database, /^sutra_ci_email_[a-f0-9]{32}$/)
const admin = new pg.Client({ connectionString: url })
const fixtureUrl = new URL(url); fixtureUrl.pathname = `/${database}`
const pool = new pg.Pool({ connectionString: fixtureUrl.toString(), max: 12 })
let created = false, rolesCreated = false
const owner = '11111111-1111-4111-8111-111111111111'
const legacy = '22222222-2222-4222-8222-222222222222'
const providerId = '33333333-3333-4333-8333-333333333333'
const base = await readFile(new URL('../migrations/v3_features.sql', import.meta.url), 'utf8')
const start = base.indexOf('CREATE TABLE IF NOT EXISTS sutra.email_sequences (')
const end = base.indexOf('CREATE TABLE IF NOT EXISTS sutra.email_templates (', start)
assert.ok(start > 0 && end > start, 'Use the exact retained email_sequences table definition')
const migration = await readFile(new URL('../migrations/20261122_email_sequence_receipts.sql', import.meta.url), 'utf8')
const setup = await readFile(new URL('../src/data/setup-schema.ts', import.meta.url), 'utf8')
const profileStart = setup.indexOf('CREATE TABLE IF NOT EXISTS sutra.profiles (')
const profileEnd = setup.indexOf('\n);', profileStart) + 3
assert.ok(profileStart > 0 && profileEnd > profileStart, 'Use the exact retained profiles table definition')
const candidateSql = 'SELECT * FROM sutra.email_sequence_candidates($1,$2,$3,$4,$5)'
const windowStart = '2026-11-22T00:00:00.000Z', windowEnd = '2026-11-23T00:00:00.000Z'
const candidateArgs = (type = 'welcome', after = null, limit = 100) => [type, windowStart, windowEnd, after, limit]
async function asRole(role, text, values = []) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role))
  const client = await pool.connect()
  try { await client.query(`SET ROLE ${role}`); return await client.query(text, values) }
  finally { await client.query('RESET ROLE'); client.release() }
}
try {
  await admin.connect()
  const existingRoles = await admin.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')")
  assert.equal(existingRoles.rowCount, 0, 'Use a disposable cluster without existing authorization roles')
  await admin.query(`CREATE DATABASE ${database}`); created = true
  await admin.query(`BEGIN;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
    COMMIT;`)
  rolesCreated = true
  await pool.query('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE SCHEMA sutra;')
  await pool.query(setup.slice(profileStart, profileEnd))
  await pool.query('ALTER TABLE sutra.profiles ADD COLUMN access_revoked_at timestamptz')
  await pool.query(base.slice(start, end))
  await pool.query('INSERT INTO auth.users(id) VALUES($1),($2)', [owner, legacy])
  await pool.query("INSERT INTO sutra.email_sequences(user_id,email_type,sent_at) VALUES($1,'welcome','2026-01-01T10:00:00Z')", [legacy])
  const before = (await pool.query('SELECT * FROM sutra.email_sequences')).rows
  await pool.query('ALTER TABLE sutra.email_sequences ADD COLUMN provider_message_id integer')
  const invalid = await pool.connect()
  try { await assert.rejects(invalid.query(migration), /incompatible/) }
  finally { await invalid.query('ROLLBACK'); invalid.release() }
  await pool.query('ALTER TABLE sutra.email_sequences DROP COLUMN provider_message_id')
  await pool.query(migration); await pool.query(migration)
  const after = (await pool.query('SELECT * FROM sutra.email_sequences')).rows
  assert.deepEqual(after.map(({ provider_message_id, ...row }) => {
    assert.equal(provider_message_id, null); return row
  }), before)
  console.log('PASS migration replay and historical receipts preserved; incompatible column refused')

  const attempts = await Promise.allSettled(Array.from({ length: 12 }, () => pool.query(
    "INSERT INTO sutra.email_sequences(user_id,email_type,sent_at) VALUES($1,'welcome',NULL) RETURNING id,sent_at", [owner],
  )))
  const winners = attempts.filter(value => value.status === 'fulfilled')
  const losers = attempts.filter(value => value.status === 'rejected')
  assert.equal(winners.length, 1); assert.equal(losers.length, 11)
  for (const value of losers) assert.equal(value.reason.code, '23505')
  const reservation = winners[0].value.rows[0]; assert.equal(reservation.sent_at, null)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sutra.email_sequences WHERE user_id=$1', [owner])).rows[0].n, 1)
  console.log('PASS twelve concurrent admissions: one winner and eleven unique conflicts')

  const receipt = await pool.query(`UPDATE sutra.email_sequences SET sent_at=clock_timestamp(),provider_message_id=$3
    WHERE id=$1 AND user_id=$2 AND sent_at IS NULL RETURNING *`, [reservation.id, owner, providerId])
  assert.equal(receipt.rowCount, 1); assert.equal(receipt.rows[0].provider_message_id, providerId)
  const duplicate = await pool.query(`UPDATE sutra.email_sequences SET provider_message_id='incorrect'
    WHERE id=$1 AND user_id=$2 AND sent_at IS NULL RETURNING *`, [reservation.id, owner])
  assert.equal(duplicate.rowCount, 0)
  assert.equal((await pool.query('SELECT provider_message_id FROM sutra.email_sequences WHERE id=$1', [reservation.id])).rows[0].provider_message_id, providerId)
  console.log('PASS accepted receipt is persisted once and cannot be overwritten by a late acknowledgement')

  await pool.query('GRANT USAGE ON SCHEMA sutra TO anon,authenticated,service_role; GRANT SELECT ON sutra.profiles,sutra.email_sequences TO service_role;')
  const signature = 'sutra.email_sequence_candidates(text,timestamptz,timestamptz,uuid,integer)'
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, signature])).rows[0].allowed, false)
    await assert.rejects(asRole(role, candidateSql, candidateArgs()), /permission denied/i)
  }
  assert.equal((await pool.query("SELECT has_function_privilege('service_role',$1,'EXECUTE') AS allowed", [signature])).rows[0].allowed, true)
  const functionMode = (await pool.query('SELECT prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure', [signature])).rows[0]
  assert.equal(functionMode.prosecdef, false); assert.equal(functionMode.provolatile, 's')
  assert.deepEqual(functionMode.proconfig, ['search_path=""'])
  assert.equal((await asRole('service_role', candidateSql, candidateArgs())).rowCount, 0)
  console.log('PASS candidate function is read-only invoker code and executable only by the service role')

  const ids = Array.from({ length: 201 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
  await pool.query('INSERT INTO auth.users(id) SELECT unnest($1::uuid[])', [ids])
  await pool.query(`INSERT INTO sutra.profiles(id,email,created_at,email_preferences,subscription_status)
    SELECT id,'fixture-' || id || '@example.invalid',$2,'{"welcome":true,"tips":true,"inactivity":true}'::jsonb,'active'
    FROM unnest($1::uuid[]) AS users(id)`, [ids, windowStart])
  await pool.query(`INSERT INTO sutra.email_sequences(user_id,email_type,sent_at)
    SELECT id,'welcome',$2 FROM unnest($1::uuid[]) AS users(id)`, [ids.slice(0, 100), windowStart])
  const firstPage = await asRole('service_role', candidateSql, candidateArgs())
  assert.deepEqual(firstPage.rows.map(row => row.id), ids.slice(100, 200))
  const lastPage = await asRole('service_role', candidateSql, candidateArgs('welcome', firstPage.rows.at(-1).id))
  assert.deepEqual(lastPage.rows.map(row => row.id), ids.slice(200))
  await pool.query(`INSERT INTO sutra.email_sequences(user_id,email_type,sent_at)
    SELECT id,'welcome',$2 FROM unnest($1::uuid[]) AS users(id)`, [ids.slice(100, 179), windowStart])
  const restart = await asRole('service_role', candidateSql, candidateArgs())
  assert.deepEqual(restart.rows.map(row => row.id), ids.slice(179), 'A fresh invocation resumes beyond the newly completed prefix')
  console.log('PASS native SQL skips historical prefixes, preserves UUID page order and resumes unfinished candidates')

  const checks = [
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000001', preferences: { welcome: false } },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000002', preferences: { welcome: 'true' } },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000003', preferences: null },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000004', preferences: { welcome: true }, status: 'banned' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000005', preferences: { welcome: true }, revoked: windowStart },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000006', preferences: { welcome: true }, created: windowEnd },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000007', preferences: { welcome: true }, created: '2026-11-21T23:59:59.999Z' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-000000000008', preferences: { welcome: true }, email: 'invalid address@example.invalid' },
  ]
  for (const fixture of checks) {
    await pool.query('INSERT INTO auth.users(id) VALUES($1)', [fixture.id])
    await pool.query(`INSERT INTO sutra.profiles(id,email,created_at,email_preferences,subscription_status,access_revoked_at)
      VALUES($1,$2,$3,$4,$5,$6)`, [fixture.id, fixture.email ?? `${fixture.id}@example.invalid`, fixture.created ?? windowStart,
      fixture.preferences, fixture.status ?? 'active', fixture.revoked ?? null])
  }
  await pool.query('INSERT INTO sutra.email_sequences(user_id,email_type,sent_at) VALUES($1,\'welcome\',NULL),($2,\'welcome\',NULL)', [ids[179], checks[6].id])
  const eligible = await asRole('service_role', candidateSql, candidateArgs())
  assert.deepEqual(eligible.rows.map(row => row.id), ids.slice(180))
  const pending = await asRole('service_role', 'SELECT count(*)::int AS n FROM sutra.email_sequences WHERE sent_at IS NULL AND email_type=ANY($1::text[])', [['welcome', 'tip_day1', 'reminder_day3', 'tips_day7', 'upgrade_day14', 'testimonial_day21', 'winback_day30']])
  assert.equal(pending.rows[0].n, 2, 'Unresolved intents remain visible even outside the candidate window')
  console.log('PASS strict boolean consent, account revocation, date boundaries and durable unresolved exclusion')

  const preferenceOwner = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  await pool.query('INSERT INTO auth.users(id) VALUES($1)', [preferenceOwner])
  await pool.query(`INSERT INTO sutra.profiles(id,email,created_at,email_preferences) VALUES($1,'preferences@example.invalid',$2,'{"tips":true}')`, [preferenceOwner, windowStart])
  for (const type of ['tip_day1', 'tips_day7', 'upgrade_day14', 'testimonial_day21']) {
    const selected = await asRole('service_role', candidateSql, candidateArgs(type, 'bbbbbbbb-bbbb-4bbb-8bbb-ffffffffffff'))
    assert.deepEqual(selected.rows.map(row => row.id), [preferenceOwner])
  }
  for (const type of ['welcome', 'reminder_day3', 'winback_day30']) {
    assert.equal((await asRole('service_role', candidateSql, candidateArgs(type, 'bbbbbbbb-bbbb-4bbb-8bbb-ffffffffffff'))).rowCount, 0)
  }
  await pool.query('UPDATE sutra.profiles SET email_preferences=\'{"inactivity":true}\' WHERE id=$1', [preferenceOwner])
  for (const type of ['reminder_day3', 'winback_day30']) {
    assert.equal((await asRole('service_role', candidateSql, candidateArgs(type, 'bbbbbbbb-bbbb-4bbb-8bbb-ffffffffffff'))).rowCount, 1)
  }
  console.log('PASS all established campaign types retain their matching consent preference')

  const invalidWindows = [
    candidateArgs('unknown_campaign'), candidateArgs('welcome', null, 0), candidateArgs('welcome', null, 101),
    ['welcome', windowStart, '2026-11-24T00:00:00.000Z', null, 100],
    ['welcome', '2026-11-22T01:00:00.000Z', '2026-11-23T01:00:00.000Z', null, 100],
    ['welcome', null, windowEnd, null, 100], ['welcome', '-infinity', 'infinity', null, 100],
  ]
  for (const args of invalidWindows) await assert.rejects(asRole('service_role', candidateSql, args), /SUTRA_EMAIL_SEQUENCE_WINDOW_INVALID/)
  console.log('PASS invalid/expanded windows, unknown campaigns and unbounded page sizes refused')

  await pool.query('ALTER TABLE sutra.email_sequences DROP CONSTRAINT email_sequences_user_id_email_type_key')
  const missingFence = await pool.connect()
  try { await assert.rejects(missingFence.query(migration), /unique user_id,email_type/) }
  finally { await missingFence.query('ROLLBACK'); missingFence.release() }
  console.log('PASS missing admission constraint refused')
} finally {
  await pool.end()
  if (created) await admin.query(`DROP DATABASE ${database}`)
  if (rolesCreated) await admin.query('DROP ROLE anon,authenticated,service_role')
  await admin.end()
}
