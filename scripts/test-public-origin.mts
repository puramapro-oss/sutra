import test, { mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }

let authenticated = false
let exchange: 'ok' | 'error' | 'throw' = 'ok'
const jar = new Map<string, string>()
mock.module('next/headers', { namedExports: { cookies: async () => ({
  getAll: () => [], get: () => undefined, set: (name: string, value: string) => jar.set(name, value),
}) } })
mock.module('@supabase/ssr', { namedExports: {
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (items: object[]) => void } }) => ({
    auth: {
      getUser: async () => {
        options.cookies.setAll([{ name: 'synthetic-refresh', value: 'refreshed', options: { httpOnly: true } }])
        return { data: { user: authenticated ? { id: 'synthetic-user' } : null }, error: null }
      },
      exchangeCodeForSession: async () => {
        if (exchange === 'throw') throw new Error('synthetic-error')
        if (exchange === 'ok') options.cookies.setAll([{ name: 'synthetic-session', value: 'session', options: {} }])
        return { error: exchange === 'error' ? new Error('synthetic-error') : null }
      },
    },
    from: () => ({ select: () => ({ eq: () => ({
      maybeSingle: async () => ({ data: { id: 'synthetic-user', subscription_status: 'active' }, error: null }),
      single: async () => ({ data: null, error: null }),
    }) }) }),
  }),
} })
const { middleware } = await import('../src/middleware.ts')
const { GET: callback } = await import('../src/app/auth/callback/route.ts')
const { publicOrigin } = await import('../src/lib/public-origin.ts')
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://sutra.example'
  delete process.env.NEXT_PUBLIC_SITE_URL
  authenticated = false; exchange = 'ok'; jar.clear()
})
const internal = 'http://0.0.0.0:3000'
const spoofed = { 'x-forwarded-host': 'evil.invalid', 'x-forwarded-proto': 'https', host: 'evil.invalid' }

test('public origin validates configuration, honors precedence and retains local development', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://site.example'
  assert.equal(publicOrigin(internal), 'https://sutra.example')
  delete process.env.NEXT_PUBLIC_APP_URL
  assert.equal(publicOrigin(internal), 'https://site.example')
  delete process.env.NEXT_PUBLIC_SITE_URL
  assert.equal(publicOrigin('http://localhost:3000/login'), 'http://localhost:3000')
  for (const invalid of ['invalid', 'javascript:alert(1)', 'https://user:pass@host.invalid', 'https://host.invalid/path', 'https://host.invalid/?query', 'https://host.invalid/#hash']) {
    process.env.NEXT_PUBLIC_APP_URL = invalid
    assert.throws(() => publicOrigin(internal), /^Error: Invalid public application origin$/)
  }
})

test('OVH callback missing code uses canonical origin despite forwarded host', async () => {
  const response = await callback(new Request(`${internal}/auth/callback?next=https://evil.invalid`, { headers: spoofed }))
  assert.equal(response.headers.get('location'), 'https://sutra.example/login?error=missing_code')
})
test('OVH callback failures use canonical origin and never expose errors', async () => {
  for (const failure of ['error', 'throw'] as const) {
    exchange = failure
    const response = await callback(new Request(`${internal}/auth/callback?code=synthetic`, { headers: spoofed }))
    assert.equal(response.headers.get('location'), 'https://sutra.example/login?error=callback_failed')
  }
})
test('OVH callback success retains safe next and session cookies', async () => {
  for (const [next, expected] of [['/studio?tab=projects', '/studio?tab=projects'], ['//evil.invalid', '/dashboard']]) {
    const response = await callback(new Request(`${internal}/auth/callback?code=synthetic&next=${encodeURIComponent(next)}`, { headers: spoofed }))
    assert.equal(response.headers.get('location'), `https://sutra.example${expected}`)
    assert.equal(jar.get('synthetic-session'), 'session')
  }
})
test('OVH mutating APIs accept only canonical browser origin, retaining originless API support', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const [origin, expected] of [['https://sutra.example', 200], ['', 200], [internal, 403], ['https://evil.invalid', 403], ['null', 403]] as const) {
      const headers = { ...spoofed, ...(origin ? { origin } : {}) }
      const response = await middleware(new NextRequest(`${internal}/api/social/connect`, { method, headers }))
      assert.equal(response.status, expected, `${method} ${origin}`)
    }
  }
})
test('OVH protected-page redirects preserve path, query and refreshed cookies', async () => {
  const response = await middleware(new NextRequest(`${internal}/studio?tab=projects`, { headers: spoofed }))
  const target = new URL(response.headers.get('location')!)
  assert.equal(target.origin, 'https://sutra.example'); assert.equal(target.pathname, '/login')
  assert.equal(target.searchParams.get('next'), '/studio?tab=projects')
  assert.equal(response.cookies.get('synthetic-refresh')?.value, 'refreshed')
})
test('OVH authenticated and denied-role redirects use canonical origin', async () => {
  authenticated = true
  for (const [path, expected] of [['/login?next=/studio', '/studio'], ['/admin', '/dashboard'], ['/influencer', '/devenir-influenceur']]) {
    const response = await middleware(new NextRequest(`${internal}${path}`, { headers: spoofed }))
    assert.equal(response.headers.get('location'), `https://sutra.example${expected}`)
    assert.equal(response.cookies.get('synthetic-refresh')?.value, 'refreshed')
  }
})
