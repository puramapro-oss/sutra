// -----------------------------------------------------------------------------
// Tests contractuels API — 100% mockés (aucun appel réseau réel, aucun coût).
// Couverture par scénario : succès, 401, 403, 404, 429, 500, timeout,
// réponse invalide, clé absente, fallback.
//
// Exécution : npm run test:api-contracts  (node --import tsx --test)
// -----------------------------------------------------------------------------
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
const { assembleFinalVideo, actualQualityFor, generateSubtitlesFromScript } = await import('../src/lib/shotstack.ts')
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
  mockFetch(() => new Response(new ArrayBuffer(8), { status: 200 }))
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
  process.env.SUNO_BASE_URL = 'https://suno.test/v1'
  queueResponses(
    () => okJson({ id: 'song-1' }),
    () => okJson({ id: 'song-1', status: 'pending' }),
    () => okJson({ id: 'song-1', status: 'completed', audio_url: 'https://cdn/song-1.mp3' })
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
  await assertThrowsWith(() => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }), 'Echec apres 1')
  assert.equal(attempts, 1, 'un POST de génération ne doit jamais être rejoué sans idempotence')
})

test('Suno: 401 au poll -> abandon immediat (pas de boucle 2 min)', async () => {
  setKey('SUNO_API_KEY', true)
  queueResponses(
    () => okJson({ id: 'song-3' }),
    () => textResponse(403, 'forbidden')
  )
  await assertThrowsWith(
    () => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }),
    '403'
  )
})

test('Suno: reponse invalide (id absent) -> detail fournisseur remonte', async () => {
  setKey('SUNO_API_KEY', true)
  mockFetch(() => okJson({ error: 'quota exceeded' }))
  await assertThrowsWith(() => generateMusic({ prompt: 'x', style: 'lo-fi', duration: 20 }), 'quota exceeded')
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
  await assertThrowsWith(() => submitVideoJob({ prompt: 'p' }), 'gpu unavailable')
})

test('RunPod: endpoint absent -> erreur explicite (pas de crash import)', async () => {
  setKey('RUNPOD_API_KEY', true)
  delete process.env.RUNPOD_ENDPOINT_ID
  await assert.rejects(() => submitVideoJob({ prompt: 'p' }), MissingEnvError)
})

// =============================================================================
// Shotstack — assembleFinalVideo (honnêteté 4K + polling)
// =============================================================================

const shotstackOk = () =>
  queueResponses(
    () => okJson({ response: { id: 'render-1' } }),
    () => okJson({ response: { status: 'done', url: 'https://cdn/out.mp4', duration: 42 } })
  )

test('Shotstack: succes — tailles réelles par qualité (4k = 2160×3840, pas 720)', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  shotstackOk()
  const res = await assembleFinalVideo({
    clips: [{ url: 'https://cdn/a.mp4', type: 'ia' }],
    voiceUrl: 'https://cdn/v.mp3',
    musicUrl: '',
    musicVolume: 0.3,
    subtitles: [],
    transitions: 'fade',
    format: '9:16',
    quality: '4k',
    brandKit: null,
  })
  assert.equal(res.outputQuality, 'hd')
  assert.equal(res.url, 'https://cdn/out.mp4')
  // format + qualité réellement demandés au montage (audit #1)
  const body = JSON.parse(String(calls[0].init?.body))
  assert.deepEqual(body.output.size, { width: 2160, height: 3840 })
  // le clamp 4k→1080p quand le stage rend en HD
  assert.equal(actualQualityFor('4k', res.outputQuality), '1080p')
  assert.equal(actualQualityFor('1080p', 'hd'), '1080p')
})

test('Shotstack: 1080p 16:9 exporte en 1920×1080', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  shotstackOk()
  await assembleFinalVideo({
    clips: [{ url: 'https://cdn/a.mp4', type: 'ia' }],
    voiceUrl: 'https://cdn/v.mp3',
    musicUrl: '',
    musicVolume: 0.3,
    subtitles: [],
    transitions: 'fade',
    format: '16:9',
    quality: '1080p',
    brandKit: null,
  })
  const body = JSON.parse(String(calls[0].init?.body))
  assert.deepEqual(body.output.size, { width: 1920, height: 1080 })
})

test('Shotstack: horloge de montage — intro décale voix et sous-titres, durées par clip', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  shotstackOk()
  const subtitles = generateSubtitlesFromScript('a b c d e f g h i j k l', [
    { duration_seconds: 10 },
    { duration_seconds: 10 },
  ])
  await assembleFinalVideo({
    clips: [
      { url: 'https://cdn/1.mp4', type: 'ia', duration: 10 },
      { url: 'https://cdn/2.mp4', type: 'ia', duration: 10 },
    ],
    voiceUrl: 'https://cdn/v.mp3',
    musicUrl: '',
    musicVolume: 0.3,
    subtitles,
    transitions: 'fade',
    format: '16:9',
    quality: '1080p',
    brandKit: { intro_template: 'intro.mp4', outro_template: 'outro.mp4' },
  })
  const body = JSON.parse(String(calls[0].init?.body))
  const [videoTrack, voiceTrack, subTrack] = body.timeline.tracks
  const end = (t: { clips: Array<{ start: number; length: number }> }) =>
    Math.max(...t.clips.map((c) => c.start + c.length))
  // images : 3 + 10 + 10 + 3 = 26s
  assert.equal(end(videoTrack), 26)
  // voix : démarre APRÈS l'intro (3s) et couvre le corps
  assert.equal(voiceTrack.clips[0].start, 3)
  // sous-titres : décalés de l'intro et bornés à la fin du montage
  assert.equal(subTrack.clips[0].start, 3)
  assert.ok(end(subTrack) <= 26, `sous-titres débordent : ${end(subTrack)}`)
})

test('Shotstack: une PHOTO devient un asset image, pas vidéo', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  shotstackOk()
  await assembleFinalVideo({
    clips: [{ url: 'https://cdn/photo.jpg', type: 'stock', kind: 'photo', duration: 5 }],
    voiceUrl: 'https://cdn/v.mp3',
    musicUrl: '',
    musicVolume: 0.3,
    subtitles: [],
    transitions: 'fade',
    format: '16:9',
    quality: '1080p',
    brandKit: null,
  })
  const body = JSON.parse(String(calls[0].init?.body))
  const asset = body.timeline.tracks[0].clips[0].asset
  assert.equal(asset.type, 'image')
  assert.equal(asset.src, 'https://cdn/photo.jpg')
})

test('Shotstack: transition fade demandée = fade appliquée (pas none)', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  shotstackOk()
  await assembleFinalVideo({
    clips: [{ url: 'https://cdn/a.mp4', type: 'ia' }],
    voiceUrl: 'https://cdn/v.mp3',
    musicUrl: '',
    musicVolume: 0.3,
    subtitles: [],
    transitions: 'fade',
    format: '16:9',
    quality: '1080p',
    brandKit: null,
  })
  const body = JSON.parse(String(calls[0].init?.body))
  assert.equal(body.timeline.tracks[0].clips[0].transition.in, 'fade')
})

test('Shotstack: 429 au submit -> erreur explicite', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  mockFetch(() => textResponse(429, 'too many renders'))
  await assertThrowsWith(
    () =>
      assembleFinalVideo({
        clips: [], voiceUrl: 'u', musicUrl: '', musicVolume: 0.3,
        subtitles: [], transitions: 'fade', format: '16:9', quality: '1080p', brandKit: null,
      }),
    '429'
  )
})

test('Shotstack: rendu failed -> erreur explicite', async () => {
  setKey('SHOTSTACK_API_KEY', true)
  queueResponses(
    () => okJson({ response: { id: 'render-2' } }),
    () => okJson({ response: { status: 'failed', error: 'asset introuvable' } })
  )
  await assertThrowsWith(
    () =>
      assembleFinalVideo({
        clips: [], voiceUrl: 'u', musicUrl: '', musicVolume: 0.3,
        subtitles: [], transitions: 'fade', format: '16:9', quality: '1080p', brandKit: null,
      }),
    'echoue'
  )
})

test('Shotstack: cle absente -> erreur explicite', async () => {
  setKey('SHOTSTACK_API_KEY', false)
  await assert.rejects(
    () =>
      assembleFinalVideo({
        clips: [], voiceUrl: 'u', musicUrl: '', musicVolume: 0.3,
        subtitles: [], transitions: 'fade', format: '16:9', quality: '1080p', brandKit: null,
      }),
    MissingEnvError
  )
})

// =============================================================================
// LTX — textToVideo
// =============================================================================

test('LTX: succes binaire', async () => {
  setKey('LTX_API_KEY', true)
  mockFetch(() => new Response(new ArrayBuffer(4), { status: 200 }))
  const buf = await textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 5, resolution: '1280x720' })
  assert.equal(buf.byteLength, 4)
})

test('LTX: 4xx avec corps erreur JSON -> message remonte (pas de retry sur 4xx)', async () => {
  setKey('LTX_API_KEY', true)
  mockFetch(() => jsonResponse(402, { error: { message: 'engine overloaded' } }))
  await assertThrowsWith(
    () => textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 5, resolution: '1280x720' }),
    'engine overloaded'
  )
  assert.equal(calls.length, 1)
})

test('LTX: cle absente -> erreur explicite', async () => {
  setKey('LTX_API_KEY', false)
  await assert.rejects(
    () => textToVideo({ prompt: 'p', model: 'ltx-2-3-fast', duration: 5, resolution: '1280x720' }),
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

test('Pexels searchVideos: 404 -> liste vide (dégradation propre)', async () => {
  setKey('PEXELS_API_KEY', true)
  mockFetch(() => textResponse(404, 'not found'))
  const results = await searchVideos('x', 3, { format: '16:9' })
  assert.deepEqual(results, [])
})

test('Pexels searchVideos: clé absente -> liste vide sans appel réseau', async () => {
  setKey('PEXELS_API_KEY', false)
  mockFetch(() => { throw new Error('ne doit pas etre appele') })
  const results = await searchVideos('x', 3)
  assert.deepEqual(results, [])
  assert.equal(calls.length, 0)
})

// =============================================================================
// fallbacks — voix : retry borné puis erreur explicite
// (fetchWithRetry + validation env : scripts/test-env-contracts.mts)
// =============================================================================

test('generateVoiceWithFallback: echec puis succes (1 retry)', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  // POST = tentative unique par appel : 1er appel → 500, retry externe → 200
  queueResponses(
    () => textResponse(500, 'boom'),
    () => new Response(new ArrayBuffer(4), { status: 200 })
  )
  const buf = await generateVoiceWithFallback('texte', 'v1')
  assert.equal(buf.byteLength, 4)
})

test('generateVoiceWithFallback: tout echoue -> erreur explicite "2 tentatives"', async () => {
  setKey('ELEVENLABS_API_KEY', true)
  mockFetch(() => textResponse(500, 'down'))
  await assertThrowsWith(() => generateVoiceWithFallback('texte', 'v1'), '2 tentatives')
})
