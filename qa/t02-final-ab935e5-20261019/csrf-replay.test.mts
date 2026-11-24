import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'
import { NextRequest } from 'next/server'
let authCalls = 0
mock.module('@supabase/ssr', { namedExports: { createServerClient: () => {
  authCalls++
  throw new Error('Unexpected middleware auth round trip for public API')
} } })
const { middleware } = await import('../../src/middleware.ts')
const { POST: sunoWebhook } = await import('../../src/app/api/webhooks/suno/route.ts')
beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.example.test'; authCalls = 0 })
test('CSRF rejects cross-origin and null-origin mutations including forged proxy headers', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const origin of ['https://evil.example.test', 'null', 'https://sutra.example.test.evil.test']) {
      const request = new NextRequest('http://localhost/api/create/status', { method, headers: {
        origin, 'x-forwarded-host': 'evil.example.test', 'x-forwarded-proto': 'https',
        'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
      } })
      assert.equal((await middleware(request)).status, 403)
    }
  }
  assert.equal(authCalls, 0)
})
test('CSRF rejects cross-origin mutations before static-looking path bypass', async () => {
  const response = await middleware(new NextRequest('https://sutra.example.test/api/create/fake.png', {
    method: 'POST', headers: { origin: 'https://evil.example.test' },
  }))
  assert.equal(response.status, 403)
})
test('costly routes reject browser form encodings before route execution', async () => {
  for (const path of ['/api/create', '/api/production', '/api/auto/generate', '/api/video/export']) {
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      const response = await middleware(new NextRequest(`https://sutra.example.test${path}`, {
        method: 'POST', headers: { origin: 'https://sutra.example.test', 'content-type': contentType },
      }))
      assert.equal(response.status, 415)
    }
  }
})
test('legitimate same-origin JSON and server-to-server requests reach their route guard', async () => {
  for (const origin of ['https://sutra.example.test', '']) {
    const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' }
    if (origin) headers.origin = origin
    const response = await middleware(new NextRequest('http://localhost/api/create', { method: 'POST', headers }))
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-middleware-next'), '1')
  }
  assert.equal(authCalls, 0)
})
test('forged and repeated Suno callbacks cannot trigger parsing, DB, fetch or generation', async () => {
  // The canonical unsigned callback is deliberately a no-op, not a trusted completion source.
  mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected callback network') })
  try {
    for (let replay = 0; replay < 3; replay++) {
      const response = await sunoWebhook()
      assert.equal(response.status, 200)
      assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    }
    assert.equal((globalThis.fetch as unknown as { mock: { callCount(): number } }).mock.callCount(), 0)
  } finally { mock.restoreAll() }
})
