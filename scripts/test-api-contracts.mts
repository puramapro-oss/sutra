import { durableLtxJob } from '../src/lib/ltx-workflow.ts'
// Tests contractuels API — 100% mockés (succès/401/403/404/429/500/timeout/invalide/clé absente/fallback).
// Exécution : npm run test:api-contracts
import test from 'node:test'
import assert from 'node:assert/strict'

// Environnements factices AVANT les imports (des modules lisent env à l'import :
// ex. src/lib/supabase.ts construit un client browser au top-level).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test-ref.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.NEXT_PUBLIC_APP_SCHEMA ??= 'sutra'

// --- fetch mock -----------------------------------------------------------------------------

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
const okJson = (body: unknown) => jsonResponse(200, body)

// --- imports après env ----------------------------------------------------------------------

const { generateVoice, listVoices } = await import('../src/lib/elevenlabs.ts')
const { generateMusic } = await import('../src/lib/suno.ts')
const { submitVideoJob } = await import('../src/lib/runpod.ts')
const { textToVideo } = await import('../src/lib/ltx.ts')
const { searchVideos } = await import('../src/lib/pexels.ts')
const { fetchWithRetry } = await import('../src/lib/utils/api.ts')
const { generateVoiceWithFallback } = await import('../src/lib/fallbacks.ts')
const { MissingEnvError } = await import('../src/lib/env.ts')

// --- helpers ---------------------------------------------------------------------------------

async function assertThrowsWith(fn: () => Promise<unknown>, fragment: string) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof Error, `Expected Error, got ${String(err)}`)
    assert.ok(
      err.message.includes(fragment),
      `Expected "${err.message}" to contain "${fragment}"`
    )
    return true
  })
}

const setKey = (name: string, on: boolean) => {
  if (on) process.env[name] = 'test-key-value'
  else delete process.env[name]
}

// =============================================================================
// ElevenLabs — generateVoice / listVoices
// (les backoffs réels restent courts : 1-2s par retry, 5s pour la voix)
// =============================================================================

test('ElevenLabs generateVoice: succes', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => new Response(new ArrayBuffer(8), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
  const buf = await generateVoice({ text: 'salut', voice_id: 'v1' })
  assert.equal(buf.byteLength, 8)
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-speech/v1')
})

test('ElevenLabs generateVoice: 401 remonte explicitement', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => textResponse(401, 'invalid api key'))
  await assertThrowsWith(() => generateVoice({ text: 'x', voice_id: 'v1' }), '401')
})

test('ElevenLabs generateVoice: 429 non rejoue, erreur explicite', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => textResponse(429, 'rate limited'))
  await assertThrowsWith(() => generateVoice({ text: 'x', voice_id: 'v1' }), '429')
})

test('ElevenLabs generateVoice: cle absente -> erreur SUTRA_ENV_MISSING explicite', async () => {
  setKey('ELEVENLABS_API_KEY', false)
  await assert.rejects(
    () => generateVoice({ text: 'x', voice_id: 'v1' }),
    MissingEnvError
  )
})

test('ElevenLabs listVoices: 403 refuse + reponse invalide detectee', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => textResponse(403, 'forbidden'))
  await assertThrowsWith(() => listVoices(), '403')
  mockFetch(() => okJson({ unexpected: true }))
  await assertThrowsWith(() => listVoices(), 'voices')
})

// =============================================================================
// Suno — generateMusic (+ polling)
// =============================================================================

test('Suno: succes apres polling', async () => {
  setKey('SUNO_API_KEY', true)
  process.env.SUNO_API_BASE_URL = 'https://api.sunoapi.org/api/v1'
  queueResponses(
    () => okJson({ code: 200, data: { taskId: 'song-1' } }),
    () => okJson({ code: 200, data: { taskId: 'song-1', status: 'PENDING' } }),
    () => okJson({ code: 200, data: { taskId: 'song-1', status: 'SUCCESS', response: { taskId: 'song-1', sunoData: [{ id: 'song-1', audio_url: 'https://cdn/song-1.mp3' }] } } })
  )
  const song = await generateMusic({ prompt: 'beat', style: 'cinematic', duration: 30 })
  assert.equal(song.audio_url, 'https://cdn/song-1.mp3')
})

test('Suno: POST 500 = UNE SEULE tentative (pas de rejeu génératif payant)', async () => {
  setKey('SUNO_API_KEY', true)
  let attempts = 0
  mockFetch(() => {
    attempts += 1
    return jsonResponse(500, { error: 'boom' })
  })
  await assertThrowsWith(() => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }), 'soumission incertaine')
  assert.equal(attempts, 1, 'un POST de génération ne doit jamais être rejoué sans idempotence')
})

test('Suno: 401 au poll -> abandon immediat (pas de boucle 2 min)', async () => {
  setKey('SUNO_API_KEY', true)
  queueResponses(
    () => okJson({ code: 200, data: { taskId: 'song-3' } }),
    () => textResponse(403, 'forbidden')
  )
  await assertThrowsWith(
    () => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }),
    '403'
  )
})

test('Suno: reponse invalide (id absent) -> detail fournisseur expurge', async () => {
  setKey('SUNO_API_KEY', true)
  mockFetch(() => okJson({ error: 'quota exceeded' }))
  await assert.rejects(() => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.equal(error.message, 'Suno: reponse invalide (id absent ou invalide)')
    assert.ok(!error.message.includes('quota exceeded'))
    return true
  })
})

test('Suno: cle absente -> erreur explicite', async () => {
  setKey('SUNO_API_KEY', false)
  await assert.rejects(() => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }), MissingEnvError)
})

// =============================================================================
// RunPod — submitVideoJob
// =============================================================================

test('RunPod submit: succes avec jobId', async () => {
  setKey('RUNPOD_API_KEY', true)
  process.env.RUNPOD_ENDPOINT_ID = 'ep-test'
  mockFetch(() => okJson({ id: 'job-9' }))
  const { jobId } = await submitVideoJob({ prompt: 'p' })
  assert.equal(jobId, 'job-9')
})

test('RunPod submit: 401 explicite', async () => {
  setKey('RUNPOD_API_KEY', true)
  process.env.RUNPOD_ENDPOINT_ID = 'ep-test'
  mockFetch(() => textResponse(401, 'unauthorized'))
  await assertThrowsWith(() => submitVideoJob({ prompt: 'p' }), '401')
})

test('RunPod submit: reponse invalide (pas de job ID)', async () => {
  setKey('RUNPOD_API_KEY', true)
  process.env.RUNPOD_ENDPOINT_ID = 'ep-test'
  mockFetch(() => okJson({ error: 'gpu unavailable' }))
  await assertThrowsWith(() => submitVideoJob({ prompt: 'p' }), 'SUBMISSION_UNKNOWN')
})

test('RunPod: endpoint absent -> erreur explicite (pas de crash import)', async () => {
  setKey('RUNPOD_API_KEY', true)
  delete process.env.RUNPOD_ENDPOINT_ID
  await assert.rejects(() => submitVideoJob({ prompt: 'p' }), MissingEnvError)
})

// =============================================================================
// LTX — textToVideo
// =============================================================================

test('LTX: une reponse binaire V1 n\'est plus acceptee comme succes V2', async () => {
  setKey('LTX_API_KEY', true)
  mockFetch(() => new Response(new ArrayBuffer(4), { status: 200 }))
  await assert.rejects(() => textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 6, resolution: '1280x720' }, durableLtxJob({}, 'ltx', async () => {})), /SUBMISSION_UNKNOWN/)
})

test('LTX: 4xx avec corps erreur JSON -> message remonte (pas de retry sur 4xx)', async () => {
  setKey('LTX_API_KEY', true)
  mockFetch(() => jsonResponse(402, { error: { message: 'engine overloaded' } }))
  await assertThrowsWith(
    () => textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 6, resolution: '1280x720' }, durableLtxJob({}, 'ltx', async () => {})),
    'LTX_HTTP_402'
  )
  assert.equal(calls.length, 1)
})

test('LTX: cle absente -> erreur explicite', async () => {
  setKey('LTX_API_KEY', false)
  await assert.rejects(
    () => textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 6, resolution: '1280x720' }, durableLtxJob({}, 'ltx', async () => {})),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.match(err.message, /LTX_API_KEY/)
      return true
    }
  )
})

// =============================================================================
// Pexels — searchVideos (dégradation propre, format préservé)
// =============================================================================

test('Pexels searchVideos: succes + format portrait dans la requête', async () => {
  setKey('PEXELS_API_KEY', true)
  mockFetch(() =>
    okJson({
      videos: [
        {
          id: 1, url: 'https://pexels.com/v/1', duration: 8,
          user: { name: 'A', url: 'https://pexels.com/a' },
          video_files: [{ id: 2, quality: 'hd', link: 'https://cdn/v.mp4', width: 1080, height: 1920 }],
        },
      ],
    })
  )
  const results = await searchVideos('surf', 3, { format: '9:16' })
  assert.equal(results.length, 1)
  assert.equal(results[0].provider, 'pexels')
  assert.equal(results[0].authorUrl, 'https://pexels.com/a')
  assert.ok(calls[0].url.includes('orientation=portrait'))
})

test('Pexels searchVideos: 404 -> erreur explicite sans faux stock vide', async () => {
  setKey('PEXELS_API_KEY', true)
  mockFetch(() => textResponse(404, 'not found'))
  await assert.rejects(searchVideos('x', 3, { format: '16:9' }), /Pexels HTTP 404/)
})

test('Pexels searchVideos: clé absente -> erreur explicite sans appel réseau', async () => {
  setKey('PEXELS_API_KEY', false)
  mockFetch(() => { throw new Error('ne doit pas etre appele') })
  await assert.rejects(searchVideos('x', 3), MissingEnvError)
  assert.equal(calls.length, 0)
})

// =============================================================================
// fallbacks — voix : retry borné puis erreur explicite
// (fetchWithRetry + validation env : scripts/test-env-contracts.mts)
// =============================================================================

test('generateVoiceWithFallback: 500 ne soumet jamais une seconde synthese', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  queueResponses(
    () => textResponse(500, 'boom'),
    () => new Response(new ArrayBuffer(4), { status: 200 })
  )
  await assert.rejects(() => generateVoiceWithFallback('texte', 'v1'))
  assert.equal(calls.length, 1)
})

test('generateVoiceWithFallback: erreur permanente preservee sans attente ni retry', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => textResponse(401, 'invalid credentials'))
  await assertThrowsWith(() => generateVoiceWithFallback('texte', 'v1'), 'PROVIDER_RESULT_UNKNOWN')
  assert.equal(calls.length, 1)
})
