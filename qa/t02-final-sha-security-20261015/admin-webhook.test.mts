import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import Stripe from 'stripe'

const marker = 'T02_SYNTHETIC_PRIVATE_DIAGNOSTIC'
let identity: 'admin' | 'member' | 'anonymous' = 'admin'
let expired = false, revoked = false, authThrows = false, serviceThrows = false, dispatchThrows = false
let privileged = 0, dispatched = 0, network = 0, timeout = false
const server = {
  auth: { getUser: async () => ({ data: { user: identity === 'anonymous' ? null : { id: identity, email: `${identity}@test.invalid` } }, error: expired ? new Error(marker) : null }) },
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: identity, subscription_status: 'active', access_revoked_at: revoked ? '2026-10-01' : null }, error: null }) }
    return query
  },
}
const { enforceAccountAccess } = await import('../../src/lib/account-access.ts')
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => {
  if (authThrows) throw new Error(marker)
  return enforceAccountAccess({ ...server, auth: { ...server.auth } } as never)
} } })
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  privileged++
  if (serviceThrows) throw new Error(marker)
  const query = {
    select: () => query, eq: () => query, order: () => query, limit: () => query, range: () => query,
    upsert: async () => ({ error: null }),
    maybeSingle: async () => ({ data: { id: 'target' }, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: [], count: 0, error: null }),
  }
  return { from: () => query }
} } })
mock.module('../../src/lib/utils.ts', { namedExports: { isSuperAdmin: (email: string) => email === 'admin@test.invalid' } })
mock.module('../../src/lib/redis.ts', { namedExports: { cached: async (_key: string, fn: () => Promise<unknown>) => fn() } })
mock.module('../../src/lib/env.ts', { namedExports: {
  isEnvSet: () => false, allProviderConfigStatus: () => [], optionalEnv: () => 'test', requireEnv: () => assert.fail('no real provider configuration'),
} })
mock.module('../../src/lib/utils/api.ts', { namedExports: { getBreakerStatus: () => [] } })
const stripe = new Stripe('sk_test_synthetic_fixture_only')
mock.module('../../src/lib/stripe.ts', { namedExports: { stripe } })
mock.module('../../src/lib/stripe/webhook-dispatch.ts', { namedExports: { dispatchStripeEvent: async () => {
  dispatched++
  if (dispatchThrows) throw new Error(marker)
} } })
const health = await import('../../src/app/api/admin/health/route.ts')
const users = await import('../../src/app/api/admin/users/route.ts')
const user = await import('../../src/app/api/admin/users/[id]/route.ts')
const stats = await import('../../src/app/api/admin/stats/route.ts')
const webhook = await import('../../src/app/api/stripe/webhook/route.ts')
const adminRoutes = [
  ['users', () => users.GET(new Request('https://sutra.test/api/admin/users'))],
  ['user', () => user.GET(new Request('https://sutra.test/api/admin/users/target'), { params: Promise.resolve({ id: 'target' }) })],
  ['stats', () => stats.GET(new Request('https://sutra.test/api/admin/stats?type=activity'))],
  ['config', () => stats.POST(new Request('https://sutra.test/api/admin/stats', { method: 'POST', body: JSON.stringify({ type: 'save_config', section: 'fixture', values: { enabled: false } }) }))],
  ['health', () => health.GET()],
] as const

beforeEach(() => {
  identity = 'admin'; expired = revoked = authThrows = serviceThrows = dispatchThrows = timeout = false
  privileged = dispatched = network = 0
  delete process.env.STRIPE_WEBHOOK_SECRET
  globalThis.fetch = async () => { network++; throw timeout ? new DOMException(marker, 'TimeoutError') : new Error(marker) }
})

for (const [name, invoke] of adminRoutes) {
  for (const state of ['anonymous', 'member', 'expired', 'revoked']) test(`${name}: deny ${state} before privileged I/O`, async () => {
    if (state === 'anonymous' || state === 'member') identity = state
    expired = state === 'expired'; revoked = state === 'revoked'
    const response = await invoke()
    assert.equal(response?.status, state === 'member' ? 403 : 401)
    assert.equal(privileged + network, 0)
  })
  if (name !== 'health') {
    for (const point of ['auth', 'service']) test(`${name}: never return ${point} diagnostics`, async () => {
      authThrows = point === 'auth'; serviceThrows = point === 'service'
      const response = await invoke()
      assert.equal(response?.status, 500)
      assert.doesNotMatch(await response!.text(), new RegExp(marker))
    })
    test(`${name}: keep authorized success`, async () => assert.equal((await invoke())?.status, 200))
  }
}
test('health: failed probe never returns exception text', async () => {
  const response = await health.GET()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(network, 1)
  assert.equal(body.connectivity[0].status, 'error')
  assert.doesNotMatch(JSON.stringify(body), new RegExp(marker))
})
test('health: timeout remains a public bounded reason', async () => {
  timeout = true
  const body = await (await health.GET()).json()
  assert.equal(body.connectivity[0].reason, 'timeout')
})

const payload = JSON.stringify({ id: 'evt_fixture', object: 'event', type: 'test.fixture' })
const signingSecret = 'whsec_synthetic_fixture_only'
function request(signature?: string, body = payload) {
  return new Request('https://sutra.test/api/stripe/webhook', { method: 'POST', body, headers: signature ? { 'stripe-signature': signature } : {} })
}
test('webhook: absent signature and secret deny before dispatch', async () => {
  assert.equal((await webhook.POST(request())).status, 400)
  assert.equal((await webhook.POST(request('invalid'))).status, 500)
  assert.equal(dispatched, 0)
})
test('webhook: wrong signature, stale timestamp and tampered payload deny', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = signingSecret
  for (const [signature, body] of [
    ['invalid', payload],
    [stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret, timestamp: 1 }), payload],
    [stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }), payload + ' '],
  ]) assert.equal((await webhook.POST(request(signature, body))).status, 400)
  assert.equal(dispatched, 0)
})
test('webhook: verified event dispatch succeeds', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = signingSecret
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret })
  assert.equal((await webhook.POST(request(signature))).status, 200)
  assert.equal(dispatched, 1)
})
test('webhook: dispatch failure is retryable without exposing private diagnostics', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = signingSecret; dispatchThrows = true
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret })
  const response = await webhook.POST(request(signature))
  assert.equal(response.status, 500); assert.equal(dispatched, 1)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
