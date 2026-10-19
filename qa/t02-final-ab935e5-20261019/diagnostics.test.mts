import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

const marker = 'SYNTHETIC_PRIVATE_DIAGNOSTIC'
let user: { id: string; email: string; user_metadata?: Record<string, unknown> } | null
let authError: Error | null
let dbError: Error | null
let tableMissing: boolean
let serviceCalls: number
let authThrows: boolean
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({
  auth: { getUser: async () => {
    if (authThrows) throw new Error(marker)
    return { data: { user }, error: authError }
  } },
}) } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  serviceCalls++
  if (dbError) throw dbError
  const query = {
    select: () => query, eq: () => query,
    limit: async () => ({ error: tableMissing ? { code: '42P01' } : null }),
    single: async () => ({ data: { id: 'owner', email: 'private@example.test' } }),
  }
  return { from: () => query }
} } })
mock.module('../../src/lib/ltx.ts', { namedExports: { getLtxHealth: () => ({ healthy: true, failures: 0 }) } })
const setup = await import('../../src/app/api/setup/route.ts')
const health = await import('../../src/app/api/health/route.ts')
beforeEach(() => {
  user = { id: 'owner', email: 'matiss.frasne@gmail.com' }
  authError = dbError = null; authThrows = tableMissing = false; serviceCalls = 0
})
test('setup refuses anonymous requests before service-role access', async () => {
  user = null
  const response = await setup.GET()
  assert.equal(response.status, 401)
  assert.equal(serviceCalls, 0)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})
test('setup refuses ordinary users and forged admin metadata before DB', async () => {
  user = { id: 'other', email: 'client@example.test', user_metadata: { is_admin: true, role: 'admin' } }
  const response = await setup.GET()
  assert.equal(response.status, 403); assert.equal(serviceCalls, 0)
})
test('setup refuses expired or erroneous sessions even with a returned admin user', async () => {
  authError = new Error(marker)
  const response = await setup.GET()
  assert.equal(response.status, 401); assert.equal(serviceCalls, 0)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
test('setup auth transport failure stays closed and never exposes diagnostic', async () => {
  authThrows = true
  const response = await setup.GET()
  assert.equal(response.status, 500); assert.equal(serviceCalls, 0)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
test('setup permits the verified owner with no-store', async () => {
  const response = await setup.GET()
  assert.equal(response.status, 200); assert.equal(serviceCalls, 1)
  assert.equal((await response.json()).status, 'ok')
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})
test('setup schema is available only to the verified owner', async () => {
  tableMissing = true; user = null
  assert.equal((await setup.GET()).status, 401); assert.equal(serviceCalls, 0)
  user = { id: 'owner', email: 'matiss.frasne@gmail.com' }
  const response = await setup.GET()
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'needs_setup')
})
test('setup does not expose private DB diagnostics even to the owner', async () => {
  dbError = new Error(marker)
  const response = await setup.GET()
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})
test('public health preserves down status without disclosing DB/transport diagnostics', async () => {
  dbError = new Error(marker)
  mock.method(globalThis, 'fetch', async () => { throw new Error(marker) })
  // Avoid ten-second pending timers in both red and green runs; still exercise the checker.
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const response = await health.GET()
    assert.equal(response.status, 503)
    const body = await response.text()
    assert.doesNotMatch(body, new RegExp(marker))
    assert.equal(JSON.parse(body).services.supabase.status, 'down')
  } finally { mock.restoreAll(); mock.timers.reset() }
})
test('public health remains available without auth when all probes succeed', async () => {
  user = null
  mock.method(globalThis, 'fetch', async () => new Response('{}'))
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const response = await health.GET()
    assert.equal(response.status, 200); assert.equal((await response.json()).status, 'ok')
  } finally { mock.restoreAll(); mock.timers.reset() }
})
