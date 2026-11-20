import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { AutoVideoRecord } from '../src/lib/sutra-auto-types.ts'

globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const userId = '11111111-1111-4111-8111-111111111111'
const localId = '22222222-2222-4222-8222-222222222222'
const profileId = 'a'.repeat(24), accountId = 'b'.repeat(24), postId = 'c'.repeat(24)
type Row = Record<string, unknown>
let authenticated = true, databaseFailure = '', updateFailure = false, concurrentUpdate = false
let videos: Row[] = [], accounts: Row[] = [], writes: Row[] = [], analyzed: AutoVideoRecord[][] = []
let analyticsCalls: unknown[][] = [], analyticsFailure = '', reportCount: number | undefined
let savedFilters: Array<Array<[string, unknown]>> = []
let revokeAfterRead = false, metricsOverride: Partial<typeof readMetrics> = {}, insights: string[] = [], memoryResults: boolean[] = []
const readMetrics = { views: 100, likes: 10, comments: 2, shares: 3, engagementRate: 15 }
const analytics = async (...args: unknown[]) => {
  analyticsCalls.push(args)
  if (analyticsFailure === 'all' || analyticsFailure === args[1]) throw new Error('synthetic-private-provider-detail')
  if (revokeAfterRead) accounts[0].status = 'revoked'
  return { ...readMetrics, ...metricsOverride }
}
const service = {
  schema: () => service,
  from(table: string) {
    let mutation: Row | undefined
    const filters: Array<[string, unknown]> = []
    const execute = () => {
      if (databaseFailure === table) return { data: null, error: { message: 'synthetic-private-database-detail' }, count: null }
      if (mutation) {
        if (updateFailure || concurrentUpdate) return { data: null, error: updateFailure ? { message: 'write failed' } : null }
        savedFilters.push(structuredClone(filters))
        writes.push(structuredClone(mutation))
        return { data: { id: 'video-a' }, error: null }
      }
      const data = table === 'sutra_auto_config' ? [{ user_id: userId }] : table === 'social_accounts' ? accounts : videos
      return { data: structuredClone(data), error: null, count: reportCount ?? data.length }
    }
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
      is: (key: string, value: unknown) => { filters.push([key, value]); return builder },
      gte: () => builder,
      in: () => builder,
      update: (value: Row) => { mutation = value; return builder },
      maybeSingle: async () => execute(),
      then: (resolve: (result: ReturnType<typeof execute>) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(execute).then(resolve, reject),
    }
    return builder
  },
}
mock.module('../src/lib/cron-auth.ts', { namedExports: { assertCronAuth: () => authenticated ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }) } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
mock.module('../src/lib/sutra-auto.ts', { namedExports: {
  analyzePerformance: async ({ recentVideos }: { recentVideos: AutoVideoRecord[] }) => { analyzed.push(structuredClone(recentVideos)); return insights },
  recordMemory: async () => memoryResults.shift() ?? true,
} })
mock.module('../src/lib/zernio.ts', { namedExports: {
  getAccountAnalytics: analytics, getAuthorizedProfileId: () => profileId,
  PLATFORM_INFO: { youtube: {}, x: {} },
} })
const { GET } = await import('../src/app/api/cron/auto-learn/route.ts')
const request = () => new Request('https://sutra.fixture.invalid/api/cron/auto-learn')
const target = () => ({ platform: 'youtube', accountId, localAccountId: localId, postId, status: 'published', success: true })
beforeEach(() => {
  authenticated = true; databaseFailure = ''; updateFailure = false; concurrentUpdate = false; reportCount = undefined
  analyticsFailure = ''; writes = []; analyzed = []; analyticsCalls = []; savedFilters = []
  revokeAfterRead = false; metricsOverride = {}; insights = []; memoryResults = []
  accounts = [{ id: localId, user_id: userId, platform: 'youtube', external_id: accountId, status: 'connected', token_expires_at: null,
    metadata: { credential_owner: 'zernio', zernio_profile_id: profileId } }]
  videos = [{ id: 'video-a', user_id: userId, status: 'published', title: 'Existing video', updated_at: '2026-11-10T00:00:00.000Z',
    published_platforms: [target()], views: 999, likes: 50, comments: 4, shares: 8, engagement_rate: 6.21 }]
})

test('learning reads modern accountId and analyzes only metrics that were actually saved', async () => {
  const res = await GET(request())
  assert.equal(res.status, 200)
  assert.deepEqual(analyticsCalls, [['youtube', accountId, postId, userId]])
  assert.deepEqual(writes, [{ views: 100, likes: 10, comments: 2, shares: 3, engagement_rate: 15 }])
  assert.equal(analyzed.length, 1)
  assert.equal((analyzed[0][0] as unknown as Row).views, 100)
  assert.ok(savedFilters[0].some(([key, value]) => key === 'user_id' && value === userId), 'writes remain user-scoped')
  assert.ok(savedFilters[0].some(([key]) => key === 'updated_at'), 'writes compare the originally read revision')
  assert.ok(savedFilters[0].some(([key]) => key === 'published_platforms'), 'writes retain the read publication identity')
})

test('learning supports an explicit legacy account_id without inferring another account', async () => {
  const legacy: Row = { ...target(), account_id: accountId }
  delete legacy.accountId
  videos[0].published_platforms = [legacy]
  await GET(request())
  assert.equal(analyticsCalls.length, 1)
  assert.equal(writes.length, 1)
})

test('learning provider outage preserves prior measurements and does not generate insights', async () => {
  analyticsFailure = 'all'
  const res = await GET(request())
  assert.equal((await res.json()).status, 'partial')
  assert.equal(writes.length, 0)
  assert.equal(analyzed.length, 0)
})

for (const mode of ['empty', 'unknown', 'mismatched-identity', 'unowned', 'revoked', 'revocation-pending', 'duplicate'] as const) {
  test(`learning ${mode} destinations cannot manufacture zero or duplicate totals`, async () => {
    if (mode === 'empty') videos[0].published_platforms = []
    if (mode === 'unknown') videos[0].published_platforms = [{ ...target(), status: 'unknown', success: false }]
    if (mode === 'mismatched-identity') videos[0].published_platforms = [{ ...target(), account_id: 'd'.repeat(24) }]
    if (mode === 'unowned') accounts = []
    if (mode === 'revoked') accounts[0].status = 'revoked'
    if (mode === 'revocation-pending') accounts[0].metadata = { credential_owner: 'zernio', zernio_profile_id: profileId, sutra_revocation_pending: true }
    if (mode === 'duplicate') videos[0].published_platforms = [target(), target()]
    const res = await GET(request())
    assert.equal((await res.json()).status, 'partial')
    assert.equal(writes.length, 0)
    assert.equal(analyzed.length, 0)
  })
}

test('learning never persists a partial sum when one destination fails', async () => {
  const other = 'd'.repeat(24)
  accounts.push({ ...accounts[0], id: 'other-local', external_id: other })
  videos[0].published_platforms = [target(), { ...target(), accountId: other, localAccountId: 'other-local' }]
  analyticsFailure = other
  await GET(request())
  assert.equal(analyticsCalls.length, 2)
  assert.equal(writes.length, 0)
  assert.equal(analyzed.length, 0)
})

for (const mode of ['write-error', 'concurrent-change'] as const) test(`learning ${mode} excludes uncommitted observations from AI input`, async () => {
  updateFailure = mode === 'write-error'; concurrentUpdate = mode === 'concurrent-change'
  const res = await GET(request())
  assert.equal((await res.json()).status, 'partial')
  assert.equal(writes.length, 0)
  assert.equal(analyzed.length, 0)
})

test('learning returns unavailable when the configuration read fails, without leaking diagnostics', async () => {
  databaseFailure = 'sutra_auto_config'
  const res = await GET(request())
  assert.equal(res.status, 503)
  assert.doesNotMatch(JSON.stringify(await res.json()), /private|detail/)
  assert.equal(analyticsCalls.length, 0)
})

test('learning detects truncated database reads and never calls a provider on incomplete scope', async () => {
  reportCount = 2
  const res = await GET(request())
  assert.equal(res.status, 503)
  assert.equal(analyticsCalls.length, 0)
})

test('learning keeps the cron authorization boundary', async () => {
  authenticated = false
  const res = await GET(request())
  assert.equal(res.status, 401)
  assert.equal(analyticsCalls.length, 0)
  assert.equal(writes.length, 0)
})

test('learning a disconnect during the provider read cannot persist or train on its response', async () => {
  revokeAfterRead = true
  const res = await GET(request())
  assert.equal((await res.json()).status, 'partial')
  assert.equal(writes.length, 0)
  assert.equal(analyzed.length, 0)
})

test('learning preserves a provider engagement rate when views are zero but interactions are measured', async () => {
  metricsOverride = { views: 0, engagementRate: 2.78 }
  await GET(request())
  assert.equal(writes[0].engagement_rate, 2.78)
})

test('learning does not fabricate an engagement rate without a measured denominator', async () => {
  metricsOverride = { views: 0, engagementRate: undefined }
  await GET(request())
  assert.equal(writes[0].engagement_rate, null)
  assert.equal((analyzed[0][0] as unknown as Row).engagement_rate, null)
})

test('learning reports only memory inserts that returned a saved identity', async () => {
  insights = ['first insight', 'second insight']; memoryResults = [true, false]
  const res = await GET(request())
  const body = await res.json()
  assert.equal(body.status, 'partial')
  assert.equal(body.summaries[0].insights_count, 1)
})

test('learning uses the same two-decimal rate for storage and the AI evidence', async () => {
  metricsOverride = { engagementRate: 2.785 }
  await GET(request())
  assert.equal(writes[0].engagement_rate, 2.79)
  assert.equal((analyzed[0][0] as unknown as Row).engagement_rate, 2.79)
})
