import test, { after, afterEach, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

// Real candidate routes, helpers, SQL constraints and triggers. Only auth,
// cookie storage, Supabase transport and the provider transport are simulated.
// This is not a PostgREST, browser, provider or production acceptance test.
const port = Number(process.env.PGPORT)
if (process.env.SUTRA_DISPOSABLE_DB !== '1' || process.env.PGHOST !== '127.0.0.1' || !Number.isInteger(port) || port < 1) {
  throw new Error('Explicit disposable loopback PostgreSQL required')
}
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', NEXT_PUBLIC_APP_SCHEMA: 'sutra',
  NEXT_PUBLIC_APP_URL: 'https://sutra-test.invalid', NEXT_PUBLIC_SITE_URL: 'https://sutra-test.invalid',
  ZERNIO_API_KEY: 'fixture-zernio', ZERNIO_BASE_URL: 'https://zernio-test.invalid/api/v1',
})
// Preserve PostgreSQL microseconds; truncating timestamps would invalidate CAS.
pg.types.setTypeParser(1184, value => value)
const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'fixture', database: 'postgres', max: 24, statement_timeout: 10_000 })
type Row = Record<string, unknown>
const alice = '11111111-1111-4111-8111-111111111111', bob = '44444444-4444-4444-8444-444444444444'
const session = '22222222-2222-4222-8222-222222222222', profile = 'a'.repeat(24), externalId = 'b'.repeat(24)
let userId: string | null = alice, sessionId = session
let remoteAccounts: Row[] = [], deleteStatus = 200, wireViolations: string[] = []
let onDelete: () => Promise<void> = async () => {}, onConfirmation: () => Promise<void> = async () => {}
let calls: Array<{ url: URL; method: string }> = []
const browser = new Map<string, string>()
const databaseErrors: string[] = []
const quote = (key: string) => { assert.match(key, /^[a-z_]+$/); return `"${key}"` }

// Implement the small Supabase query surface used by the actual routes with
// parameterized SQL, service-role privilege checks and real atomic CAS/DELETE.
const database = {
  schema(name: string) { assert.equal(name, 'public'); return database },
  from(table: string) {
    assert.ok(['social_accounts', 'social_oauth_states'].includes(table))
    const qualified = `${table === 'social_accounts' ? 'public' : 'sutra'}.${quote(table)}`
    let columns = '*', operation = 'select', mutation: Row = {}
    const filters: Array<[string, string, unknown]> = []
    async function execute(single: boolean) {
      const values: unknown[] = []
      const param = (value: unknown) => { values.push(value); return `$${values.length}` }
      const fields = columns === '*' ? '*' : columns.split(',').map(value => quote(value.trim())).join(',')
      const where = filters.map(([key, operator, value]) => `${quote(key)} ${operator} ${operator === 'IS' ? 'NULL' : param(value)}`).join(' AND ') || 'TRUE'
      let sql = `SELECT ${fields} FROM ${qualified} WHERE ${where}`
      if (operation === 'insert') sql = `INSERT INTO ${qualified} (${Object.keys(mutation).map(quote).join(',')}) VALUES (${Object.values(mutation).map(param).join(',')}) RETURNING ${fields}`
      if (operation === 'update') sql = `UPDATE ${qualified} SET ${Object.entries(mutation).map(([key, value]) => `${quote(key)}=${param(value)}`).join(',')} WHERE ${where} RETURNING ${fields}`
      if (operation === 'delete') sql = `DELETE FROM ${qualified} WHERE ${where} RETURNING ${fields}`
      if (operation === 'update' && (mutation.metadata as Row | undefined)?.sutra_revocation_pending === false) await onConfirmation()
      const client = await pool.connect()
      try {
        await client.query('BEGIN'); await client.query('SET LOCAL ROLE service_role')
        const result = await client.query(sql, values)
        if (single) assert.ok(result.rows.length <= 1)
        await client.query('COMMIT')
        return { data: single ? result.rows[0] ?? null : result.rows, error: null }
      } catch (error) {
        await client.query('ROLLBACK')
        if (error instanceof assert.AssertionError) throw error
        const failure = error as { code?: string; message?: string }
        // Only fixed SQL sentinel names, never query text or row contents.
        const sentinel = failure.message?.match(/(?:SUTRA|FIXTURE)_[A-Z_]+/)?.[0]
        databaseErrors.push(sentinel || failure.code || 'DB_ERROR')
        return { data: null, error: { code: failure.code } }
      } finally { client.release() }
    }
    const query = {
      select(value: string) { columns = value; return query },
      eq(key: string, value: unknown) { filters.push([key, '=', value]); return query },
      is(key: string, value: unknown) { assert.equal(value, null); filters.push([key, 'IS', value]); return query },
      gt(key: string, value: unknown) { filters.push([key, '>', value]); return query },
      insert(value: Row) { operation = 'insert'; mutation = value; return query },
      update(value: Row) { operation = 'update'; mutation = value; return query },
      delete() { operation = 'delete'; return query },
      maybeSingle() { return execute(true) },
      then(resolve: (result: Awaited<ReturnType<typeof execute>>) => unknown, reject: (reason: unknown) => unknown) { return execute(false).then(resolve, reject) },
    }
    return query
  },
}
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
  getClaims: async () => ({ data: { claims: { sub: userId, session_id: sessionId } }, error: null }),
} }) } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => database } })
mock.module('@supabase/supabase-js', { namedExports: { createClient: () => database } })
mock.module(createRequire(import.meta.url).resolve('@supabase/supabase-js'), { namedExports: { createClient: () => database } })
mock.module('../../src/lib/rate-limit.ts', { namedExports: { enforceRateLimit: () => null } })
mock.module('next/headers', { namedExports: { cookies: async () => ({
  get: (name: string) => browser.has(name) ? { value: browser.get(name) } : undefined,
  set: (name: string, value: string) => { browser.set(name, value) },
}) } })
globalThis.fetch = async () => { throw new Error('T06_UNEXPECTED_NETWORK') }
const { POST: connect } = await import('../../src/app/api/social/connect/route.ts')
const { GET: callback } = await import('../../src/app/api/social/callback/route.ts')
const { DELETE: revoke } = await import('../../src/app/api/social/accounts/route.ts')

before(async () => {
  const social = await readFile(new URL('../../sql/social-autopilot.sql', import.meta.url), 'utf8')
  const definition = social.match(/CREATE TABLE IF NOT EXISTS social_accounts \([\s\S]*?\n\);/)?.[0]
  const updatedTrigger = social.match(/CREATE OR REPLACE FUNCTION update_social_updated_at\(\)[\s\S]*?EXECUTE FUNCTION update_social_updated_at\(\);/)?.[0]
  assert.ok(definition); assert.ok(updatedTrigger)
  await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,sutra TO anon,authenticated,service_role;
    CREATE TABLE sutra.profiles(id uuid PRIMARY KEY,subscription_status text,access_revoked_at timestamptz);
    CREATE FUNCTION sutra.account_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
      $$SELECT EXISTS(SELECT 1 FROM sutra.profiles WHERE id=auth.uid() AND access_revoked_at IS NULL
        AND subscription_status IS DISTINCT FROM 'banned')$$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}'); INSERT INTO sutra.profiles VALUES('${alice}','active',NULL),('${bob}','active',NULL);
    SET search_path=public; ${definition} ${updatedTrigger}
    COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';
    GRANT ALL ON public.social_accounts TO service_role; ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;`)
  await pool.query(await readFile(new URL('../../migrations/20261011_social_oauth_state.sql', import.meta.url), 'utf8'))
  const historyMigration = process.env.SUTRA_TEST_SOCIAL_HISTORY_FIXTURE === 't01'
    ? './t01-social-history.sql' : '../../migrations/20261015_social_authorization_history.sql'
  await pool.query(await readFile(new URL(historyMigration, import.meta.url), 'utf8'))
})
beforeEach(async () => {
  await pool.query('TRUNCATE public.social_accounts, sutra.social_oauth_states')
  userId = alice; sessionId = session; remoteAccounts = []; deleteStatus = 200; wireViolations = []; calls = []; browser.clear(); databaseErrors.length = 0
  onDelete = async () => {}; onConfirmation = async () => {}
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: profile, [bob]: 'c'.repeat(24) })
  globalThis.fetch = async (input, init) => {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
      assert.equal(url.origin, 'https://zernio-test.invalid'); assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-zernio')
      const method = init?.method ?? 'GET'; calls.push({ url, method })
      if (method === 'GET' && url.pathname.startsWith('/api/v1/connect/')) {
        assert.equal(url.searchParams.get('profileId'), profile); assert.equal(url.searchParams.get('scopes'), 'posting')
        assert.equal(init?.redirect, 'error'); assert.ok(init?.signal)
        return Response.json({ authUrl: 'https://consent.invalid/hosted', state: 'provider-state-must-not-replace-local-state' })
      }
      if (method === 'GET' && url.pathname === '/api/v1/accounts') return Response.json({ accounts: remoteAccounts })
      if (method === 'DELETE' && url.pathname.startsWith('/api/v1/accounts/')) {
        assert.equal((await account()).status, 'revoked', 'Local fence must be committed before provider DELETE')
        await onDelete()
        return Response.json({}, { status: deleteStatus })
      }
      assert.fail('Unplanned synthetic provider request')
    } catch (error) { if (error instanceof assert.AssertionError) wireViolations.push(error.message); throw error }
  }
})
afterEach(() => { assert.deepEqual(wireViolations, [], 'No swallowed transport assertion') })
after(async () => { await pool.end() })
const account = async () => (await pool.query('SELECT * FROM public.social_accounts WHERE user_id=$1', [alice])).rows[0]
const events = async (id: string) => (await pool.query('SELECT * FROM sutra.social_authorization_history WHERE account_id=$1 ORDER BY recorded_at,id', [id])).rows
const deleteCalls = () => calls.filter(call => call.method === 'DELETE').length
async function begin() {
  const response = await connect(new Request('https://sutra-test.invalid/api/social/connect', { method: 'POST', body: JSON.stringify({ platform: 'youtube' }) }))
  if (response.status !== 200) return { response, url: new URL('https://sutra-test.invalid/unused') }
  const body = await response.json() as { state: string }
  assert.match(body.state, /^[a-f0-9]{64}$/); assert.equal(response.headers.get('cache-control'), 'no-store')
  const cookie = response.headers.get('set-cookie')!
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/api/social', 'Max-Age=600']) assert.ok(cookie.includes(attribute))
  const [name, value] = cookie.split(';')[0].split('='); browser.set(name, value)
  const url = new URL(calls.at(-1)!.url.searchParams.get('redirect_url')!)
  assert.equal(url.searchParams.get('state'), body.state)
  url.searchParams.set('connected', 'youtube'); url.searchParams.set('profileId', profile); url.searchParams.set('accountId', externalId)
  remoteAccounts = [{ _id: externalId, platform: 'youtube', profileId: { _id: profile }, isActive: true, username: 'fixture', accessToken: 'fixture-must-not-store', refreshToken: 'fixture-must-not-store' }]
  return { response, url }
}
async function consent() {
  const started = await begin(); assert.equal(started.response.status, 200)
  const response = await callback(new Request(started.url))
  assert.equal(response.headers.get('location'), 'https://sutra-test.invalid/settings/social?connected=youtube', databaseErrors.join(','))
  return account()
}
const revokeRequest = (id: string) => new Request('https://sutra-test.invalid/api/social/accounts', { method: 'DELETE', body: JSON.stringify({ accountId: id }) })

test('PG routes: connection, revocation and reconnection retain consent history and clear credentials', async () => {
  const first = await consent(), revision = first.metadata.sutra_oauth_revision
  assert.equal(first.access_token, null); assert.equal(first.refresh_token, null)
  assert.equal((await revoke(revokeRequest(first.id))).status, 200, databaseErrors.join(','))
  assert.equal((await revoke(revokeRequest(first.id))).status, 200)
  await consent()
  const history = await events(first.id)
  assert.deepEqual(history.map(row => row.event_type), ['connection', 'revocation_requested', 'revocation_confirmed', 'reconnection'])
  assert.equal(history[0].revision_id, revision); assert.equal(deleteCalls(), 1)
  assert.deepEqual(history[0].requested_scopes, ['posting']); assert.equal(history[0].granted_scopes, null)
  assert.doesNotMatch(JSON.stringify(history), /fixture-must-not-store|access_token|refresh_token|session_id|state_hash/)
})
test('PG routes: unknown remote deletion preserves fence; repeat cannot delete or reconnect', async () => {
  const first = await consent(); deleteStatus = 500
  assert.equal((await revoke(revokeRequest(first.id))).status, 202)
  assert.equal((await revoke(revokeRequest(first.id))).status, 202)
  assert.equal((await begin()).response.status, 409); assert.equal(deleteCalls(), 1)
  assert.deepEqual((await events(first.id)).map(row => row.event_type), ['connection', 'revocation_requested'])
  assert.equal((await account()).metadata.sutra_revocation_pending, true)
})
test('PG routes: one state can produce only one successful callback under concurrency', async () => {
  const started = await begin()
  const responses = await Promise.all(Array.from({ length: 12 }, () => callback(new Request(started.url))))
  assert.equal(responses.filter(response => response.headers.get('location')?.endsWith('?connected=youtube')).length, 1)
  assert.equal((await events((await account()).id)).length, 1)
  assert.equal(Number((await pool.query('SELECT count(*) FROM sutra.social_oauth_states')).rows[0].count), 0)
})
test('PG routes: state refuses another session, another user, profile change and expiry', async () => {
  const started = await begin()
  sessionId = '55555555-5555-4555-8555-555555555555'
  assert.match((await callback(new Request(started.url))).headers.get('location')!, /error=/)
  sessionId = session; userId = bob
  assert.match((await callback(new Request(started.url))).headers.get('location')!, /error=/)
  userId = alice; process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: 'c'.repeat(24) })
  assert.match((await callback(new Request(started.url))).headers.get('location')!, /error=/)
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [alice]: profile })
  await pool.query("UPDATE sutra.social_oauth_states SET created_at=now()-interval '20 minutes', expires_at=now()-interval '10 minutes'")
  assert.match((await callback(new Request(started.url))).headers.get('location')!, /error=/)
  assert.equal(await account(), undefined); assert.equal(calls.filter(call => call.url.pathname === '/api/v1/accounts').length, 0)
})
test('PG routes: audit write failure rolls back account; callback state remains consumed', async () => {
  const started = await begin()
  await pool.query("CREATE FUNCTION sutra.fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'FIXTURE_AUDIT_UNAVAILABLE'; END$$; CREATE TRIGGER fixture_fail_audit BEFORE INSERT ON sutra.social_authorization_history FOR EACH ROW EXECUTE FUNCTION sutra.fixture_fail_audit()")
  try {
    assert.match((await callback(new Request(started.url))).headers.get('location')!, /error=db_error/)
    assert.equal(await account(), undefined); assert.ok(databaseErrors.includes('FIXTURE_AUDIT_UNAVAILABLE'))
    assert.equal(Number((await pool.query('SELECT count(*) FROM sutra.social_oauth_states')).rows[0].count), 0)
  } finally { await pool.query('DROP TRIGGER fixture_fail_audit ON sutra.social_authorization_history; DROP FUNCTION sutra.fixture_fail_audit()') }
})
test('PG routes: concurrent pending cleanup retains one DELETE and confirms the original operation', async () => {
  const first = await consent()
  onDelete = async () => {
    const retries = await Promise.all(Array.from({ length: 12 }, () => revoke(revokeRequest(first.id))))
    assert.ok(retries.every(response => [202, 503].includes(response.status)))
    assert.equal(deleteCalls(), 1)
  }
  assert.equal((await revoke(revokeRequest(first.id))).status, 200)
  assert.equal((await account()).metadata.sutra_revocation_pending, false)
  assert.deepEqual((await events(first.id)).map(row => row.event_type), ['connection', 'revocation_requested', 'revocation_confirmed'])
})
for (const phase of ['before-reload', 'after-reload'] as const) test(`PG routes: concurrent account change ${phase} prevents false revocation confirmation`, async () => {
  const first = await consent()
  const change = async () => { await pool.query("UPDATE public.social_accounts SET status='error' WHERE id=$1", [first.id]) }
  if (phase === 'before-reload') onDelete = change
  else onConfirmation = change
  assert.equal((await revoke(revokeRequest(first.id))).status, 503)
  assert.equal((await account()).status, 'error'); assert.equal((await account()).metadata.sutra_revocation_pending, true)
  assert.equal(deleteCalls(), 1)
  assert.deepEqual((await events(first.id)).map(row => row.event_type), ['connection', 'revocation_requested'])
})
test('PG routes: legacy scoped account without revision must still revoke locally', async () => {
  await pool.query('INSERT INTO public.social_accounts(user_id,platform,external_id,status,metadata,access_token,refresh_token) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [alice, 'youtube', externalId, 'connected', { credential_owner: 'zernio', zernio_profile_id: profile }, 'fixture-access', 'fixture-refresh'])
  const first = await account()
  const response = await revoke(revokeRequest(first.id))
  assert.ok(response.status === 200 || response.status === 202, `Local revoke refused: status=${response.status}; ${databaseErrors.join(',')}`)
  const current = await account()
  assert.equal(current.status, 'revoked'); assert.equal(current.access_token, null); assert.equal(current.refresh_token, null)
})
