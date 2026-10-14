import test, { before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readSocialOAuthAccount, updateSocialOAuthAccount } from '../../src/lib/social-oauth-account.ts'
import { revokeSocialAccount } from '../../src/lib/social-account-revocation.ts'
import { issueSocialOAuthState } from '../../src/lib/social-oauth-state.ts'

const port = Number(process.env.PGPORT)
if (process.env.SUTRA_DISPOSABLE_DB !== '1' || process.env.PGHOST !== '127.0.0.1' || !Number.isInteger(port) || port < 1) {
  throw new Error('Explicit disposable loopback PostgreSQL required')
}
pg.types.setTypeParser(1184, value => new Date(value).toISOString())
const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'fixture', database: 'postgres', max: 24, statement_timeout: 10_000 })
type Row = Record<string, unknown>
const quote = (name: string) => {
  assert.match(name, /^[a-z_]+$/)
  return `"${name}"`
}

// Executes the real helper's filters as parameterized SQL on PostgreSQL.
// This verifies SQL/CAS semantics, not the PostgREST HTTP implementation.
const service = { schema: (schema: string) => { assert.equal(schema, 'public'); return service }, from: (table: string) => {
  assert.equal(table, 'social_accounts')
  let columns = '*', mutation: Row | undefined
  const predicates: Array<[string, unknown, boolean]> = []
  const query = {
    select: (value: string) => { columns = value; return query },
    eq: (key: string, value: unknown) => { predicates.push([key, value, false]); return query },
    is: (key: string, value: unknown) => { assert.equal(value, null); predicates.push([key, null, true]); return query },
    update: (value: Row) => { mutation = value; return query },
    maybeSingle: async () => {
      const values: unknown[] = []
      const parameter = (value: unknown) => { values.push(value); return `$${values.length}` }
      const fields = columns === '*' ? '*' : columns.split(',').map(quote).join(',')
      const head = mutation
        ? `UPDATE public.social_accounts SET ${Object.entries(mutation).map(([key, value]) => `${quote(key)}=${parameter(value)}`).join(',')}`
        : `SELECT ${fields} FROM public.social_accounts`
      const where = predicates.map(([key, value, isNull]) => `${quote(key)}${isNull ? ' IS NULL' : '=' + parameter(value)}`).join(' AND ')
      const result = await pool.query(`${head} WHERE ${where || 'TRUE'}${mutation ? ` RETURNING ${fields}` : ''}`, values)
      assert.ok(result.rows.length <= 1)
      return { data: result.rows[0] ?? null, error: null }
    },
  }
  return query
} }
const client = service as unknown as Parameters<typeof readSocialOAuthAccount>[2]
const id = '11111111-1111-4111-8111-111111111111'
const user = '22222222-2222-4222-8222-222222222222'
const snapshot = () => readSocialOAuthAccount(user, 'youtube', client)

before(async () => {
  await pool.query(`CREATE TABLE public.social_accounts (
    id uuid PRIMARY KEY, user_id uuid NOT NULL, platform text NOT NULL,
    external_id text, status text NOT NULL, updated_at timestamptz, metadata jsonb,
    UNIQUE(user_id, platform))`)
})
beforeEach(async () => {
  await pool.query('TRUNCATE public.social_accounts')
  await pool.query('INSERT INTO public.social_accounts(id,user_id,platform,external_id,status) VALUES($1,$2,$3,$4,$5)',
    [id, user, 'youtube', 'a'.repeat(24), 'connected'])
})
after(async () => { await pool.end() })

test('PG T06: 24 concurrent CAS on a legacy nullable row produce exactly one winner', async () => {
  const account = (await snapshot())!
  assert.equal(account.updated_at, null); assert.equal(account.metadata, null)
  const results = await Promise.all(Array.from({ length: 24 }, (_, index) => updateSocialOAuthAccount(user, account,
    { status: 'revoked', metadata: { sutra_oauth_revision: String(index) } }, client)))
  assert.equal(results.filter(result => result.data).length, 1)
  assert.equal((await snapshot())!.status, 'revoked')
})

test('PG T06: JSONB equality accepts reordered keys but refuses a changed revision with the same clock', async () => {
  await pool.query('UPDATE public.social_accounts SET updated_at=$1, metadata=$2', ['2026-10-14T00:00:00Z', { z: 2, a: 1, sutra_oauth_revision: 'before' }])
  const account = (await snapshot())!
  account.metadata = { z: 2, sutra_oauth_revision: 'before', a: 1 }
  const changed = await updateSocialOAuthAccount(user, account, { metadata: { a: 1, z: 2, sutra_oauth_revision: 'after' } }, client)
  assert.ok(changed.data)
  const stale = await updateSocialOAuthAccount(user, account, { external_id: 'b'.repeat(24) }, client)
  assert.equal(stale.data, null)
  assert.equal((await snapshot())!.external_id, 'a'.repeat(24))
})

test('PG T06: stale callback snapshot cannot reactivate a confirmed revoked account', async () => {
  const account = (await snapshot())!
  assert.equal((await revokeSocialAccount(user, id, client, async () => true)).success, true)
  const stale = await updateSocialOAuthAccount(user, account, { status: 'connected' }, client)
  assert.equal(stale.data, null)
  assert.equal((await snapshot())!.status, 'revoked')
})

test('PG T06: one in-flight revoke fences 23 concurrent retries and only one remote DELETE', async () => {
  let release!: () => void, reached!: () => void, calls = 0
  const hold = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { reached = resolve })
  const disconnect = async () => { calls++; reached(); await hold; return true }
  const first = revokeSocialAccount(user, id, client, disconnect)
  await started
  try {
    const retries = await Promise.all(Array.from({ length: 23 }, () => revokeSocialAccount(user, id, client, disconnect)))
    assert.ok(retries.every(result => !result.success && result.remoteStatus === 'unconfirmed'))
    assert.equal(calls, 1)
  } finally { release(); await first }
  assert.equal((await snapshot())!.metadata!.sutra_revocation_pending, false)
})

test('PG T06: unknown DELETE retains durable fence and refuses a new OAuth state', async () => {
  assert.equal((await revokeSocialAccount(user, id, client, async () => false)).remoteStatus, 'unconfirmed')
  assert.equal((await snapshot())!.metadata!.sutra_revocation_pending, true)
  await assert.rejects(() => issueSocialOAuthState(user, 'youtube', 'fixture-state-with-enough-length',
    { profileId: 'a'.repeat(24), sessionId: id }, client), /SUTRA_SOCIAL_REVOCATION_PENDING/)
  let called = false
  await revokeSocialAccount(user, id, client, async () => { called = true; return true })
  assert.equal(called, false)
})

test('PG T06: first connection uniqueness gives one winner across 24 SQL sessions', async () => {
  await pool.query('TRUNCATE public.social_accounts')
  const results = await Promise.allSettled(Array.from({ length: 24 }, () => pool.query(
    'INSERT INTO public.social_accounts(id,user_id,platform,status) VALUES(gen_random_uuid(),$1,$2,$3)', [user, 'youtube', 'connected'])))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const failures = results.filter(result => result.status === 'rejected')
  assert.ok(failures.every(result => result.reason.code === '23505'))
})

test('PG T06: another owner or a changed external account cannot pass CAS', async () => {
  const account = (await snapshot())!
  assert.equal((await updateSocialOAuthAccount(id, account, { status: 'revoked' }, client)).data, null)
  await pool.query('UPDATE public.social_accounts SET external_id=$1', ['b'.repeat(24)])
  assert.equal((await updateSocialOAuthAccount(user, account, { status: 'revoked' }, client)).data, null)
  assert.equal((await snapshot())!.status, 'connected')
})
