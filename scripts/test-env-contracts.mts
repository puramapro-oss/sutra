// -----------------------------------------------------------------------------
// Tests contractuels — couche HTTP (fetchWithRetry) + validation env.
// 100% mockés. Exécution : npm run test:api-contracts (découvert via --test).
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'

type FetchCall = { url: string; init?: RequestInit }
let calls: FetchCall[] = []

function mockFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  calls = []
  ;(globalThis as Record<string, unknown>).fetch = (url: string | URL, init?: RequestInit) => {
    const call = { url: String(url), init }
    calls.push(call)
    return handler(call)
  }
}

function queueResponses(...responses: Array<() => Response>) {
  mockFetch(() => {
    const next = responses.shift()
    if (!next) throw new Error('mock: file de réponses vide')
    return next()
  })
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const textResponse = (status: number, body: string) => new Response(body, { status })

const { fetchWithRetry } = await import('../src/lib/utils/api.ts')
const { requireEnv, isEnvSet, MissingEnvError, providerConfigStatus, PROVIDERS } = await import('../src/lib/env.ts')

async function assertThrowsWith(fn: () => Promise<unknown>, fragment: string) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof Error, `Expected Error, got ${String(err)}`)
    assert.ok(err.message.includes(fragment), `Expected "${err.message}" to contain "${fragment}"`)
    return true
  })
}

// --- fetchWithRetry -----------------------------------------------------------

test('fetchWithRetry: 500 x2 puis 200 -> succes (retry borne)', async () => {
  queueResponses(
    () => jsonResponse(500, {}),
    () => jsonResponse(500, {}),
    () => jsonResponse(200, { ok: true })
  )
  const res = await fetchWithRetry('https://retry-a.test/endpoint', {}, 3)
  assert.equal(res.status, 200)
  assert.equal(calls.length, 3)
})

test('fetchWithRetry: 404 jamais rejoue (retour immediat)', async () => {
  queueResponses(() => textResponse(404, 'nope'))
  const res = await fetchWithRetry('https://retry-b.test/404', {}, 3)
  assert.equal(res.status, 404)
  assert.equal(calls.length, 1)
})

test('fetchWithRetry: 429 non rejoue (retour immediat, consommateur decide)', async () => {
  queueResponses(() => textResponse(429, 'slow down'))
  const res = await fetchWithRetry('https://retry-c.test/429', {}, 3)
  assert.equal(res.status, 429)
  assert.equal(calls.length, 1)
})

test('fetchWithRetry: erreur reseau apres retries -> echec enregistre', async () => {
  mockFetch(() => { throw new Error('network down') })
  await assertThrowsWith(() => fetchWithRetry('https://retry-d.test/down', {}, 2), 'network down')
})

// --- env.ts -------------------------------------------------------------------

test('env: requireEnv message explicite (nom + .env.local), sans valeur', () => {
  delete process.env.SUNO_API_KEY
  try {
    requireEnv('SUNO_API_KEY', 'test')
    assert.fail('devrait throw')
  } catch (err) {
    assert.ok(err instanceof MissingEnvError)
    assert.ok(err.message.includes('SUNO_API_KEY'))
    assert.ok(err.message.includes('.env.local'))
  }
})

test('env: providerConfigStatus ne divulgue aucune valeur', () => {
  process.env.PIXABAY_API_KEY = 'secret-value-ne-doive-pas-apparaitre'
  const status = providerConfigStatus('pixabay')
  assert.equal(status.configured, true)
  assert.ok(!JSON.stringify(status).includes('secret-value-ne-doive-pas-apparaitre'))
  delete process.env.PIXABAY_API_KEY
  const after = providerConfigStatus('pixabay')
  assert.equal(after.configured, false)
  assert.deepEqual(after.missing, ['PIXABAY_API_KEY'])
})

test('env: isEnvSet ignore les valeurs vides', () => {
  process.env.SUNO_API_KEY = '   '
  assert.equal(isEnvSet('SUNO_API_KEY'), false)
  delete process.env.SUNO_API_KEY
})

test('env: inventaire providers couvre les fournisseurs attendus', () => {
  const ids = Object.keys(PROVIDERS)
  for (const expected of ['supabase', 'stripe', 'anthropic', 'ltx', 'runpod', 'shotstack', 'elevenlabs', 'suno', 'pexels', 'pixabay', 'unsplash', 'coverr', 'resend', 'upstash']) {
    assert.ok(ids.includes(expected), `PROVIDERS doit inclure ${expected}`)
  }
  // Aucun provider générateur (coût) ne doit exposer de probe
  for (const id of ['ltx', 'runpod', 'shotstack', 'elevenlabs', 'suno', 'anthropic'] as const) {
    assert.equal(PROVIDERS[id].probe, false, `${id} ne doit pas avoir de sonde (payant)`)
  }
})
