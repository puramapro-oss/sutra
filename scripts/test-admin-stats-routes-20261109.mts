import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

// Real route handlers; the database, identity and cache are isolated at their boundaries.
// No credentials, Redis instance or provider endpoints are used.
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
type Row = Record<string, string | number | null>
type Result = { data: Row[] | null; count: number | null; error: { message: string } | null }
type QueryLog = { table: string; operations: Array<{ name: string; args: unknown[] }> }
let authenticated = true, admin = true, failureAt = -1
let results: Result[] = [], reads: QueryLog[] = [], cachedValues: unknown[] = []

class Query implements PromiseLike<Result> {
  constructor(private index: number) {}
  operation(name: string, args: unknown[]) { reads[this.index].operations.push({ name, args }); return this }
  select(...args: unknown[]) { return this.operation('select', args) }
  eq(...args: unknown[]) { return this.operation('eq', args) }
  neq(...args: unknown[]) { return this.operation('neq', args) }
  gte(...args: unknown[]) { return this.operation('gte', args) }
  order(...args: unknown[]) { return this.operation('order', args) }
  limit(...args: unknown[]) { return this.operation('limit', args) }
  then<T = Result, E = never>(resolve?: ((value: Result) => T | PromiseLike<T>) | null, reject?: ((reason: unknown) => E | PromiseLike<E>) | null): Promise<T | E> {
    const value = this.index === failureAt
      ? { data: null, count: null, error: { message: 'synthetic private database context' } }
      : results[this.index]
    if (!value) return Promise.reject(new Error(`Unexpected query ${this.index}`)).then(resolve, reject)
    return Promise.resolve(value).then(resolve, reject)
  }
}

mock.module('../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({
    data: { user: authenticated ? { id: 'admin-fixture', email: 'admin@example.invalid' } : null }, error: null,
  }) } }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: {
  createServiceClient: () => ({ from: (table: string) => {
    reads.push({ table, operations: [] }); return new Query(reads.length - 1)
  } }),
} })
mock.module('../src/lib/utils.ts', { namedExports: { isSuperAdmin: () => admin } })
mock.module('../src/lib/redis.ts', { namedExports: {
  cached: async (_key: string, fetcher: () => Promise<unknown>) => {
    const value = await fetcher(); cachedValues.push(value); return value
  },
} })
const { GET } = await import('../src/app/api/admin/stats/route.ts')
const response = (data: Row[] | null = null, count: number | null = data?.length ?? null): Result => ({ data, count, error: null })
const request = (type = '') => new Request(`https://sutra-test.invalid/api/admin/stats${type ? `?type=${type}` : ''}`)
const aggregateResults = () => [
  response(null, 12), response(null, 4), response(null, 20), response(null, 9),
  response([{ amount: 17, created_at: new Date().toISOString() }, { amount: 8, created_at: '2000-01-01T00:00:00.000Z' }]),
  response([{ estimated_cost: 2 }, { estimated_cost: 3 }]),
  response([{ plan: 'free' }, { plan: 'free' }, { plan: 'pro' }]),
]
const referralResults = () => [
  response([{ amount: 5, status: 'paid' }, { amount: 2, status: 'pending' }, { amount: 6, status: 'pending' }]),
  response([{ id: 'partner-fixture', partner_code: 'EXAMPLE', total_referrals: 3, total_commissions: 13 }]),
]
beforeEach(() => {
  authenticated = true; admin = true; failureAt = -1; reads = []; cachedValues = []; results = aggregateResults()
})

for (const [index, description] of ['total users', 'paying users', 'videos', 'active users', 'revenue', 'API costs', 'plan distribution'].entries()) {
  test(`admin stats: failed ${description} query returns an error, never fabricated aggregates`, async () => {
    failureAt = index
    const res = await GET(request())
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'Erreur recuperation stats admin' })
    assert.equal(reads.length, 7)
    assert.equal(cachedValues.length, 0, 'an incomplete result must not reach the cache write boundary')
  })
}

test('admin stats: successful reads retain the existing aggregate calculations and filters', async () => {
  const res = await GET(request())
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { total_users: 12, paying_users: 4, total_videos: 20, active_users_7d: 9,
    total_revenue: 25, mrr: 17, total_api_costs_30d: 5, plan_distribution: { free: 2, pro: 1 } })
  assert.equal(cachedValues.length, 1)
  assert.ok(reads[4].operations.some(op => op.name === 'eq' && op.args[0] === 'status' && op.args[1] === 'succeeded'))
})

test('admin stats: a successful empty dataset remains a genuine zero', async () => {
  results = [response(null, 0), response(null, 0), response(null, 0), response(null, 0), response([]), response([]), response([])]
  const res = await GET(request())
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { total_users: 0, paying_users: 0, total_videos: 0, active_users_7d: 0,
    total_revenue: 0, mrr: 0, total_api_costs_30d: 0, plan_distribution: {} })
})

for (const [index, description] of ['commissions', 'partners'].entries()) {
  test(`admin referrals: failed ${description} read cannot certify zero commissions or an empty ranking`, async () => {
    results = referralResults(); failureAt = index
    const res = await GET(request('referral_stats'))
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'Erreur recuperation stats admin' })
    assert.equal(reads.length, 2)
  })
}

test('admin referrals: successful reads retain paid, pending and ranked values', async () => {
  results = referralResults()
  results[1].count = null // The intentionally bounded top-five list does not need a full count.
  const res = await GET(request('referral_stats'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { commissions_paid: 5, commissions_pending: 8,
    top_partners: [{ code: 'EXAMPLE', referrals: 3, commissions: 13 }] })
  assert.ok(reads[1].operations.some(op => op.name === 'limit' && op.args[0] === 5))
})

test('admin service costs: recorded values are grouped; failure is not a zero-cost success', async () => {
  results = [response([{ service: 'Claude', estimated_cost: 4 }, { service: 'claude', estimated_cost: 2 }, { service: 'runpod', estimated_cost: 0 }])]
  const good = await GET(request('service_costs'))
  assert.equal(good.status, 200)
  assert.deepEqual(await good.json(), { services: { claude: 6, runpod: 0 } })
  reads = []; failureAt = 0
  const failed = await GET(request('service_costs'))
  assert.equal(failed.status, 500)
})

test('admin stats: missing session blocks all database reads', async () => {
  authenticated = false
  assert.equal((await GET(request())).status, 401)
  assert.equal(reads.length, 0)
})

test('admin stats: a non-admin session blocks all database reads', async () => {
  admin = false
  assert.equal((await GET(request('referral_stats'))).status, 403)
  assert.equal(reads.length, 0)
})

for (const index of [0, 1, 2, 3]) {
  test(`admin stats: missing exact count on head query ${index + 1} cannot become zero`, async () => {
    results[index].count = null
    assert.equal((await GET(request())).status, 500)
    assert.equal(cachedValues.length, 0)
  })
}

for (const [index, description] of [[4, 'revenue'], [5, 'API costs'], [6, 'plan distribution']] as const) {
  for (const countMode of ['truncated', 'unknown'] as const) {
    test(`admin stats: ${countMode} ${description} dataset cannot become a complete aggregate`, async () => {
      results[index].count = countMode === 'unknown' ? null : results[index].data!.length + 1000
      assert.equal((await GET(request())).status, 500)
      assert.equal(cachedValues.length, 0)
      const selection = reads[index].operations.find(op => op.name === 'select')
      assert.deepEqual(selection?.args[1], { count: 'exact' })
    })
  }
}

for (const type of ['referral_stats', 'service_costs', 'revenue_chart']) {
  for (const countMode of ['truncated', 'unknown'] as const) {
    test(`admin ${type}: ${countMode} source is unavailable, never a partial total`, async () => {
      results = type === 'referral_stats' ? referralResults() : [response([{ amount: 3, estimated_cost: 3, service: 'claude', created_at: new Date().toISOString() }])]
      results[0].count = countMode === 'unknown' ? null : results[0].data!.length + 1000
      const res = await GET(request(type))
      assert.equal(res.status, 500)
      assert.deepEqual(await res.json(), { error: 'Erreur recuperation stats admin' })
      assert.deepEqual(reads[0].operations.find(op => op.name === 'select')?.args[1], { count: 'exact' })
    })
  }
}

test('admin revenue chart: a complete query retains its daily buckets and sum', async () => {
  const today = new Date().toISOString().slice(0, 10)
  results = [response([{ amount: 3, created_at: `${today}T01:00:00.000Z` }, { amount: 7, created_at: `${today}T02:00:00.000Z` }])]
  const res = await GET(request('revenue_chart'))
  assert.equal(res.status, 200)
  const { series } = await res.json()
  assert.equal(series.length, 90)
  assert.equal(series.find((point: { date: string; amount: number }) => point.date === today)?.amount, 10)
})
