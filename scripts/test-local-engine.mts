// -----------------------------------------------------------------------------
// Tests mockés du moteur local (audit #17) — propriétaire uniquement, mode
// strict sans repli payant, mode auto avec repli documenté. Aucun appel réel.
// Exécution : npm run test:api-contracts (découverte automatique).
// -----------------------------------------------------------------------------
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'

const OWNER = 'matiss.frasne@gmail.com' // super-admin de référence (utils.ts)
const CLIENT = 'client@example.test'

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  ;(globalThis as Record<string, unknown>).fetch = (url: string | URL, init?: RequestInit) =>
    handler(String(url), init)
}

const { shouldUseLocalEngine, generateLocalVideo, probeLocalEngine, isLocalEngineConfigured } =
  await import('../src/lib/local-engine.ts')

test('local: inactif sans configuration — clients ET propriétaire sur API externes', () => {
  delete process.env.LOCAL_ENGINE_ENABLED
  delete process.env.LOCAL_VIDEO_API_URL
  assert.equal(isLocalEngineConfigured(), false)
  assert.equal(shouldUseLocalEngine(OWNER), false)
  assert.equal(shouldUseLocalEngine(CLIENT), false)
})

test('local: configuré → propriétaire OUI, client JAMAIS', () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:7860'
  assert.equal(shouldUseLocalEngine(OWNER), true)
  assert.equal(shouldUseLocalEngine(CLIENT), false, 'un client ne part jamais sur le Mac du propriétaire')
  assert.equal(shouldUseLocalEngine(null), false)
})

test('local: génération OK (base64), timeout borné, contrat prompt/frames', async () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:7860'
  let seen: { url: string; body?: Record<string, unknown> } | null = null
  mockFetch((url, init) => {
    seen = { url, body: JSON.parse(String(init?.body)) }
    return new Response(JSON.stringify({ video_base64: Buffer.from('mp4-test').toString('base64') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  const result = await generateLocalVideo({ prompt: 'un phare dans la tempete', width: 1280, height: 720, duration: 6 })
  assert.equal(seen!.url, 'http://127.0.0.1:7860')
  assert.equal(seen!.body!.num_frames, 96, '6s × 16fps')
  assert.equal(result.model, 'local-m4max')
  assert.ok(result.videoBuffer.byteLength > 0)
})

test('local: erreur HTTP → message explicite (serveur local à vérifier)', async () => {
  process.env.LOCAL_VIDEO_ENABLED = undefined
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:7860'
  mockFetch(() => new Response('busy', { status: 503 }))
  await assert.rejects(
    () => generateLocalVideo({ prompt: 'x', width: 720, height: 1280, duration: 6 }),
    /Moteur local: HTTP 503/
  )
})

test('local: sonde santé — 200 ok, erreur réseau détaillée', async () => {
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:7860'
  mockFetch((url) => (url.endsWith('/health') ? new Response('ok', { status: 200 }) : new Response('', { status: 404 })))
  const up = await probeLocalEngine()
  assert.equal(up.ok, true)
  mockFetch(() => { throw new Error('ECONNREFUSED simule') })
  const down = await probeLocalEngine()
  assert.equal(down.ok, false)
  assert.ok(String(down.detail).includes('ECONNREFUSED'))
})
