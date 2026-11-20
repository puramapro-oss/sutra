import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, mock, test } from 'node:test'
import pg from 'pg'

assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
assert.match(process.env.PGDATABASE ?? '', /^sutra_ci_partner_/)
const pool = new pg.Pool({ max: 16 })
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const migration = source('migrations/20261019_partner_scan_atomic.sql')
const rollback = source('migrations/20261019_partner_scan_atomic.rollback.sql')
const partner = '10000000-0000-4000-8000-000000000001'
let failInsert = false
const record = async (code: string, ip: string, role = 'service_role') => {
  assert.ok(['service_role', 'anon', 'authenticated'].includes(role))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    const result = await client.query('SELECT sutra.record_partner_scan($1,$2,$3,$4) AS result', [code, ip, 'desktop', 'unknown'])
    await client.query('COMMIT')
    return result.rows[0].result
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: () => assert.fail('No split read/insert transport'),
  rpc: async (name: string, input: Record<string, string>) => {
    assert.equal(name, 'record_partner_scan')
    try {
      if (failInsert) throw new Error('PRIVATE_DB_DIAGNOSTIC')
      return { data: await record(input.p_code, input.p_ip_address), error: null }
    } catch (error) { return { data: null, error } }
  },
}) } })
const { GET } = await import('../../src/app/api/partner/scan/[code]/route.ts')
const request = (ip: string, code = 'ABC') => GET(new Request('https://sutra.example.test/api/partner/scan/' + code, {
  headers: { 'x-forwarded-for': ip },
}), { params: Promise.resolve({ code }) })
const count = async () => Number((await pool.query('SELECT count(*) FROM sutra.partner_scans')).rows[0].count)
before(async () => {
  await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra; CREATE TABLE auth.users(id uuid PRIMARY KEY)`)
  const canonical = source('migrations/audit_completion.sql')
  for (const table of ['partners', 'partner_scans']) {
    const start = canonical.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${table} (`)
    const end = canonical.indexOf('\n);', start)
    assert.ok(start >= 0 && end > start)
    await pool.query(canonical.slice(start, end + 3))
  }
  await pool.query(`GRANT USAGE ON SCHEMA sutra TO anon, authenticated, service_role;
    ALTER TABLE sutra.partner_scans ENABLE ROW LEVEL SECURITY;
    INSERT INTO auth.users VALUES ('${partner}');
    INSERT INTO sutra.partners(id,user_id,partner_code,slug) VALUES ('${partner}','${partner}','ABC','abc')`)
  await pool.query(migration)
})
after(async () => { await pool.end() })
beforeEach(async () => {
  failInsert = false
  await pool.query('TRUNCATE sutra.partner_scans')
  await pool.query("UPDATE sutra.partners SET status='active'")
})

test('20 concurrent real handlers at 99 scans admit exactly one, independent DB sessions', async () => {
  await pool.query(`INSERT INTO sutra.partner_scans(partner_id,ip_address)
    SELECT $1, ('10.0.0.' || n)::inet FROM generate_series(1,99) n`, [partner])
  const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => request(`192.0.2.${i + 1}`)))
  assert.equal(responses.filter(r => r.status === 302).length, 1)
  assert.equal(responses.filter(r => r.status === 429).length, 19)
  assert.equal(await count(), 100)
  assert.ok(responses.filter(r => r.status === 429).every(r => !r.headers.get('set-cookie')))
})
test('20 concurrent same-IP requests record only once and keep idempotent redirect', async () => {
  const responses = await Promise.all(Array.from({ length: 20 }, () => request('192.0.2.1')))
  assert.ok(responses.every(r => r.status === 302)); assert.equal(await count(), 1)
})
test('expired history does not consume rolling quota and is preserved', async () => {
  await pool.query(`INSERT INTO sutra.partner_scans(partner_id,ip_address,scanned_at)
    SELECT $1,'192.0.2.1',clock_timestamp()-interval '25 hours' FROM generate_series(1,100)`, [partner])
  assert.equal((await request('192.0.2.1')).status, 302); assert.equal(await count(), 101)
})
test('inactive and unknown partners do not record or set attribution cookie', async () => {
  await pool.query("UPDATE sutra.partners SET status='suspended'")
  for (const code of ['ABC', 'UNKNOWN']) {
    const response = await request('192.0.2.1', code)
    assert.equal(response.status, 404); assert.equal(response.headers.get('set-cookie'), null)
  }
  assert.equal(await count(), 0)
})
for (const role of ['anon', 'authenticated']) test(`${role} cannot execute service-only RPC`, async () => {
  await assert.rejects(record('ABC', '192.0.2.1', role), { code: '42501' }); assert.equal(await count(), 0)
})
test('malformed address and network prefix fail closed, no DB diagnostic or cookie', async () => {
  for (const ip of ['not-an-ip', '192.0.2.0/24']) {
    const response = await request(ip)
    assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null)
    assert.doesNotMatch(await response.text(), /inet|postgres|record_partner_scan/i)
  }
  assert.equal(await count(), 0)
})
test('read-only transaction and missing RPC both fail closed', async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await assert.rejects(client.query("SELECT sutra.record_partner_scan('ABC','192.0.2.1','desktop','unknown')"), { code: '25006' })
  } finally { await client.query('ROLLBACK'); client.release() }
  await pool.query(rollback)
  assert.equal((await request('192.0.2.1')).status, 503)
  await pool.query(migration)
  assert.equal(await count(), 0)
})
test('non-default snapshot isolation explicitly rejects instead of accepting stale quota', async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    await assert.rejects(client.query("SELECT sutra.record_partner_scan('ABC','192.0.2.1','desktop','unknown')"), { code: '25001' })
  } finally { await client.query('ROLLBACK'); client.release() }
  assert.equal(await count(), 0)
})
test('apply replay and rollback preserve historical rows, RLS and least privileges', async () => {
  await request('192.0.2.1')
  const beforeRows = (await pool.query('SELECT * FROM sutra.partner_scans ORDER BY id')).rows
  await pool.query(migration)
  assert.equal((await pool.query("SELECT relrowsecurity FROM pg_class WHERE oid='sutra.partner_scans'::regclass")).rows[0].relrowsecurity, true)
  const permissions = (await pool.query(`SELECT p.prosecdef, p.proconfig,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated,
    has_function_privilege('service_role',p.oid,'EXECUTE') AS service
    FROM pg_proc p WHERE p.oid='sutra.record_partner_scan(text,text,text,text)'::regprocedure`)).rows[0]
  assert.equal(permissions.prosecdef, false); assert.equal(permissions.anon, false)
  assert.equal(permissions.authenticated, false); assert.equal(permissions.service, true)
  assert.ok(permissions.proconfig.some((x: string) => x.startsWith('search_path=')))
  await pool.query(rollback)
  assert.deepEqual((await pool.query('SELECT * FROM sutra.partner_scans ORDER BY id')).rows, beforeRows)
  await pool.query(migration)
  assert.equal(await record('ABC', '192.0.2.1'), 'duplicate')
})
