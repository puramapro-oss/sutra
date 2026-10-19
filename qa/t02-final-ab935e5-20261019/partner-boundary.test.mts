import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

const marker = 'SYNTHETIC_PRIVATE_PARTNER_DIAGNOSTIC'
let throws: boolean
let failingCount: number
let countCalls: number
let ipCount: number
let dailyCount: number
let insertError: boolean
let inserts: number
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => {
  if (throws) throw new Error(marker)
  return { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      single: async () => ({ data: { id: 'partner', status: 'active' }, error: null }),
      gte: async () => {
        countCalls++
        return countCalls === failingCount
          ? { count: null, error: { message: marker } }
          : { count: countCalls % 2 === 1 ? ipCount : dailyCount, error: null }
      },
      insert: async () => {
        assert.equal(table, 'partner_scans'); inserts++
        return { error: insertError ? { message: marker } : null }
      },
    }
    return query
  } }
} } })
const qr = await import('../../src/app/api/partner/qr/[code]/route.ts')
const scan = await import('../../src/app/api/partner/scan/[code]/route.ts')
const callScan = () => scan.GET(new Request('https://sutra.example.test/api/partner/scan/ABC', {
  headers: { 'x-forwarded-for': '192.0.2.42' },
}), { params: Promise.resolve({ code: 'ABC' }) })
beforeEach(() => { throws = insertError = false; failingCount = countCalls = ipCount = dailyCount = inserts = 0 })
test('partner QR never exposes private service diagnostics', async () => {
  throws = true
  const response = await qr.GET(new Request('https://sutra.example.test'), { params: Promise.resolve({ code: 'ABC' }) })
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
test('partner scan never exposes private service diagnostics', async () => {
  throws = true
  const response = await callScan()
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
for (const index of [1, 2]) test(`partner scan fails closed if quota read ${index} fails`, async () => {
  failingCount = index
  const response = await callScan()
  assert.equal(response.status, 503)
  assert.equal(inserts, 0)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
test('partner scan does not report accepted attribution after failed insert', async () => {
  insertError = true
  const response = await callScan()
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.doesNotMatch(await response.text(), new RegExp(marker))
})
test('partner scan preserves a legitimate fixed-origin referral redirect', async () => {
  const response = await callScan()
  assert.equal(response.status, 302); assert.equal(inserts, 1)
  const location = new URL(response.headers.get('location')!)
  assert.equal(location.origin, 'https://sutra.purama.dev'); assert.equal(location.pathname, '/signup')
  assert.equal(location.searchParams.get('ref'), 'ABC')
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/)
  assert.match(response.headers.get('set-cookie')!, /Secure/)
})
test('partner scan respects an observed daily quota', async () => {
  dailyCount = 100
  assert.equal((await callScan()).status, 429); assert.equal(inserts, 0)
})
test('partner scan does not insert an observed same-IP duplicate', async () => {
  ipCount = 1
  assert.equal((await callScan()).status, 302); assert.equal(inserts, 0)
})
