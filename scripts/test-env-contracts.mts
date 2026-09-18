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
const { estimateCost, snapLtxDuration, clampQualityToPlan, ltxCompatibleFormat } = await import('../src/lib/ltx-utils.ts')
const { resolveVoiceProviderId, VOICE_STYLES } = await import('../src/lib/constants.ts')

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

test('fetchWithRetry: POST JAMAIS rejoue sans clé idempotence (anti double facturation)', async () => {
  let submits = 0
  mockFetch(() => {
    submits += 1
    throw new Error('response lost after acceptance')
  })
  await assert.rejects(() => fetchWithRetry('https://retry-e.test/run', { method: 'POST', body: '{}' }, 3))
  assert.equal(submits, 1, 'un POST sans idempotencyKey doit faire exactement 1 tentative')
})

test('fetchWithRetry: POST AVEC clé idempotence → retries autorisés + header envoyé', async () => {
  let submits = 0
  let seenKey = ''
  mockFetch((call) => {
    submits += 1
    const headers = call.init?.headers as Record<string, string>
    seenKey = headers?.['Idempotency-Key'] ?? ''
    if (submits === 1) throw new Error('response lost')
    return jsonResponse(200, { id: 'job-ok' })
  })
  const res = await fetchWithRetry('https://retry-f.test/run', { method: 'POST', body: '{}', idempotencyKey: 'stable-key-1' }, 3)
  assert.equal(res.status, 200)
  assert.equal(submits, 2)
  assert.equal(seenKey, 'stable-key-1')
})

// --- LTX : tarifs officiels + durées admises + plafond plan ------------------

test('estimateCost: grille officielle LTX 2.3 (fast 1080p = 0.06 USD/s)', () => {
  assert.equal(estimateCost('ltx-fast', 60, '1080p'), 3.6)
  assert.equal(estimateCost('ltx-fast', 60, '4k'), 14.4)
  assert.equal(estimateCost('ltx-pro', 60, '4k'), 19.2)
  assert.equal(estimateCost('ltx-pro', 60, '1080p'), 4.8)
})

test('snapLtxDuration: durées ramenées aux valeurs admises par LTX 2.3', () => {
  // fast 1080p : 6-20s
  assert.equal(snapLtxDuration('ltx-2-3-fast', '1080p', 5), 6)
  assert.equal(snapLtxDuration('ltx-2-3-fast', '1080p', 7), 8)
  assert.equal(snapLtxDuration('ltx-2-3-fast', '1080p', 30), 20)
  // pro / 4k : 6-10s uniquement
  assert.equal(snapLtxDuration('ltx-2-3-pro', '4k', 12), 10)
  assert.equal(snapLtxDuration('ltx-2-3-fast', '4k', 9), 10)
})

test('ltxCompatibleFormat: le carré part en 16:9 (recadré au montage)', () => {
  assert.equal(ltxCompatibleFormat('1:1'), '16:9')
  assert.equal(ltxCompatibleFormat('9:16'), '9:16')
  assert.equal(ltxCompatibleFormat('16:9'), '16:9')
})

test('clampQualityToPlan: starter demandant 4k → 720p AVANT tout appel payant', () => {
  assert.equal(clampQualityToPlan('4k', 'starter'), '720p')
  assert.equal(clampQualityToPlan('4k', 'empire'), '4k')
  assert.equal(clampQualityToPlan('1080p', 'creator'), '1080p')
  assert.equal(clampQualityToPlan('4k', 'creator'), '1080p')
})

// --- Voix : alias → ID ElevenLabs réel ----------------------------------------

test('resolveVoiceProviderId: jamais un alias brut vers l\'API TTS', () => {
  for (const style of VOICE_STYLES) {
    const resolved = resolveVoiceProviderId(style.id)
    assert.notEqual(resolved, style.id, `l'alias ${style.id} ne doit pas partir brut vers ElevenLabs`)
    assert.ok(resolved.length >= 16, `ID fournisseur attendu pour ${style.id}`)
  }
  assert.equal(resolveVoiceProviderId('default_french_female'), 'EXAVITQu4vr4xnSDxMaL')
  // ID déjà réel → transmis tel quel ; alias inconnu → défaut, jamais brut
  assert.equal(resolveVoiceProviderId('averylongprovidervoiceid123'), 'averylongprovidervoiceid123')
  assert.equal(resolveVoiceProviderId('rachel'), 'EXAVITQu4vr4xnSDxMaL')
  assert.equal(resolveVoiceProviderId(null), 'EXAVITQu4vr4xnSDxMaL')
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
