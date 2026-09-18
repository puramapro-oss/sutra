// -----------------------------------------------------------------------------
// Tests contractuels Shotstack — tailles réelles, horloge montage, photos,
// transitions, clamp qualité. 100% mockés (aucun appel réseau, aucun coût).
// Exécution : npm run test:api-contracts (découverte automatique).
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

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
const textResponse = (status: number, body: string) => new Response(body, { status })

async function assertThrowsWith(fn: () => Promise<unknown>, fragment: string) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof Error, `Expected Error, got ${String(err)}`)
    assert.ok(err.message.includes(fragment), `Expected "${err.message}" to contain "${fragment}"`)
    return true
  })
}

const setKey = (name: string, on: boolean) => {
  if (on) process.env[name] = 'test-key-value'
  else delete process.env[name]
}

const { assembleFinalVideo, actualQualityFor, generateSubtitlesFromScript } = await import('../src/lib/shotstack.ts')
const { MissingEnvError } = await import('../src/lib/env.ts')

const shotstackOk = () =>
  queueResponses(
    () => okJson({ response: { id: 'render-1' } }),
    () => okJson({ response: { status: 'done', url: 'https://cdn/out.mp4', duration: 42 } })
  )

// =============================================================================
// Shotstack — assembleFinalVideo (honnêteté 4K + polling)
// =============================================================================

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

