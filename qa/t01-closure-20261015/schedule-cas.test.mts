import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'

const alice = '12000000-0000-4000-8000-000000000001'
const bob = '12000000-0000-4000-8000-000000000002'
const schedule = { id: 'planning-1', name: 'Recette', is_active: true, frequency: 'weekly', days: ['MO'], time: '10:00', timezone: 'Europe/Paris' }
let identity: string | null = alice, fail = '', writes = 0, privileged = 0
let rows: Map<string, Record<string, unknown>>
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({
  auth: { getUser: async () => ({ data: { user: identity ? { id: identity } : null }, error: null }) },
}) } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  privileged++
  return { from: (table: string) => {
    assert.equal(table, 'sutra_auto_config')
    let update: Record<string, unknown> = {}, owner: string | undefined, expected: unknown, mode = ''
    const result = async () => {
      if (fail === 'throw') throw new Error('PRIVATE_SYNTHETIC_DIAGNOSTIC')
      if (fail === 'error') return { data: null, error: { message: 'PRIVATE_SYNTHETIC_DIAGNOSTIC' } }
      if (mode === 'upsert') {
        const id = String(update.user_id); rows.set(id, { ...rows.get(id), ...update }); writes++
        return { data: rows.get(id), error: null }
      }
      const row = owner ? rows.get(owner) : null
      assert.equal(mode, 'update'); assert.ok(owner); assert.notEqual(expected, undefined)
      if (!row || !isDeepStrictEqual(row.schedules, expected)) return { data: null, error: null }
      rows.set(owner, { ...row, ...update }); writes++
      if (fail === 'ack') throw new Error('PRIVATE_SYNTHETIC_DIAGNOSTIC')
      return { data: rows.get(owner), error: null }
    }
    const query = {
      update: (value: Record<string, unknown>) => { update = value; mode = 'update'; return query },
      upsert: (value: Record<string, unknown>) => { update = value; mode = 'upsert'; return query },
      eq: (key: string, value: unknown) => {
        if (key === 'user_id') owner = String(value)
        else { assert.equal(key, 'schedules'); assert.equal(typeof value, 'string'); expected = JSON.parse(String(value)) }
        return query
      },
      select: () => query, single: result, maybeSingle: result,
    }; return query
  } }
} } })
const { PATCH } = await import('../../src/app/api/auto/config/route.ts')
const send = (body: unknown) => PATCH(new Request('https://sutra.example.test/api/auto/config', { method: 'PATCH', body: JSON.stringify(body) }))
beforeEach(() => { identity = alice; fail = ''; writes = privileged = 0; rows = new Map([[alice, { user_id: alice, schedules: [], is_active: false }], [bob, { user_id: bob, schedules: [], is_active: false }]]) })
test('schedule replacement requires explicit precondition before privileged query', async () => {
  assert.equal((await send({ schedules: [schedule] })).status, 428); assert.equal(privileged, 0); assert.equal(writes, 0)
})
test('two concurrent intents on one snapshot have exactly one winner', async () => {
  const responses = await Promise.all([send({ schedules: [schedule], expectedSchedules: [] }), send({ schedules: [{ ...schedule, id: 'second' }], expectedSchedules: [] })])
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]); assert.equal(writes, 1)
  assert.deepEqual(rows.get(alice)?.schedules, [schedule])
})
test('authenticated owner filter cannot replace another user schedules', async () => {
  assert.equal((await send({ user_id: bob, schedules: [schedule], expectedSchedules: [] })).status, 200)
  assert.deepEqual(rows.get(bob)?.schedules, []); assert.equal(rows.get(alice)?.user_id, alice)
})
test('missing row is conflict, never lazy upsert or overwrite', async () => {
  rows.delete(alice)
  assert.equal((await send({ schedules: [schedule], expectedSchedules: [] })).status, 409); assert.equal(writes, 0)
})
test('lost acknowledgment leaves saved schedules intact and retry cannot duplicate', async () => {
  fail = 'ack'; const response = await send({ schedules: [schedule], expectedSchedules: [] })
  assert.equal(response.status, 500); assert.equal((await response.text()).includes('PRIVATE_'), false)
  fail = ''; assert.equal((await send({ schedules: [schedule], expectedSchedules: [] })).status, 409); assert.equal(writes, 1)
})
test('unrelated settings retain schedules and their existing contract', async () => {
  rows.set(alice, { user_id: alice, schedules: [schedule], is_active: false })
  assert.equal((await send({ is_active: true })).status, 200); assert.deepEqual(rows.get(alice)?.schedules, [schedule])
})
test('historical extension fields and textual identities survive valid edit', async () => {
  const legacy = { ...schedule, extension: { retained: true }, theme_ids: ['theme-1'] }
  rows.set(alice, { user_id: alice, schedules: [legacy] })
  const next = { ...legacy, is_active: false }
  assert.equal((await send({ schedules: [next], expectedSchedules: [legacy] })).status, 200)
  assert.deepEqual(rows.get(alice)?.schedules, [next])
})
test('invalid historical schedule can be removed using exact snapshot', async () => {
  const legacy = { id: 'old', timezone: 'bad' }; rows.set(alice, { user_id: alice, schedules: [legacy] })
  assert.equal((await send({ schedules: [], expectedSchedules: [legacy] })).status, 200)
})
for (const [name, value] of Object.entries({ name: '', id: '', is_active: 'yes', frequency: 'hourly', days: ['XX'], time: '24:00', timezone: 'No/Zone', theme_ids: [null] })) {
  test(`invalid schedule ${name} rejected before write`, async () => {
    assert.equal((await send({ schedules: [{ ...schedule, [name]: value }], expectedSchedules: [] })).status, 400)
    assert.equal(privileged, 0); assert.equal(writes, 0)
  })
}
for (const [name, schedules] of Object.entries({ null: null, object: {}, scalar: 'x', duplicate: [schedule, schedule], missing: [{ id: 'x' }], days: [{ ...schedule, days: [] }] })) {
  test(`invalid schedules ${name} rejected`, async () => {
    assert.equal((await send({ schedules, expectedSchedules: [] })).status, 400); assert.equal(writes, 0)
  })
}
for (const expectedSchedules of [null, {}, '[]']) {
  test(`malformed precondition ${JSON.stringify(expectedSchedules)} rejected`, async () => {
    assert.equal((await send({ schedules: [schedule], expectedSchedules })).status, 400); assert.equal(writes, 0)
  })
}
for (const point of ['error', 'throw']) test(`database ${point} is redacted`, async () => {
  fail = point; const response = await send({ schedules: [schedule], expectedSchedules: [] })
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'Erreur mise a jour config' })
})
test('anonymous request is rejected before all privileged access', async () => {
  identity = null; assert.equal((await send({ schedules: [schedule], expectedSchedules: [] })).status, 401); assert.equal(privileged, 0)
})
for (const body of [null, [], 'text']) test(`invalid request envelope ${JSON.stringify(body)} is 400`, async () => {
  assert.equal((await send(body)).status, 400); assert.equal(privileged, 0)
})
