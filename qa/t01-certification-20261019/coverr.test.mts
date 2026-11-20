import assert from 'node:assert/strict'
import { after, beforeEach, mock, test } from 'node:test'

const { PROVIDERS, providerConfigStatus } = await import('../../src/lib/env.ts')
const names = [...new Set(Object.values(PROVIDERS).flatMap(spec => spec.env).concat('COVERR_API_KEY'))]
const previous = names.map(name => process.env[name])
const originalFetch = globalThis.fetch
let owner = true
let calls: { url: string; headers: Headers }[] = []
mock.module('../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: owner ? { email: 'owner@fixture.invalid' } : null }, error: null }) } }),
} })
mock.module('../../src/lib/utils.ts', { namedExports: { isSuperAdmin: () => owner } })
mock.module('../../src/lib/utils/api.ts', { namedExports: { getBreakerStatus: () => [] } })
const { GET } = await import('../../src/app/api/admin/health/route.ts')
beforeEach(() => {
  names.forEach(name => { delete process.env[name] })
  owner = true; calls = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) })
    return Response.json({ hits: [] })
  }
})
after(() => {
  globalThis.fetch = originalFetch; mock.restoreAll()
  names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i] })
})
test('Coverr absent: unconfigured and no anonymous probe', async () => {
  assert.equal(providerConfigStatus('coverr').configured, false)
  assert.deepEqual(providerConfigStatus('coverr').missing, ['COVERR_API_KEY'])
  assert.equal((await GET()).status, 200)
  assert.equal(calls.length, 0)
})
test('Coverr configured: one bounded Bearer GET, no credential in output or URL', async () => {
  process.env.COVERR_API_KEY = 'synthetic-coverr-only'
  const response = await GET()
  const body = await response.text()
  assert.equal(providerConfigStatus('coverr').configured, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer synthetic-coverr-only')
  assert.doesNotMatch(calls[0].url + body, /synthetic-coverr-only/)
  assert.match(body, /"httpStatus":200/)
})
test('Coverr owner boundary: anonymous request performs no probe', async () => {
  owner = false; process.env.COVERR_API_KEY = 'synthetic-coverr-only'
  assert.equal((await GET()).status, 401)
  assert.equal(calls.length, 0)
})
test('Coverr provider denial remains explicit and does not return its body', async () => {
  process.env.COVERR_API_KEY = 'synthetic-coverr-only'
  globalThis.fetch = async () => new Response('PRIVATE_FIXTURE_DIAGNOSTIC', { status: 403 })
  const body = await (await GET()).json()
  assert.equal(body.connectivity[0].status, 'error')
  assert.equal(body.connectivity[0].httpStatus, 403)
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_FIXTURE_DIAGNOSTIC|synthetic-coverr-only/)
})
