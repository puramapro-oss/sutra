import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

process.env.TAVILY_API_KEY = 'synthetic-trends-key'
let authenticated = true
let persisted: Array<boolean | Error> = []
let writes: Array<Record<string, unknown>> = []
let searches = 0
let serviceCalls = 0
const userId = '11111111-1111-4111-8111-111111111111'

mock.module('../src/lib/cron-auth.ts', { namedExports: {
  assertCronAuth: () => authenticated ? null : Response.json({ error: 'Unauthorized' }, { status: 401 }),
} })
mock.module('../src/lib/supabase.ts', { namedExports: {
  createServiceClient: () => {
    serviceCalls++
    return {
      from(table: string) {
        const result = { data: table === 'sutra_auto_config' ? [{ user_id: userId }] : [{ theme: 'science' }], error: null }
        const builder = {
          select: () => builder, eq: () => builder, limit: () => builder,
          then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
        }
        return builder
      },
    }
  },
} })
mock.module('../src/lib/sutra-auto.ts', { namedExports: {
  recordMemory: async (value: Record<string, unknown>) => {
    writes.push(value)
    const result = persisted.shift()
    if (result instanceof Error) throw result
    return result === true
  },
} })
const { GET } = await import('../src/app/api/cron/auto-trends/route.ts')

beforeEach(() => {
  authenticated = true
  persisted = [true, true, true]
  writes = []
  searches = 0
  serviceCalls = 0
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://api.tavily.com/search')
    searches++
    return Response.json({ results: [1, 2, 3].map(n => ({ title: `Trend ${n}`, content: 'Synthetic evidence' })) })
  }
})

const execute = () => GET(new Request('https://sutra.fixture.invalid/api/cron/auto-trends'))

test('trends requires cron authentication before database, provider or memory access', async () => {
  authenticated = false
  assert.equal((await execute()).status, 401)
  assert.equal(serviceCalls, 0)
  assert.equal(searches, 0)
  assert.equal(writes.length, 0)
})

test('trends counts all three confirmed writes for the requesting principal', async () => {
  const body = await (await execute()).json()
  assert.equal(body.status, 'ok')
  assert.equal(body.total_trends, 3)
  assert.equal(body.failed_trends ?? 0, 0)
  assert.equal(writes.length, 3)
  for (const write of writes) {
    assert.equal(write.userId, userId)
    assert.equal(write.type, 'trend')
    assert.equal(write.expiresInDays, 7)
  }
})

test('trends never counts unconfirmed writes and retains later confirmed successes', async () => {
  persisted = [false, true, false]
  const body = await (await execute()).json()
  assert.equal(body.status, 'partial')
  assert.equal(body.total_trends, 1)
  assert.equal(body.failed_trends, 2)
  assert.equal(writes.length, 3)
})

test('trends isolates a rejected memory write without losing subsequent evidence', async () => {
  persisted = [true, new Error('synthetic-private-storage-detail'), true]
  const response = await execute()
  const text = await response.text()
  const body = JSON.parse(text)
  assert.equal(response.status, 200)
  assert.equal(body.status, 'partial')
  assert.equal(body.total_trends, 2)
  assert.equal(body.failed_trends, 1)
  assert.equal(writes.length, 3)
  assert.equal(text.includes('synthetic-private-storage-detail'), false)
})

test('trends returns zero confirmed memories when every write is refused', async () => {
  persisted = [false, false, false]
  const body = await (await execute()).json()
  assert.equal(body.status, 'partial')
  assert.equal(body.total_trends, 0)
  assert.equal(body.failed_trends, 3)
})
