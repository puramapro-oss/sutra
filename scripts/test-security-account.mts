import test from 'node:test'
import assert from 'node:assert/strict'
import { AuthApiError, type SupabaseClient, type UserResponse } from '@supabase/supabase-js'
import { enforceAccountAccess } from '../src/lib/account-access.ts'

function fixture() {
  let identity = { data: { user: { id: 'alice' } }, error: null } as UserResponse
  let profile: { id: string; subscription_status: string | null; access_revoked_at?: string } | null = { id: 'alice', subscription_status: 'active' }
  let error: unknown = null
  let queries = 0
  const auth = { async getUser() { assert.equal(this, auth); return identity } }
  const query = {
    select(columns: string) { assert.equal(columns, 'id, subscription_status, access_revoked_at'); return query },
    eq(column: string, id: string) { assert.equal(column, 'id'); assert.equal(id, 'alice'); return query },
    async maybeSingle() { queries++; if (error instanceof Error) throw error; return { data: profile, error } },
  }
  const raw = { auth, from(table: string) { assert.equal(table, 'profiles'); return query } }
  const client = enforceAccountAccess(raw as unknown as SupabaseClient)
  return { client, identity: () => identity, queries: () => queries,
    profile: (value: typeof profile) => { profile = value }, error: (value: unknown) => { error = value },
    anonymous: () => { identity = { data: { user: null }, error: new AuthApiError('No session', 401, 'session_not_found') } } }
}

test('verified active, free and paused users keep their Supabase identity', async () => {
  const f = fixture()
  for (const subscription_status of ['active', 'paused', 'cancelling', null]) {
    f.profile({ id: 'alice', subscription_status })
    assert.equal(await f.client.auth.getUser(), f.identity())
  }
})
test('same valid session loses access on ban and recovers only after unban', async () => {
  const f = fixture(); assert.ok((await f.client.auth.getUser()).data.user)
  f.profile({ id: 'alice', subscription_status: 'banned' })
  const banned = await f.client.auth.getUser()
  assert.equal(banned.data.user, null); assert.equal(banned.error?.status, 403)
  f.profile({ id: 'alice', subscription_status: 'active' })
  assert.ok((await f.client.auth.getUser()).data.user); assert.equal(f.queries(), 3)
})
test('missing and wrong-owner profiles cannot authorize a service-role handler', async () => {
  for (const profile of [null, { id: 'bob', subscription_status: 'active' }]) {
    const f = fixture(); f.profile(profile)
    assert.equal((await f.client.auth.getUser()).data.user, null)
  }
})
test('billing status changes cannot undo an administrative revocation', async () => {
  const f = fixture(); f.profile({ id: 'alice', subscription_status: 'active', access_revoked_at: '2026-10-12T00:00:00Z' })
  assert.equal((await f.client.auth.getUser()).data.user, null)
})
test('database errors and exceptions fail closed without leaking their message', async () => {
  for (const error of [{ message: 'synthetic-sensitive-marker' }, new Error('synthetic-sensitive-marker')]) {
    const f = fixture(); f.error(error)
    const result = await f.client.auth.getUser()
    assert.equal(result.data.user, null); assert.equal(result.error?.status, 503)
    assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-marker/)
  }
})
test('anonymous requests cannot read profiles', async () => {
  const f = fixture(); f.anonymous()
  assert.equal((await f.client.auth.getUser()).data.user, null); assert.equal(f.queries(), 0)
})
