import assert from 'node:assert/strict'
import { after, mock, test } from 'node:test'

const originalFetch = globalThis.fetch
const originalError = console.error
const names = ['PEXELS_API_KEY', 'PIXABAY_API_KEY', 'UNSPLASH_ACCESS_KEY', 'COVERR_API_KEY']
const previous = names.map(name => process.env[name])
names.forEach(name => { delete process.env[name] })
process.env.PEXELS_API_KEY = 'fixture-only-key'
let signedIn = true
let calls = 0
const messages: string[] = []
console.error = (...args: unknown[]) => { messages.push(args.map(String).join(' ')) }
globalThis.fetch = async () => { calls++; return new Response('SECRET_ECHO_DO_NOT_LOG', { status: 401 }) }
mock.module('../../src/lib/supabase-server.ts', { namedExports: {
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'fixture-user' } : null }, error: null }) } }),
} })
const { POST } = await import('../../src/app/api/stock/search/route.ts')
const request = () => new Request('https://sutra.fixture.invalid/api/stock/search', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'nature', type: 'photo' }),
})
after(() => {
  globalThis.fetch = originalFetch; console.error = originalError; mock.restoreAll()
  names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i] })
})

test('real stock route reports provider failure as HTTP 500 without raw response or key', async () => {
  const response = await POST(request())
  assert.equal(response.status, 500)
  assert.equal(calls, 1)
  const body = await response.json()
  assert.equal(body.error, 'Erreur lors de la recherche stock')
  assert.match(messages.join('\n'), /STOCK_SEARCH_FAILED:pexels:photos:HTTP_401/)
  assert.doesNotMatch(JSON.stringify(body) + messages.join('\n'), /SECRET_ECHO|fixture-only-key/)
})

test('real stock route still rejects anonymous caller before any catalogue call', async () => {
  signedIn = false
  const before = calls
  assert.equal((await POST(request())).status, 401)
  assert.equal(calls, before)
})

test('real stock route preserves valid empty catalogue HTTP 200', async () => {
  signedIn = true
  globalThis.fetch = async () => Response.json({ photos: [] })
  const response = await POST(request())
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { results: [], count: 0 })
})
