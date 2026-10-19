import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { MusicProviderJobError } from '../../src/lib/music-provider-job.ts'
let waits: number[] = []
mock.module('../../src/lib/utils/api.ts', { namedExports: { sleep: async (ms: number) => { waits.push(ms) } } })
const { generateStableAudio } = await import('../../src/lib/stable-audio.ts')
const { generateRiffusionMusic } = await import('../../src/lib/riffusion.ts')
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
test.beforeEach(() => {
  waits = []
  process.env.REPLICATE_API_TOKEN = 'synthetic-contract-only'
  process.env.RIFFUSION_API_KEY = 'synthetic-contract-only'
})
test.afterEach(() => mock.restoreAll())

test('Stable Audio: processing output cannot become completed media', async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async () => { calls++; return json({ id: 'fixture-job', status: 'processing', output: 'https://media.invalid/partial.wav' }) })
  await assert.rejects(generateStableAudio({ prompt: 'fixture' }))
  assert.equal(calls, 1, 'never resubmit an uncertain paid job')
})
test('Stable Audio: response diagnostics never escape', async () => {
  mock.method(globalThis, 'fetch', async () => json({ diagnostic: 'PRIVATE_BODY_MARKER' }, 401))
  await assert.rejects(generateStableAudio({ prompt: 'fixture' }), (error: Error) => {
    assert.doesNotMatch(error.message, /PRIVATE_BODY_MARKER/); return true
  })
})
test('Riffusion: documented nested completion returns the first track', async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? json({ request_id: 'fixture-job', status: 'pending' })
    : json({ request_id: 'fixture-job', status: 'complete', audio_url: '', data: { task_id: 'fixture-job', status: 'complete', data: [{ stream_audio_url: 'https://media.invalid/final.mp3', title: 'Fixture' }] } }))
  assert.equal((await generateRiffusionMusic({ prompt: 'fixture' })).audio_url, 'https://media.invalid/final.mp3')
  assert.equal(calls, 2)
  assert.deepEqual(waits, [13_000], 'per-job requests respect the documented 5/minute tier')
})

for (const status of ['starting', 'processing', 'failed', 'canceled', 'unexpected']) test(`Stable Audio: ${status} retains identity without accepting output`, async () => {
  mock.method(globalThis, 'fetch', async () => json({ id: 'fixture-job', status, output: 'https://media.invalid/audio.wav', error: 'PRIVATE_BODY_MARKER' }))
  await assert.rejects(generateStableAudio({ prompt: 'fixture' }), (error: unknown) => { assert.ok(error instanceof MusicProviderJobError);
    assert.equal(error.jobId, 'fixture-job'); assert.equal(error.remoteStatus, status === 'unexpected' ? 'unknown' : status)
    assert.equal(error.retrySubmission, false); assert.equal(error.fallbackAllowed, false)
    assert.equal(error.cost.actual, null); assert.doesNotMatch(error.message, /PRIVATE_BODY_MARKER/); return true
  })
})
test('Stable Audio: terminal success checks contract and retains identity', async () => {
  mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(String(url), 'https://api.replicate.com/v1/models/stability-ai/stable-audio-2.5/predictions')
    assert.equal(init?.redirect, 'error'); assert.equal(init?.cache, 'no-store'); assert.ok(init?.signal)
    assert.equal(new Headers(init?.headers).get('Prefer'), 'wait=60')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer synthetic-contract-only')
    assert.deepEqual(JSON.parse(String(init?.body)), { input: { prompt: 'fixture', duration: 30 } })
    return json({ id: 'fixture-job', status: 'succeeded', output: ['https://media.invalid/audio.wav'] })
  })
  assert.deepEqual(await generateStableAudio({ prompt: 'fixture' }), { id: 'fixture-job', provider: 'stable-audio', audio_url: 'https://media.invalid/audio.wav' })
})
for (const duration of [0, 191, 1.5, NaN]) test(`Stable Audio: invalid duration ${duration} never submits`, async () => {
  mock.method(globalThis, 'fetch', async () => assert.fail('network forbidden'))
  await assert.rejects(generateStableAudio({ prompt: 'fixture', duration }), /INVALID_REQUEST/)
})
for (const output of [null, {}, 'http://media.invalid/file', 'https://user:password@media.invalid/file']) test(`Stable Audio: malformed output ${JSON.stringify(output)} fails closed`, async () => {
  mock.method(globalThis, 'fetch', async () => json({ id: 'fixture-job', status: 'succeeded', output }))
  await assert.rejects(generateStableAudio({ prompt: 'fixture' }), { code: 'INVALID_RESPONSE', jobId: 'fixture-job' })
})
for (const [provider, run] of [['stable-audio', () => generateStableAudio({ prompt: 'fixture' })], ['riffusion', () => generateRiffusionMusic({ prompt: 'fixture' })]] as const) {
  for (const status of [401, 403, 429, 500]) test(`${provider}: HTTP ${status} stops after one submission without diagnostics`, async () => {
    const stub = mock.method(globalThis, 'fetch', async () => json({ error: 'PRIVATE_BODY_MARKER' }, status))
    await assert.rejects(run(), (error: unknown) => { assert.ok(error instanceof MusicProviderJobError);
      assert.equal(error.httpStatus, status); assert.equal(error.jobId, null); assert.equal(error.retrySubmission, false)
      assert.doesNotMatch(error.message, /PRIVATE_BODY_MARKER/); return true
    })
    assert.equal(stub.mock.callCount(), 1)
  })
  test(`${provider}: malformed/oversized/transport response is bounded and sanitized`, async () => {
    for (const response of [() => new Response('{'), () => json([]), () => new Response('{}', { headers: { 'content-length': '70000' } }), () => { throw new Error('PRIVATE_BODY_MARKER') }]) {
      const stub = mock.method(globalThis, 'fetch', async () => response())
      await assert.rejects(run(), (error: unknown) => { assert.ok(error instanceof MusicProviderJobError); assert.equal(error.retrySubmission, false); assert.doesNotMatch(error.message, /PRIVATE_BODY_MARKER/); return true })
      assert.equal(stub.mock.callCount(), 1); stub.mock.restore()
    }
  })
  test(`${provider}: a hanging response body consumes the same deadline`, async () => {
    mock.method(AbortSignal, 'timeout', () => {
      const controller = new AbortController(); setTimeout(() => controller.abort(), 15); return controller.signal
    })
    mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ start() {} })))
    await assert.rejects(run(), { code: 'TRANSPORT_OR_TIMEOUT', retrySubmission: false })
  })
}
for (const status of [401, 429, 500]) test(`Riffusion: poll HTTP ${status} preserves the accepted job and never resubmits`, async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    assert.equal(init?.redirect, 'error')
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'synthetic-contract-only')
    if (++calls === 1) return json({ request_id: 'fixture-job', status: 'pending' })
    assert.deepEqual(JSON.parse(String(init?.body)), { request_id: 'fixture-job' })
    return json({ error: 'PRIVATE_BODY_MARKER' }, status)
  })
  await assert.rejects(generateRiffusionMusic({ prompt: 'fixture' }), { jobId: 'fixture-job', httpStatus: status, retrySubmission: false })
  assert.equal(calls, 2)
})
for (const response of [
  { status: 'unknown' }, { status: 'failed', error: 'PRIVATE_BODY_MARKER' },
  { status: 'complete', request_id: 'other-job', audio_url: 'https://media.invalid/song.mp3' },
  { status: 'complete', data: { task_id: 'other-job', data: [{ stream_audio_url: 'https://media.invalid/song.mp3' }] } },
  { status: 'complete', audio_url: 'http://media.invalid/song.mp3' },
]) test(`Riffusion: invalid/failed completion stays explicit ${JSON.stringify(response)}`, async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async () => ++calls === 1 ? json({ request_id: 'fixture-job', status: 'pending' }) : json(response))
  await assert.rejects(generateRiffusionMusic({ prompt: 'fixture' }), (error: unknown) => { assert.ok(error instanceof MusicProviderJobError);
    assert.equal(error.jobId, 'fixture-job'); assert.equal(error.retrySubmission, false); assert.doesNotMatch(error.message, /PRIVATE_BODY_MARKER/); return true
  })
  assert.equal(calls, 2)
})
test('Riffusion: legacy flat completion remains supported', async () => {
  let calls = 0
  mock.method(globalThis, 'fetch', async () => ++calls === 1 ? json({ request_id: 'fixture-job', status: 'pending' })
    : json({ status: 'complete', data: { stream_audio_url: 'https://media.invalid/song.mp3', title: 'Fixture' } }))
  assert.equal((await generateRiffusionMusic({ prompt: 'fixture' })).id, 'fixture-job')
})

test('Riffusion: deadline after acceptance retains the job for reconciliation', async () => {
  const realTimeout = AbortSignal.timeout.bind(AbortSignal)
  mock.method(AbortSignal, 'timeout', (ms: number) => {
    if (ms !== 180_000) return realTimeout(ms)
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 15)
    return controller.signal
  })
  let calls = 0
  mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? json({ request_id: 'fixture-job', status: 'pending' })
    : new Response(new ReadableStream({ start() {} })))
  await assert.rejects(generateRiffusionMusic({ prompt: 'fixture' }), {
    code: 'TRANSPORT_OR_TIMEOUT', jobId: 'fixture-job', remoteStatus: 'pending', retrySubmission: false, fallbackAllowed: false,
  })
  assert.equal(calls, 2)
})
