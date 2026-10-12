import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const { issueSocialOAuthState, consumeSocialOAuthState } = await import('../src/lib/social-oauth-state.ts')

function oauthDatabase() {
  const rows = new Map<string, Record<string, string>>()
  let failed = false
  const client = { from: (table: string) => {
    assert.equal(table, 'social_oauth_states')
    const filters: Record<string, string> = {}
    let earliest = ''
    const builder = {
      insert: async (row: Record<string, string>) => {
        if (failed || rows.has(row.state_hash)) return { error: { message: 'db unavailable or duplicate' } }
        rows.set(row.state_hash, { ...row }); return { error: null }
      },
      delete: () => builder, select: () => builder,
      eq: (key: string, value: string) => { filters[key] = value; return builder },
      gt: (_key: string, value: string) => { earliest = value; return builder },
      maybeSingle: async () => {
        if (failed) return { data: null, error: { message: 'db unavailable' } }
        const row = rows.get(filters.state_hash)
        if (!row || row.expires_at <= earliest || Object.entries(filters).some(([key, value]) => row[key] !== value)) return { data: null, error: null }
        rows.delete(filters.state_hash); return { data: { state_hash: row.state_hash }, error: null }
      },
    }
    return builder
  } }
  return { rows, client: client as never, fail: () => { failed = true } }
}

test('OAUTH: utilisateur, plateforme et navigateur doivent correspondre sans consommer le bon etat', async () => {
  const db = oauthDatabase(), state = 'provider-state-with-unpredictable-nonce'
  const secret = await issueSocialOAuthState('userA', 'youtube', state, db.client)
  assert.match(secret, /^[a-f0-9]{64}$/)
  assert.equal(await consumeSocialOAuthState('userB', 'youtube', state, secret, db.client), false)
  assert.equal(await consumeSocialOAuthState('userA', 'instagram', state, secret, db.client), false)
  assert.equal(await consumeSocialOAuthState('userA', 'youtube', state, '0'.repeat(64), db.client), false)
  assert.equal(await consumeSocialOAuthState('userA', 'youtube', state, undefined, db.client), false)
  assert.equal(await consumeSocialOAuthState('userA', 'youtube', state, secret, db.client), true)
  assert.equal(await consumeSocialOAuthState('userA', 'youtube', state, secret, db.client), false)
})

test('OAUTH: expiration et rejeu concurrent refusés', async () => {
  const db = oauthDatabase(), state = 'provider-state-concurrent-nonce'
  const secret = await issueSocialOAuthState('userA', 'youtube', state, db.client)
  const values = await Promise.all([consumeSocialOAuthState('userA', 'youtube', state, secret, db.client), consumeSocialOAuthState('userA', 'youtube', state, secret, db.client)])
  assert.deepEqual(values.sort(), [false, true])
  const second = await issueSocialOAuthState('userA', 'youtube', state, db.client)
  for (const row of db.rows.values()) row.expires_at = '2000-01-01T00:00:00Z'
  assert.equal(await consumeSocialOAuthState('userA', 'youtube', state, second, db.client), false)
})

test('OAUTH: erreur de base bloque initiation et consommation', async () => {
  const db = oauthDatabase(), state = 'provider-state-fail-closed-nonce'
  const secret = await issueSocialOAuthState('userA', 'youtube', state, db.client)
  db.fail()
  await assert.rejects(() => consumeSocialOAuthState('userA', 'youtube', state, secret, db.client), /CONSUMPTION_FAILED/)
  await assert.rejects(() => issueSocialOAuthState('userA', 'youtube', state, db.client), /PERSISTENCE_FAILED/)
})
