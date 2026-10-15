// Actual route + actual Supabase query serialization + real PostgreSQL CAS.
// Session and HTTP-to-SQL bridge are fixtures, not a PostgREST service proof.
import test, { before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
const db = `sutra_ci_schedule_${process.pid}`
const config = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
let pool: pg.Pool, requests = 0
const owner = '12000000-0000-4000-8000-000000000001'
const other = '12000000-0000-4000-8000-000000000002'
const schedule = { id: 'legacy-id', name: 'CAS', is_active: true, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris', extension: { retained: true } }
const client = createClient('https://db.fixture.invalid', 'fixture-service', {
  db: { schema: 'sutra' }, auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    requests++
    const url = new URL(String(input)), headers = new Headers(init?.headers)
    assert.equal(url.pathname, '/rest/v1/sutra_auto_config'); assert.equal(init?.method, 'PATCH')
    assert.equal(headers.get('content-profile'), 'sutra')
    const userFilter = url.searchParams.get('user_id'), previous = url.searchParams.get('schedules')
    assert.ok(userFilter && userFilter.startsWith('eq.')); assert.ok(previous && previous.startsWith('eq.'))
    const expected = JSON.parse(previous.slice(3)); assert.ok(Array.isArray(expected))
    const body = JSON.parse(String(init?.body)); assert.deepEqual(Object.keys(body), ['schedules'])
    const { rows } = await pool.query('UPDATE sutra.sutra_auto_config SET schedules=$1::jsonb WHERE user_id=$2::uuid AND schedules=$3::jsonb RETURNING *', [JSON.stringify(body.schedules), userFilter.slice(3), JSON.stringify(expected)])
    return Response.json(rows, { headers: { 'content-range': rows.length ? '0-0/1' : '*/0' } })
  } },
})
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => client } })
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) } }) } })
const { PATCH } = await import('../../src/app/api/auto/config/route.ts')
const send = (next: unknown[], expected: unknown[], spoof?: string) => PATCH(new Request('https://sutra.example.test/api/auto/config', { method: 'PATCH', body: JSON.stringify({ schedules: next, expectedSchedules: expected, ...(spoof ? { user_id: spoof } : {}) }) }))
before(async () => {
  const admin = new pg.Client({ ...config, database: 'postgres' }); await admin.connect()
  try { await admin.query(`CREATE DATABASE ${db}`) } finally { await admin.end() }
  pool = new pg.Pool({ ...config, database: db, max: 12 })
  await pool.query(`CREATE SCHEMA sutra; CREATE TABLE sutra.sutra_auto_config (user_id uuid PRIMARY KEY, schedules jsonb NOT NULL DEFAULT '[]'::jsonb)`)
  await pool.query('INSERT INTO sutra.sutra_auto_config(user_id) VALUES($1),($2)', [owner, other])
})
after(async () => {
  await pool?.end(); const admin = new pg.Client({ ...config, database: 'postgres' }); await admin.connect()
  try { await admin.query(`DROP DATABASE ${db}`) } finally { await admin.end() }
})
test('12 concurrent route requests serialize the same snapshot; SQL permits one winner', async () => {
  const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => send([{ ...schedule, id: `intent-${i}` }], [])))
  assert.equal(responses.filter(r => r.status === 200).length, 1)
  assert.equal(responses.filter(r => r.status === 409).length, 11)
  assert.equal(requests, 12)
  const { rows } = await pool.query('SELECT schedules FROM sutra.sutra_auto_config WHERE user_id=$1', [owner])
  assert.equal(rows[0].schedules.length, 1)
})
test('authenticated owner survives spoof and stale snapshot cannot overwrite', async () => {
  const previous = (await pool.query('SELECT schedules FROM sutra.sutra_auto_config WHERE user_id=$1', [owner])).rows[0].schedules
  assert.equal((await send([schedule], previous, other)).status, 200)
  assert.equal((await send([], previous)).status, 409)
  assert.deepEqual((await pool.query('SELECT schedules FROM sutra.sutra_auto_config WHERE user_id=$1', [other])).rows[0].schedules, [])
})
test('JSONB comparison preserves legacy extensions despite object key order', async () => {
  const previous = { extension: { retained: true }, timezone: 'Europe/Paris', time: '10:00', days: ['MO'], frequency: 'weekly', is_active: true, name: 'CAS', id: 'legacy-id' }
  assert.equal((await send([{ ...previous, is_active: false }], [previous])).status, 200)
  const saved = (await pool.query('SELECT schedules FROM sutra.sutra_auto_config WHERE user_id=$1', [owner])).rows[0].schedules
  assert.deepEqual(saved[0].extension, { retained: true }); assert.equal(saved[0].is_active, false)
})
