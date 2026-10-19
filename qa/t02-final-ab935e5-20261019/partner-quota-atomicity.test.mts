import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

// Separate owner-boundary counterexample. No DB, network, cookie persistence or payment.
// Both readers observe the same committed count before either INSERT is accepted.
let inserts = 0
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  let reads = 0
  const query = {
    select: () => query, eq: () => query,
    single: async () => ({ data: { id: 'partner', status: 'active' }, error: null }),
    gte: async () => ({ count: ++reads === 1 ? 0 : 99, error: null }),
    insert: async () => { inserts++; return { error: null } },
  }
  return { from: () => query }
} } })
const { GET } = await import('../../src/app/api/partner/scan/[code]/route.ts')
test('partner daily cap allows at most one insert when concurrent readers observe 99', async () => {
  const responses = await Promise.all(['192.0.2.1', '192.0.2.2'].map(ip => GET(
    new Request('https://sutra.example.test/api/partner/scan/ABC', { headers: { 'x-forwarded-for': ip } }),
    { params: Promise.resolve({ code: 'ABC' }) },
  )))
  assert.ok(responses.every(response => [302, 429].includes(response.status)))
  assert.ok(inserts <= 1, `Daily cap exceeded: 99 existing + ${inserts} inserts`)
})
