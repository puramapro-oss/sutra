import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmailPreferences, saveEmailPreferences } from '../src/lib/email-preferences.ts'

const owner = '11111111-1111-4111-8111-111111111111'
const preferences = { welcome: false, digest: true, inactivity: false, tips: true, contest: false, referral: true }
type Client = Parameters<typeof saveEmailPreferences>[0]
function fixture(options: { receipt?: unknown; error?: unknown; users?: Array<string | null>; authErrors?: unknown[]; onAuth?: () => void } = {}) {
  const writes: unknown[] = []; const filters: unknown[] = []
  const users = options.users ?? [owner, owner]
  let authIndex = 0
  const client = {
    auth: { getUser: async () => {
      options.onAuth?.()
      const index = authIndex++, id = users[index] ?? null
      return { data: { user: id ? { id } : null }, error: options.authErrors?.[index] ?? null }
    } },
    from: (table: string) => {
      assert.equal(table, 'profiles')
      const query = {
        update: (value: unknown) => { writes.push(value); return query },
        eq: (key: string, value: string) => { filters.push([key, value]); return query },
        select: () => query, abortSignal: () => query,
        single: async () => ({ data: 'receipt' in options ? options.receipt : { id: owner, email_preferences: preferences }, error: options.error ?? null }),
      }
      return query
    },
  } as unknown as Client
  return { client, writes, filters }
}

test('preferences recognize explicit booleans only and never invent an opt-in', () => {
  assert.deepEqual(normalizeEmailPreferences(null), { welcome: false, digest: false, inactivity: false, tips: false, contest: false, referral: false })
  assert.deepEqual(normalizeEmailPreferences({ ...preferences, tips: 'true', unsafe: true }), { ...preferences, tips: false })
})

test('save verifies the current identity and returned preferences for the exact owner', async () => {
  const f = fixture()
  assert.equal(await saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), true)
  assert.deepEqual(f.writes, [{ email_preferences: preferences }]); assert.deepEqual(f.filters, [['id', owner]])
})

for (const [description, receipt] of [
  ['missing row', null], ['different owner', { id: 'other', email_preferences: preferences }],
  ['missing preferences', { id: owner }], ['missing preference key', { id: owner, email_preferences: { welcome: false } }],
  ['different preferences', { id: owner, email_preferences: { ...preferences, tips: false } }],
] as const) {
  test(`${description} cannot become a successful preferences save`, async () => {
    const f = fixture({ receipt })
    await assert.rejects(saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), /UNCONFIRMED/)
  })
}

test('database errors stay failures even if a stale row accompanies them', async () => {
  const f = fixture({ error: { message: 'synthetic private data' } })
  await assert.rejects(saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), /UNCONFIRMED/)
})

for (const user of [null, 'other']) {
  test(`identity ${user ?? 'absent'} cannot write another account`, async () => {
    const f = fixture({ users: [user] })
    await assert.rejects(saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), /SESSION_CHANGED/)
    assert.equal(f.writes.length, 0)
  })
}

test('a response from the former account is not accepted after a switch', async () => {
  const f = fixture({ users: [owner, 'other'] })
  assert.equal(await saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), false)
})

test('a failed identity recheck after writing is an explicit unconfirmed save', async () => {
  const f = fixture({ authErrors: [null, { message: 'Synthetic auth outage' }] })
  await assert.rejects(saveEmailPreferences(f.client, owner, preferences, new AbortController().signal), /SESSION_UNVERIFIED/)
  assert.equal(f.writes.length, 1)
})

test('aborting before or during identity verification prevents all writes', async () => {
  const first = new AbortController(); first.abort()
  const a = fixture()
  await assert.rejects(saveEmailPreferences(a.client, owner, preferences, first.signal), { name: 'AbortError' })
  assert.equal(a.writes.length, 0)
  const second = new AbortController(), b = fixture({ onAuth: () => second.abort() })
  await assert.rejects(saveEmailPreferences(b.client, owner, preferences, second.signal), { name: 'AbortError' })
  assert.equal(b.writes.length, 0)
})
