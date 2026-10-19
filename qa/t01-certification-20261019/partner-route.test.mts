import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

let outcome: unknown, error: unknown, throws: boolean
let calls: Array<{ name: string; input: Record<string, unknown> }> = []
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: () => assert.fail('Route must never split quota reads from insertion'),
  rpc: async (name: string, input: Record<string, unknown>) => {
    calls.push({ name, input })
    if (throws) throw new Error('PRIVATE_DB_DIAGNOSTIC')
    return { data: outcome, error }
  },
}) } })
const { GET } = await import('../../src/app/api/partner/scan/[code]/route.ts')
const request = (code = 'ABC') => GET(new Request('https://sutra.example.test/api/partner/scan/' + code, {
  headers: { 'x-forwarded-for': '192.0.2.1', 'user-agent': 'fixture desktop', referer: 'https://private.example.test/' },
}), { params: Promise.resolve({ code }) })
beforeEach(() => { outcome = 'recorded'; error = null; throws = false; calls = [] })

for (const admitted of ['recorded', 'duplicate']) test(`${admitted}: exactly one atomic RPC and secure referral cookie`, async () => {
  outcome = admitted
  const response = await request()
  assert.equal(response.status, 302)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { name: 'record_partner_scan', input: { p_code: 'ABC', p_ip_address: '192.0.2.1', p_device: 'desktop', p_os: 'unknown' } })
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/)
  assert.match(response.headers.get('set-cookie') ?? '', /Secure/)
  assert.match(response.headers.get('location') ?? '', /\/signup\?ref=ABC$/)
})
for (const [result, status] of [['quota_exceeded', 429], ['not_found', 404], [null, 503], ['unexpected', 503]] as const) {
  test(`${String(result)}: refuses without setting referral cookie`, async () => {
    outcome = result
    const response = await request()
    assert.equal(response.status, status); assert.equal(response.headers.get('set-cookie'), null)
  })
}
test('RPC error fails closed even if data says recorded, with no private diagnostic', async () => {
  error = { message: 'PRIVATE_DB_DIAGNOSTIC' }
  const response = await request()
  assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null)
  assert.doesNotMatch(await response.text(), /PRIVATE_DB_DIAGNOSTIC/)
})
test('thrown transport error is redacted and never sets referral cookie', async () => {
  throws = true
  const response = await request()
  assert.equal(response.status, 500); assert.equal(response.headers.get('set-cookie'), null)
  assert.doesNotMatch(await response.text(), /PRIVATE_DB_DIAGNOSTIC/)
})
test('invalid code does not call database', async () => {
  assert.equal((await request('AB')).status, 400); assert.equal(calls.length, 0)
})
