import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

process.env.ZERNIO_API_KEY = 'synthetic-analytics-key'
process.env.ZERNIO_BASE_URL = 'https://analytics.fixture.invalid/api/v1'
const userId = '11111111-1111-4111-8111-111111111111'
const profileId = 'a'.repeat(24), accountId = 'b'.repeat(24), postId = 'c'.repeat(24)
const { getAccountAnalytics } = await import('../src/lib/zernio.ts')
const metrics = { views: 100, likes: 10, comments: 2, shares: 3, engagementRate: 15 }
const payload = () => ({
  postId, latePostId: null, status: 'published', syncStatus: 'synced', analytics: metrics,
  platformAnalytics: [{ platform: 'twitter', accountId, status: 'published', syncStatus: 'synced', analytics: { ...metrics } }],
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
const read = () => getAccountAnalytics('x', accountId, postId, userId)
beforeEach(() => {
  process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [userId]: profileId })
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
})

test('analytics uses documented camelCase query and the exact server-side profile binding', async () => {
  let calls = 0
  globalThis.fetch = async (input, options) => {
    calls++
    const url = new URL(String(input))
    assert.equal(url.origin + url.pathname, 'https://analytics.fixture.invalid/api/v1/analytics')
    assert.deepEqual(Object.fromEntries(url.searchParams), { platform: 'twitter', accountId, postId, profileId })
    assert.equal(options?.method, 'GET')
    assert.equal(options?.redirect, 'error')
    assert.ok(options?.signal instanceof AbortSignal)
    return json(payload())
  }
  assert.deepEqual(await read(), metrics)
  assert.equal(calls, 1)
})

test('analytics selects one account, never the aggregate of other destinations', async () => {
  const data = payload()
  data.analytics = { ...metrics, views: 9000 }
  data.platformAnalytics.unshift({ ...data.platformAnalytics[0], accountId: 'd'.repeat(24), analytics: { ...metrics, views: 8900 } })
  globalThis.fetch = async () => json(data)
  assert.deepEqual(await read(), metrics)
})

test('analytics retains measured zero without treating an unavailable value as zero', async () => {
  const data = payload()
  const zeros = { views: 0, likes: 0, comments: 0, shares: 0, engagementRate: 0 }
  data.platformAnalytics[0].analytics = zeros
  globalThis.fetch = async () => json(data)
  assert.deepEqual(await read(), zeros)
})

test('analytics accepts auto-resolved external identity only when latePostId matches', async () => {
  const data = { ...payload(), postId: 'e'.repeat(24), latePostId: postId }
  globalThis.fetch = async () => json(data)
  assert.deepEqual(await read(), metrics)
})

for (const status of [202, 401, 402, 424, 503]) test(`analytics HTTP ${status} is unavailable, not a zero measurement`, async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return json({ ...payload(), diagnostic: 'synthetic-private-detail' }, status) }
  await assert.rejects(read, /^Error: SUTRA_ZERNIO_ANALYTICS_UNAVAILABLE$/)
  assert.equal(calls, 1)
})

for (const variant of ['missing', 'duplicate', 'other-account', 'other-post', 'pending', 'null', 'negative', 'numeric-string', 'fractional', 'unsafe', 'missing-count'] as const) {
  test(`analytics rejects ${variant} evidence before it reaches the learning loop`, async () => {
    const data: Record<string, unknown> = payload()
    const target = (data.platformAnalytics as Array<Record<string, unknown>>)[0]
    const stats = target.analytics as Record<string, unknown>
    if (variant === 'missing') data.platformAnalytics = []
    if (variant === 'duplicate') data.platformAnalytics = [target, target]
    if (variant === 'other-account') target.accountId = 'd'.repeat(24)
    if (variant === 'other-post') data.postId = 'd'.repeat(24)
    if (variant === 'pending') target.syncStatus = 'pending'
    if (variant === 'null') target.analytics = null
    if (variant === 'negative') stats.views = -1
    if (variant === 'numeric-string') stats.views = '100'
    if (variant === 'fractional') stats.likes = 1.5
    if (variant === 'unsafe') stats.views = Number.MAX_SAFE_INTEGER + 1
    if (variant === 'missing-count') delete stats.shares
    globalThis.fetch = async () => json(data)
    await assert.rejects(read, /^Error: SUTRA_ZERNIO_ANALYTICS_UNAVAILABLE$/)
  })
}

test('analytics rejects an absent tenant binding before any HTTP request', async () => {
  let calls = 0
  process.env.ZERNIO_PROFILE_BINDINGS = '{}'
  globalThis.fetch = async () => { calls++; return json(payload()) }
  await assert.rejects(read, /^Error: SUTRA_ZERNIO_ANALYTICS_UNAVAILABLE$/)
  assert.equal(calls, 0)
})

test('analytics bounds provider JSON and never exposes its private diagnostic', async () => {
  globalThis.fetch = async () => json({ ...payload(), diagnostic: 'x'.repeat(70_000) })
  await assert.rejects(read, /^Error: SUTRA_ZERNIO_ANALYTICS_UNAVAILABLE$/)
})

test('analytics rejects a tenant profile reassigned while the provider read was pending', async () => {
  globalThis.fetch = async () => {
    process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [userId]: 'f'.repeat(24) })
    return json(payload())
  }
  await assert.rejects(read, /^Error: SUTRA_ZERNIO_ANALYTICS_UNAVAILABLE$/)
})
