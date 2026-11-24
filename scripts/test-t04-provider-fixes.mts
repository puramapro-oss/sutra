import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createSaladWorker, type RuntimeInspection, type WorkerPorts } from '../src/lib/salad/worker.ts'
import { createSaladClient } from '../src/lib/salad/client.ts'
import { MODEL, sha256, identity, type DurableJournal, type Job, type VideoInput } from '../src/lib/salad/contracts.ts'
import type { Fetcher } from '../src/lib/salad/http.ts'
import { pollVideoJob, submitVideoJob, RunpodJobError } from '../src/lib/runpod.ts'
import { generateMusic, SunoJobError } from '../src/lib/suno.ts'
import { providerBytes, providerRecord } from '../src/lib/provider-response.ts'
import { generateVoice } from '../src/lib/elevenlabs.ts'
// Fixtures only. No real credential, image qualification, provider URL call or GPU operation.
const clock = Date.now()
const digest = sha256('synthetic qualification')
const input: VideoInput = { prompt: 'A synthetic contract fixture', profile: { width: 256, height: 256, num_frames: 9, fps: 16 } }
const config = {
  enabled: true as const, gatewayUrl: 'https://contract-fixture.salad.cloud',
  gatewayApiKey: 'gateway-fixture-'.repeat(4), workerToken: 'worker-fixture-'.repeat(4),
  requestTimeoutMs: 1000, generationTimeoutMs: 1000,
  qualification: { id: 'fixture-qualification', evidenceSha256: digest, verifiedAt: clock - 1000,
    image: `registry.invalid/fixture@sha256:${digest}`, architecture: 'linux/amd64' as const,
    cuda: '12.2', gpu: 'SYNTHETIC-GPU', vramMiB: 24576, requiredFreeVramMiB: 20000,
    model: MODEL, modelSha256: digest, encoderSha256: digest, vaeSha256: digest, profiles: [input.profile] },
  quote: { currency: 'USD' as const, hourlyRate: 1, observedAt: clock - 1000, expiresAt: clock + 3600000,
    source: 'salad-approved-quote' as const, evidenceSha256: digest },
}
const runtime: RuntimeInspection = { platform: 'linux', architecture: 'x64', image: config.qualification.image,
  cuda: '12.2', gpu: 'SYNTHETIC-GPU', vramMiB: 24576, freeVramMiB: 24000,
  modelSha256: digest, encoderSha256: digest, vaeSha256: digest, state: 'idle' }

// Test double ONLY. Production port must use the existing durable fenced queue, never this map.
class MemoryJournal implements DurableJournal {
  rows = new Map<string, Job>()
  slot: string | null = null
  casAllowed = true
  constructor(readonly kind: DurableJournal['kind']) {}
  async load(id: string) { return structuredClone(this.rows.get(id) ?? null) }
  async readActive() {
    if (this.slot === null) return null
    const job = this.rows.get(this.slot)
    if (!job) throw new Error('Fixture slot has no job')
    return structuredClone(job)
  }
  async reserve(job: Job): Promise<'created' | 'existing' | 'busy'> {
    if (this.rows.has(job.id)) return 'existing'
    if (this.kind === 'exclusive-execution' && this.slot) return 'busy'
    this.rows.set(job.id, structuredClone(job))
    if (this.kind === 'exclusive-execution') this.slot = job.id
    return 'created'
  }
  async compareAndSet(previous: Job, next: Job) {
    if (!this.casAllowed || this.rows.get(previous.id)?.revision !== previous.revision) return false
    this.rows.set(previous.id, structuredClone(next))
    if (next.status === 'succeeded' || next.status === 'rejected') this.slot = null
    return true
  }
}
function fixture(options: { inspect?: RuntimeInspection; generate?: WorkerPorts['bridge']['generate']; active?: unknown } = {}) {
  const journal = new MemoryJournal('exclusive-execution')
  const artifacts = new Map<string, Uint8Array>()
  let generations = 0
  const worker = createSaladWorker(options.active ?? config, {
    journal, artifacts: { async put(id, bytes) { artifacts.set(id, bytes) }, async get(id) { return artifacts.get(id) ?? null } },
    async inspect() { return options.inspect ?? runtime },
    bridge: { async health() { return true }, async generate(...args) {
      generations++
      return options.generate ? options.generate(...args) : { bytes: Buffer.from('fixture'), sha256: sha256('fixture') }
    } },
  })
  const requests: Request[] = []
  const transport: Fetcher = async (url, init) => {
    assert.equal(new URL(String(url)).origin, config.gatewayUrl)
    assert.equal(init?.redirect, 'error')
    assert.equal(new Headers(init?.headers).get('Salad-Api-Key'), config.gatewayApiKey)
    const request = new Request(String(url), init)
    requests.push(request.clone())
    return worker.handle(request)
  }
  const intent = new MemoryJournal('submission-intent')
  return { worker, journal, artifacts, requests, transport, intent, generations: () => generations,
    client: createSaladClient(config, intent, transport) }
}
function request(path: string, method = 'GET', body?: unknown, token = config.workerToken) {
  return new Request(`${config.gatewayUrl}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
const submission = (operation = 'op-1', value = input) => ({ ...identity('org:user', operation, value, config.qualification.id),
  qualificationId: config.qualification.id, input: value, maxEstimatedComputeUsd: 1 })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}


test('Salad shutdown waits for an in-flight durable reservation and its execution', async () => {
  const f = fixture()
  const entered = deferred<void>(), release = deferred<void>()
  const reserve = f.journal.reserve.bind(f.journal)
  f.journal.reserve = async job => { entered.resolve(); await release.promise; return reserve(job) }
  const submitted = f.worker.handle(request('/v1/jobs', 'POST', submission()))
  await entered.promise
  let drained = false
  const draining = f.worker.drain().then(() => { drained = true })
  await delay(15)
  const premature = drained
  release.resolve()
  assert.equal((await submitted).status, 202)
  await draining
  assert.equal(premature, false, 'drain must not finish while reserve can still start compute')
  assert.equal(f.generations(), 1)
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', submission('next')))).status, 503)
})

test('RunPod rejects missing/coerced job identity and malformed media', async () => {
  for (const body of [
    { status: 'COMPLETED', output: 'https://media.invalid/movie.mp4' },
    { id: 123, status: 'COMPLETED', output: 'https://media.invalid/movie.mp4' },
    { id: 'job-1', status: 'COMPLETED', output: { images: [{ data: { private: 'fixture' } }] } },
    { id: 'job-1', status: 'COMPLETED', output: 'javascript:invalid' },
  ]) {
    const spy = mock.method(globalThis, 'fetch', async () => Response.json(body))
    try { await assert.rejects(pollVideoJob('job-1', undefined, 100), RunpodJobError) }
    finally { spy.mock.restore() }
  }
})

test('RunPod rejects numeric submission IDs without retry', async () => {
  const spy = mock.method(globalThis, 'fetch', async () => Response.json({ id: 123, status: 'IN_QUEUE' }))
  try {
    await assert.rejects(submitVideoJob({ prompt: 'fixture' }), RunpodJobError)
    assert.equal(spy.mock.callCount(), 1)
  } finally { spy.mock.restore() }
})

test('voice refuses HTTP 200 JSON masquerading as MP3 without retry', async () => {
  const spy = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'PRIVATE_FIXTURE' }))
  try {
    await assert.rejects(generateVoice({ text: 'fixture', voice_id: 'voice-fixture' }), /INVALID_AUDIO/)
    assert.equal(spy.mock.callCount(), 1)
  } finally { spy.mock.restore() }
})

const musicParams = { prompt: 'fixture', style: 'cinematic' as const, duration: 30 }
const sunoSuccess = () => Response.json({ code: 200, data: { taskId: 'task-fixture', status: 'SUCCESS', response: {
  taskId: 'task-fixture', sunoData: [{ id: 'song-fixture', audio_url: 'https://media.invalid/music.mp3' }],
} } })

test('Suno checkpoints accepted task before polling; ACK failure preserves ID and blocks GET', async () => {
  const calls: string[] = []
  const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init?.method ?? 'GET')
    return init?.method === 'POST' ? Response.json({ code: 200, data: { taskId: 'task-fixture' } }) : sunoSuccess()
  })
  try {
    await assert.rejects(generateMusic(musicParams, { async onSubmitted(state) {
      assert.deepEqual(state, { taskId: 'task-fixture' }); throw new Error('PRIVATE_DB_ERROR')
    } }), (error: unknown) => {
      assert.equal((error as {taskId?: string}).taskId, 'task-fixture')
      assert.ok(!String(error).includes('PRIVATE_DB_ERROR')); return true
    })
    assert.deepEqual(calls, ['POST'])
  } finally { spy.mock.restore() }
})

test('Suno resumes a durable task with GET only', async () => {
  const calls: string[] = []
  const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init?.method ?? 'GET'); return sunoSuccess()
  })
  try {
    assert.equal((await generateMusic(musicParams, { current: { taskId: 'task-fixture' }, async onSubmitted() {
      assert.fail('a durable task must not be submitted again')
    } })).id, 'song-fixture')
    assert.deepEqual(calls, ['GET'])
  } finally { spy.mock.restore() }
})


test('bounded provider bodies reject empty, oversized, malformed and stalled streams', async () => {
  for (const response of [new Response(''), new Response('12345'), new Response('ok', { headers: { 'Content-Length': '999' } })]) {
    await assert.rejects(providerBytes(response, AbortSignal.timeout(100), 4), /PROVIDER_BODY/)
  }
  for (const body of ['invalid-json', '[]', 'null']) {
    await assert.rejects(providerRecord(new Response(body), AbortSignal.timeout(100)), /PROVIDER_INVALID_JSON/)
  }
  let cancelled = false
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}) } }))
  const keeper = setInterval(() => {}, 1000)
  try {
    await assert.rejects(providerBytes(response, AbortSignal.timeout(10), 4), /PROVIDER_BODY_UNAVAILABLE/)
    assert.equal(cancelled, true)
  } finally { clearInterval(keeper) }
})

test('RunPod accepts only matching completed jobs and valid worker media envelopes', async () => {
  for (const [output, expected] of [
    ['https://media.invalid/file.mp4', 'https://media.invalid/file.mp4'],
    [{ images: [{ type: 's3_url', data: 'https://media.invalid/file.mp4' }] }, 'https://media.invalid/file.mp4'],
    [{ images: [{ type: 'base64', data: 'YQ==' }] }, 'data:video/mp4;base64,YQ=='],
  ] as const) {
    const spy = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'job-1', status: 'COMPLETED', output }))
    try { assert.equal(await pollVideoJob('job-1', undefined, 100), expected) }
    finally { spy.mock.restore() }
  }
})

test('RunPod poll errors and deadlines retain job identity without resubmission', async () => {
  const keeper = setInterval(() => {}, 1000)
  try {
    for (const response of [new Response('PRIVATE_DIAGNOSTIC', { status: 401 }),
      new Response('PRIVATE_DIAGNOSTIC', { status: 429, headers: { 'Retry-After': '20' } }),
      Response.json({ id: 'job-1', status: 'FAILED', error: 'PRIVATE_DIAGNOSTIC' }),
      new Response(new ReadableStream()), new Response('not json')]) {
      const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
        assert.notEqual(init?.method, 'POST'); return response
      })
      try {
        await assert.rejects(pollVideoJob('job-1', undefined, 10), (error: unknown) => {
          assert.ok(error instanceof RunpodJobError); assert.equal(error.provenance.id, 'job-1')
          assert.equal(error.retrySubmission, false); assert.equal(error.fallbackAllowed, false)
          assert.ok(!error.message.includes('PRIVATE_DIAGNOSTIC')); return true
        })
        assert.equal(spy.mock.callCount(), 1)
      } finally { spy.mock.restore() }
    }
  } finally { clearInterval(keeper) }
})

test('voice bounds empty and oversized audio; valid MP3 transport succeeds once', async () => {
  for (const response of [new Response(null, { headers: { 'Content-Type': 'audio/mpeg' } }),
    new Response('fixture', { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '999999999' } })]) {
    const spy = mock.method(globalThis, 'fetch', async () => response)
    try { await assert.rejects(generateVoice({ text: 'fixture', voice_id: 'voice-fixture' }), /INVALID_AUDIO/); assert.equal(spy.mock.callCount(), 1) }
    finally { spy.mock.restore() }
  }
  const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal)
    return new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'audio/mpeg' } })
  })
  try { assert.equal((await generateVoice({ text: 'fixture', voice_id: 'voice-fixture' })).byteLength, 2) }
  finally { spy.mock.restore() }
})

test('Suno awaits durable ACK before GET and returns unchanged legacy result shape', async () => {
  let acknowledged = false
  const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'POST') return Response.json({ code: 200, data: { taskId: 'task-fixture' } })
    assert.equal(acknowledged, true); return sunoSuccess()
  })
  try {
    assert.deepEqual(await generateMusic(musicParams, { async onSubmitted() { await delay(5); acknowledged = true } }),
      { id: 'song-fixture', audio_url: 'https://media.invalid/music.mp3' })
    assert.equal(spy.mock.callCount(), 2)
  } finally { spy.mock.restore() }
})

test('Suno recovery validates checkpoint before I/O and retains ID on timeout or malformed replies', async () => {
  const keeper = setInterval(() => {}, 1000)
  try {
    for (const response of [Response.json({ code: 200, data: { taskId: 'different', status: 'SUCCESS' } }),
      Response.json({ code: 200, data: { taskId: 'task-fixture', status: 'UNRECOGNIZED' } }),
      new Response('PRIVATE_PROVIDER_DIAGNOSTIC', { status: 401 }), new Response(new ReadableStream())]) {
      const spy = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => { assert.notEqual(init?.method, 'POST'); return response })
      try {
        await assert.rejects(generateMusic(musicParams, { current: { taskId: 'task-fixture' }, timeoutMs: 10,
          async onSubmitted() { assert.fail('new submission') } }), (error: unknown) => {
          assert.ok(error instanceof SunoJobError); assert.equal(error.taskId, 'task-fixture')
          assert.equal(error.retrySubmission, false); assert.equal(error.fallbackAllowed, false)
          assert.ok(!error.message.includes('PRIVATE_PROVIDER_DIAGNOSTIC')); return true
        })
        assert.equal(spy.mock.callCount(), 1)
      } finally { spy.mock.restore() }
    }
    const spy = mock.method(globalThis, 'fetch', async () => { assert.fail('invalid context must not call provider') })
    try {
      await assert.rejects(generateMusic(musicParams, { current: { taskId: '../invalid' }, async onSubmitted() {} }), /reprise invalide/)
      const signal = AbortSignal.abort(new Error('Suno: PRIVATE_ABORT_DIAGNOSTIC'))
      await assert.rejects(generateMusic(musicParams, { current: { taskId: 'task-fixture' }, signal, async onSubmitted() {} }),
        error => { assert.ok(!String(error).includes('PRIVATE_ABORT_DIAGNOSTIC')); return true })
      assert.equal(spy.mock.callCount(), 0)
    } finally { spy.mock.restore() }
  } finally { clearInterval(keeper) }
})

test('Suno pending recovery stops at its deadline without resubmission or fallback', async () => {
  const keeper = setInterval(() => {}, 1000)
  const started = performance.now()
  const spy = mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method ?? 'GET', 'GET')
    assert.equal(new URL(String(url)).searchParams.get('taskId'), 'task-fixture')
    // Each GET receives a fresh body, as on the wire. A timer may wake just before
    // the deadline and permit another GET; this must never become another POST.
    return Response.json({ code: 200, data: { taskId: 'task-fixture', status: 'PENDING' } })
  })
  try {
    await assert.rejects(generateMusic(musicParams, { current: { taskId: 'task-fixture' }, timeoutMs: 10,
      async onSubmitted() { assert.fail('new submission') } }), (error: unknown) => {
      assert.ok(error instanceof SunoJobError)
      assert.equal(error.taskId, 'task-fixture')
      assert.equal(error.retrySubmission, false)
      assert.equal(error.fallbackAllowed, false)
      assert.match(error.message, /^Suno: (timeout|attente interrompue), reconciliation requise$/)
      return true
    })
    assert.ok(spy.mock.callCount() >= 1, 'resume must read the existing provider job')
    assert.ok(performance.now() - started < 1000, '10ms deadline must terminate well before a normal poll interval')
  } finally { spy.mock.restore(); clearInterval(keeper) }
})
