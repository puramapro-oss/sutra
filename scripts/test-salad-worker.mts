import test, { mock as nodeMock } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { createSaladClient } from '../src/lib/salad/client.ts'
import { createSaladWorker, type RuntimeInspection, type WorkerPorts } from '../src/lib/salad/worker.ts'
import { createComfyBridge } from '../src/lib/salad/engine.ts'
import { saladConfig, saladWorkerConfig, saladWorkerEnvironmentConfig } from '../src/lib/salad/config.ts'
import { saladCheckpoint } from '../src/lib/salad/checkpoint.ts'
import { durableLtxJob } from '../src/lib/ltx-workflow.ts'
import { saladApplicationConfig, saladPublicCapabilities, generateSaladVideo } from '../src/lib/salad/application.ts'
import { boundedBytes, boundedJson, json, type Fetcher } from '../src/lib/salad/http.ts'
import { PROTOCOL, MODEL, SaladError, sha256, identity, inputSchema,
  type DurableJournal, type Job, type VideoInput } from '../src/lib/salad/contracts.ts'

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

test('default disabled: zero I/O and no secret/environment load', async () => {
  assert.deepEqual(saladConfig(), { enabled: false })
  const client = createSaladClient(undefined, new MemoryJournal('submission-intent'), async () => { assert.fail('I/O') })
  assert.equal((await client.capabilities()).state, 'disabled')
  await assert.rejects(client.submit('org:user', 'op-1', input, 1), /SALAD_DISABLED/)
  assert.equal((await fixture({ active: { enabled: false } }).worker.handle(request('/health'))).status, 503)
})

test('worker configuration needs no account key/gateway URL and drops those privileges', async () => {
  const raw = { SALAD_ENABLED: 'true', SALAD_WORKER_TOKEN: config.workerToken,
    SALAD_QUALIFICATION_JSON: JSON.stringify({ ...config.qualification, gpu: 'NVIDIA GeForce RTX 3090' }),
    SALAD_QUOTE_JSON: JSON.stringify(config.quote), SALAD_REQUEST_TIMEOUT_MS: '1000', SALAD_GENERATION_TIMEOUT_MS: '1000' }
  const worker = saladWorkerEnvironmentConfig(raw)
  assert.equal(worker.enabled, true)
  assert.equal('gatewayApiKey' in worker, false)
  assert.equal('gatewayUrl' in worker, false)
  assert.equal('gatewayApiKey' in saladWorkerConfig(config), false)
  assert.deepEqual(saladWorkerEnvironmentConfig({}), { enabled: false })
  assert.throws(() => saladWorkerEnvironmentConfig({ ...raw, SALAD_WORKER_TOKEN: '' }), /SALAD_INVALID_WORKER_CONFIG/)
  const remote = fixture({ active: saladWorkerConfig(config) })
  assert.equal((await remote.worker.handle(request('/health'))).status, 200)
})

test('strict configuration: management API, credentials in URL, arbitrary host, query, redirect domain rejected', () => {
  for (const gatewayUrl of ['http://fixture.salad.cloud', 'https://api.salad.com', 'https://evil.test',
    'https://fixture.salad.cloud.evil.test', 'https://user:pass@fixture.salad.cloud',
    'https://fixture.salad.cloud/path', 'https://fixture.salad.cloud?key=secret', 'https://fixture.salad.cloud:8443']) {
    assert.throws(() => saladConfig({ ...config, gatewayUrl }), /SALAD_INVALID_GATEWAY/)
  }
  assert.throws(() => saladConfig({ ...config, workerToken: config.gatewayApiKey }), /DISTINCT_CREDENTIALS/)
  assert.throws(() => saladConfig({ ...config, enabled: 'true' }), /INVALID_CONFIG/)
  assert.throws(() => saladConfig({ ...config, qualification: { ...config.qualification, image: 'latest' } }), /INVALID_CONFIG/)
  assert.throws(() => saladConfig({ ...config, workerToken: 'x\nsecret' }), /INVALID_CONFIG/)
})

test('checkpoint namespaces cannot be interchanged', () => {
  assert.throws(() => createSaladClient(config, new MemoryJournal('exclusive-execution')), /INTENT_JOURNAL/)
  assert.throws(() => createSaladWorker(config, { journal: new MemoryJournal('submission-intent') } as unknown as WorkerPorts), /EXCLUSIVE_JOURNAL/)
})

test('every worker route authenticates, unknown/cancel routes do not compute', async () => {
  const f = fixture()
  for (const path of ['/health', '/v1/capabilities', '/v1/jobs', `/v1/jobs/${digest}`, `/v1/jobs/${digest}/media`]) {
    const response = await f.worker.handle(request(path, 'GET', undefined, 'invalid'))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'SALAD_UNAUTHORIZED' })
  }
  assert.equal((await f.worker.handle(request(`/v1/jobs/${digest}/cancel`, 'POST', {}))).status, 405)
  assert.equal((await f.worker.handle(request('/health?token=bad'))).status, 400)
  assert.equal(f.generations(), 0)
})

test('ready requires matching real runtime measurements; Mac, cold, interruption, low VRAM never ready', async () => {
  for (const [patch, state] of [
    [{ platform: 'darwin' }, 'incompatible'], [{ architecture: 'arm64' }, 'incompatible'],
    [{ image: 'wrong' }, 'incompatible'], [{ modelSha256: 'wrong' }, 'incompatible'],
    [{ freeVramMiB: 100 }, 'incompatible'], [{ freeVramMiB: NaN }, 'incompatible'],
    [{ gpu: 'unqualified' }, 'incompatible'], [{ cuda: '13.0' }, 'incompatible'],
    [{ state: 'cold' }, 'cold'], [{ state: 'interrupted' }, 'interrupted'], [{ state: 'busy' }, 'busy'],
  ] as const) {
    const f = fixture({ inspect: { ...runtime, ...patch } })
    assert.equal((await f.client.capabilities()).state, state)
    await assert.rejects(f.client.submit('org:user', 'op-1', input, 1), /NOT_QUALIFIED/)
    assert.equal(f.generations(), 0)
  }
  const caps = await fixture().client.capabilities()
  assert.equal(caps.state, 'ready')
  assert.deepEqual(caps.operations, ['text-to-video'])
  assert.equal(caps.audio, false); assert.equal(caps.native4k, false)
  assert.equal(caps.quotaRemaining, null)
  assert.ok(!JSON.stringify(caps).includes(config.workerToken))
})

test('canonical frame/grid and strict operation validation: no silent resizing or I2V/4K promise', () => {
  assert.equal(inputSchema.safeParse({ ...input, profile: { ...input.profile, width: 720 } }).success, false)
  assert.equal(inputSchema.safeParse({ ...input, profile: { ...input.profile, num_frames: 96 } }).success, false)
  assert.equal(inputSchema.safeParse({ ...input, image_url: 'https://evil.test' }).success, false)
  assert.equal(inputSchema.safeParse({ ...input, prompt: ' ' }).success, false)
  assert.equal(inputSchema.safeParse({ ...input, profile: { ...input.profile, fps: 1, num_frames: 961 } }).success, false)
})

test('submit records intent before POST; exact payload, cost provenance, success and GET-only resume', async () => {
  const f = fixture()
  const transport: Fetcher = async (url, init) => {
    if (init?.method === 'POST') {
      const data = JSON.parse(String(init.body))
      assert.equal((await f.intent.load(data.id))?.status, 'submitting')
      assert.deepEqual(data.input, input)
    }
    return f.transport(url, init)
  }
  const client = createSaladClient(config, f.intent, transport)
  const started = await client.submit('org:user', 'op-1', input, 1)
  assert.equal(started.status, 'running'); assert.equal(started.lastHttpStatus, 202)
  assert.equal(started.provider, 'salad'); assert.equal(started.model, MODEL)
  assert.equal(started.actualUsd, null); assert.equal(started.estimatedComputeUsd, 1 / 3600)
  assert.equal(started.quoteEvidenceSha256, digest)
  await f.worker.drain()
  const done = await client.resume('org:user', 'op-1', input)
  assert.equal(done.status, 'succeeded'); assert.equal(done.artifact?.sha256, sha256('fixture'))
  assert.equal(f.generations(), 1)
  await client.submit('org:user', 'op-1', input, 1)
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
})

test('lost POST response after compute: UNKNOWN, then GET recovers same artifact without a second generation', async () => {
  const f = fixture()
  const client = createSaladClient(config, f.intent, async (url, init) => {
    const response = await f.transport(url, init)
    if (init?.method === 'POST') throw new Error(`network error ${config.workerToken}`)
    return response
  })
  const unknown = await client.submit('org:user', 'op-1', input, 1)
  assert.equal(unknown.status, 'unknown')
  assert.ok(!JSON.stringify(unknown).includes(config.workerToken))
  await f.worker.drain()
  assert.equal((await client.submit('org:user', 'op-1', input, 1)).status, 'succeeded')
  assert.equal(f.generations(), 1)
})

test('remote 404 after lost submission is UNKNOWN forever, never resubmitted', async () => {
  const f = fixture()
  let posts = 0
  const client = createSaladClient(config, f.intent, async (url, init) => {
    if (init?.method === 'POST') { posts++; throw new Error('uncertain') }
    if (String(url).includes('/jobs/')) return json({ error: 'not found' }, 404)
    return f.transport(url, init)
  })
  for (let i = 0; i < 3; i++) assert.equal((await client.submit('org:user', 'op-1', input, 1)).status, 'unknown')
  assert.equal(posts, 1)
  assert.equal((await client.resume('org:user', 'op-1', input)).lastHttpStatus, 404)
})

test('no blind retry on 401/429/503, invalid JSON, body hang or redirect', async () => {
  for (const status of [401, 429, 503, 302, 200]) {
    const f = fixture()
    let posts = 0
    const client = createSaladClient(config, f.intent, async (url, init) => {
      if (init?.method === 'POST') { posts++; return new Response(`unsafe ${config.workerToken}`, { status }) }
      if (String(url).includes('/jobs/')) return json({}, 404)
      return f.transport(url, init)
    })
    const job = await client.submit('org:user', 'op-1', input, 1)
    assert.equal(job.status, 'unknown'); assert.equal(job.lastHttpStatus, status)
    await client.submit('org:user', 'op-1', input, 1)
    assert.equal(posts, 1)
    assert.ok(!JSON.stringify(job).includes(config.workerToken))
  }
  const error = new SaladError('SALAD_COMPUTE_UNCERTAIN')
  assert.equal(error.retrySubmission, false); assert.equal(error.fallbackAllowed, false)
})

test('request identity is scoped, stable and immutable across payload changes', async () => {
  const f = fixture()
  await f.client.submit('org:user', 'op-1', input, 1)
  await f.worker.drain()
  await assert.rejects(f.client.submit('org:user', 'op-1', { ...input, prompt: 'different' }, 1), /IDEMPOTENCY_CONFLICT/)
  await assert.rejects(f.client.resume('other:user', 'op-1', input), /UNKNOWN_INTENT/)
  assert.notEqual(identity('a', 'b', input, 'q').id, identity('b', 'a', input, 'q').id)
})

test('expired quote, insufficient budget and unqualified profile never reserve or POST', async () => {
  for (const [custom, value, budget, expected] of [
    [{ ...config, quote: { ...config.quote, observedAt: clock - 2000, expiresAt: clock - 1000 } }, input, 1, /STALE_QUOTE/],
    [config, input, 0.000001, /ESTIMATE_EXCEEDS_BUDGET/],
    [config, { ...input, profile: { ...input.profile, width: 512 } }, 1, /UNSUPPORTED_PROFILE/],
  ] as const) {
    const f = fixture({ active: custom })
    const client = createSaladClient(custom, f.intent, f.transport)
    await assert.rejects(client.submit('org:user', 'op-1', value, budget), expected)
    assert.equal(f.intent.rows.size, 0); assert.equal(f.generations(), 0)
  }
})

test('worker rejects malformed/oversized input, wrong digest and direct unsupported profiles', async () => {
  const f = fixture()
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', {}))).status, 400)
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', { ...submission(), fingerprint: 'f'.repeat(64) }))).status, 409)
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', submission('op-1', { ...input, profile: { ...input.profile, width: 512 } })))).status, 422)
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', { payload: 'x'.repeat(70000) }))).status, 503)
  assert.equal(f.generations(), 0)
})

test('simultaneous duplicate worker requests execute only once; another operation cannot steal global slot', async () => {
  const gate = deferred<{ bytes: Buffer; sha256: string }>()
  const f = fixture({ generate: () => gate.promise })
  const responses = await Promise.all(Array.from({ length: 8 }, () => f.worker.handle(request('/v1/jobs', 'POST', submission()))))
  assert.equal(responses.filter(r => r.status === 202).length, 1)
  assert.equal(f.generations(), 1)
  assert.ok([409, 503].includes((await f.worker.handle(request('/v1/jobs', 'POST', submission('op-2')))).status))
  gate.resolve({ bytes: Buffer.from('fixture'), sha256: sha256('fixture') })
  await f.worker.drain()
})

test('unreadable occupied slot is interrupted and prevents compute', async () => {
  const f = fixture()
  f.journal.slot = 'another-engine-owner'
  assert.equal((await f.client.capabilities()).state, 'interrupted')
  assert.equal((await f.worker.handle(request('/v1/jobs', 'POST', submission()))).status, 503)
  assert.equal(f.generations(), 0)
})

test('restart reads durable running/unknown slot; missing, invalid or failed reads never announce ready', async () => {
  const f = fixture()
  const accepted = await f.worker.handle(request('/v1/jobs', 'POST', submission()))
  const job = await accepted.json() as Job
  await f.worker.drain()
  let inspected = 0
  const restart = () => createSaladWorker(config, {
    journal: f.journal, artifacts: { async put() { assert.fail('put') }, async get() { assert.fail('get') } },
    async inspect() { inspected++; return runtime },
    bridge: { async health() { return true }, async generate() { assert.fail('generation') } },
  })
  const capability = async () => (await (await restart().handle(request('/v1/capabilities'))).json()).state
  f.journal.slot = job.id
  for (const [patch, expected] of [
    [{ status: 'running', reconcileAfter: Date.now() + 60000 }, 'busy'],
    [{ status: 'running', reconcileAfter: Date.now() - 1 }, 'interrupted'],
    [{ status: 'unknown' }, 'interrupted'], [{ status: 'submitting' }, 'interrupted'],
    [{ status: 'rejected' }, 'interrupted'],
  ] as const) {
    f.journal.rows.set(job.id, { ...job, ...patch, artifact: null })
    assert.equal(await capability(), expected)
    assert.equal((await restart().handle(request('/v1/jobs', 'POST', submission('new-op')))).status, 503)
  }
  f.journal.rows.delete(job.id)
  assert.equal(await capability(), 'interrupted')
  Object.defineProperty(f.journal, 'readActive', { value: undefined, configurable: true })
  assert.equal(await capability(), 'interrupted')
  Object.defineProperty(f.journal, 'readActive', { value: async () => ({}), configurable: true })
  assert.equal(await capability(), 'interrupted')
  Object.defineProperty(f.journal, 'readActive', { value: async () => null })
  assert.equal(await capability(), 'ready')
  assert.equal(inspected, 1)
  assert.equal(f.generations(), 1)
})

test('interruption keeps exclusive slot and unknown remote status; duplicate never executes', async () => {
  const f = fixture({ generate: async () => { throw new Error(`OOM ${config.workerToken}`) } })
  const first = await f.worker.handle(request('/v1/jobs', 'POST', submission()))
  assert.equal(first.status, 202)
  await f.worker.drain()
  const current = await f.worker.handle(request(`/v1/jobs/${submission().id}`))
  assert.equal((await current.json()).status, 'unknown')
  assert.equal(f.journal.slot, submission().id)
  await f.worker.handle(request('/v1/jobs', 'POST', submission()))
  assert.equal(f.generations(), 1)
})

test('lost durable CAS keeps claim, drain surfaces static fault; artifacts do not imply published success', async () => {
  const f = fixture()
  f.journal.casAllowed = false
  await f.worker.handle(request('/v1/jobs', 'POST', submission()))
  await assert.rejects(f.worker.drain(), /PERSISTENCE_UNCERTAIN/)
  assert.equal(f.journal.slot, submission().id)
  assert.equal((await f.worker.handle(request(`/v1/jobs/${submission().id}/media`))).status, 409)
})

test('client journal CAS failure does not send another POST on resume', async () => {
  const f = fixture()
  f.intent.casAllowed = false
  await assert.rejects(f.client.submit('org:user', 'op-1', input, 1), /JOURNAL_CONFLICT/)
  f.intent.casAllowed = true
  await f.worker.drain()
  assert.equal((await f.client.submit('org:user', 'op-1', input, 1)).status, 'succeeded')
  assert.equal(f.generations(), 1)
})

test('restart GET on overdue running record reports unknown and does not clear the slot', async () => {
  const f = fixture()
  const first = await f.client.submit('org:user', 'op-1', input, 1)
  await f.worker.drain()
  const stored = f.journal.rows.get(first.id)!
  f.journal.rows.set(first.id, { ...stored, status: 'running', artifact: null, reconcileAfter: clock - 1 })
  f.journal.slot = first.id
  assert.equal((await (await f.worker.handle(request(`/v1/jobs/${first.id}`))).json()).status, 'unknown')
  assert.equal(f.journal.slot, first.id); assert.equal(f.generations(), 1)
})

test('durable artifact corruption is refused without regenerating', async () => {
  const f = fixture()
  const job = await f.client.submit('org:user', 'op-1', input, 1)
  await f.worker.drain()
  f.artifacts.set(job.id, Buffer.from('corrupt'))
  assert.equal((await f.worker.handle(request(`/v1/jobs/${job.id}/media`))).status, 503)
  assert.equal(f.generations(), 1)
})

test('bounded HTTP bodies: oversized header, streaming overflow, invalid JSON and stalled body', async () => {
  await assert.rejects(boundedBytes(new Response('x', { headers: { 'Content-Length': '9999' } }), 10, AbortSignal.timeout(100)), /BODY_LIMIT/)
  await assert.rejects(boundedBytes(new Response('x'.repeat(11)), 10, AbortSignal.timeout(100)), /BODY_LIMIT/)
  await assert.rejects(boundedJson(json('not an object').clone(), AbortSignal.timeout(100)).then(data => {
    assert.equal(typeof data, 'string')
    return boundedJson(new Response('bad', { headers: { 'Content-Type': 'application/json' } }), AbortSignal.timeout(100))
  }), /INVALID_JSON/)
  let cancelled = false
  const stream = new ReadableStream({ cancel() { cancelled = true } })
  const signal = AbortSignal.timeout(20)
  const keepAlive = delay(40)
  await assert.rejects(boundedBytes(new Response(stream), 10, signal))
  await keepAlive
  assert.equal(cancelled, true)
})

test('private bridge cannot target Mac/network URLs and rejects foreign media before GET', async () => {
  for (const url of ['https://127.0.0.1:7861', 'http://localhost:7861', 'http://192.168.1.2:7861', 'http://user:pass@127.0.0.1:7861']) {
    assert.throws(() => createComfyBridge(url), /INVALID_PRIVATE_BRIDGE/)
  }
  let calls = 0
  const bridge = createComfyBridge('http://127.0.0.1:7861', async (_url, init) => {
    calls++; assert.equal(init?.redirect, 'error')
    assert.deepEqual(JSON.parse(String(init?.body)), { prompt: input.prompt, ...input.profile })
    return json({ video_url: 'https://evil.test/video.mp4' })
  })
  await assert.rejects(bridge.generate(input, 1000), /COMPUTE_UNCERTAIN/)
  assert.equal(calls, 1)
})

test('real CPU-only fixture bytes: existing media-probe validates bridge and authenticated client download', async () => {
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:r=16',
    '-frames:v', '9', '-c:v', 'libx264', '-threads', '1', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'], { timeout: 5000, maxBuffer: 1024 * 1024 })
  const paths: string[] = []
  const bridge = createComfyBridge('http://127.0.0.1:7861', async (url, init) => {
    paths.push(new URL(String(url)).pathname)
    if (init?.method === 'POST') return json({ video_url: '/files?filename=fixture.mp4' })
    return new Response(bytes, { headers: { 'Content-Type': 'video/mp4' } })
  })
  const media = await bridge.generate(input, 5000)
  assert.equal(media.sha256, sha256(bytes))
  assert.deepEqual(paths, ['/', '/files'])
  const f = fixture({ generate: async () => media })
  await f.client.submit('org:user', 'op-1', input, 1)
  await f.worker.drain()
  const completed = await f.client.resume('org:user', 'op-1', input)
  assert.deepEqual(Buffer.from(await f.client.download(completed, input)), bytes)
  assert.equal(f.generations(), 1)
})

test('bridge health HTTP 200 without explicit ok is not ready, raw errors are not returned', async () => {
  for (const response of [json({ ok: false }), json({}), new Response('secret')]) {
    assert.equal(await createComfyBridge('http://127.0.0.1:7861', async () => response).health(), false)
  }
  assert.equal(await createComfyBridge('http://127.0.0.1:7861', async () => json({ ok: true })).health(), true)
})

test('protocol confusion and mismatched remote records remain unknown', async () => {
  for (const change of [{ protocol: 'salad/official' }, { id: 'f'.repeat(64) }, { scope: 'f'.repeat(64) },
    { qualificationId: 'foreign' }, { estimatedComputeUsd: 0 }, { timeoutMs: 42 }]) {
    const f = fixture()
    const client = createSaladClient(config, f.intent, async (url, init) => {
      const response = await f.transport(url, init)
      if (init?.method !== 'POST') return response
      return json({ ...await response.json(), ...change }, 202)
    })
    assert.equal((await client.submit('org:user', 'op-1', input, 1)).status, 'unknown')
    await f.worker.drain()
  }
  assert.equal(PROTOCOL, 'sutra-salad-worker/1')
})


function appValues(active = config) {
  return { SALAD_ENABLED: 'true', SALAD_GATEWAY_URL: active.gatewayUrl, SALAD_API_KEY: active.gatewayApiKey,
    SALAD_WORKER_TOKEN: active.workerToken, SALAD_QUALIFICATION_JSON: JSON.stringify(active.qualification),
    SALAD_QUOTE_JSON: JSON.stringify(active.quote), SALAD_REQUEST_TIMEOUT_MS: String(active.requestTimeoutMs),
    SALAD_GENERATION_TIMEOUT_MS: String(active.generationTimeoutMs), SALAD_MAX_ESTIMATED_COMPUTE_USD: '1' }
}

test('public DTO is owner-only, disabled by default and reveals no credentials or runtime manifest', async () => {
  const noCall: Fetcher = async () => assert.fail('worker I/O forbidden')
  assert.deepEqual(saladApplicationConfig({}), { config: { enabled: false }, budget: 0 })
  const disabled = await saladPublicCapabilities(true, {}, noCall)
  assert.equal(disabled.personal.state, 'disabled')
  assert.equal(disabled.personal.available, false)
  assert.equal(disabled.client.availability, 'unknown')
  const other = await saladPublicCapabilities(false, appValues(), noCall)
  assert.equal(other.personal.allowed, false)
  assert.equal(other.personal.reason, 'OWNER_ONLY')
  const f = fixture()
  const ready = await saladPublicCapabilities(true, appValues(), f.transport)
  assert.equal(ready.personal.state, 'ready')
  assert.equal(ready.personal.available, true)
  assert.equal(ready.personal.cost.actualUsd, null)
  const serialized = JSON.stringify(ready)
  for (const privateValue of [config.workerToken, config.gatewayApiKey, config.gatewayUrl, config.qualification.image, config.qualification.gpu]) {
    assert.equal(serialized.includes(privateValue), false)
  }
  const badConfig = await saladPublicCapabilities(true, { SALAD_ENABLED: 'true', SALAD_QUALIFICATION_JSON: 'private error' }, noCall)
  assert.equal(badConfig.personal.reason, 'SALAD_INVALID_CONFIG')
  assert.equal((await saladPublicCapabilities(true, appValues(), async () => json({ private: 'upstream' }, 401))).personal.state, 'unavailable')
})

test('preflight binds worker timeout and budget before any POST', async () => {
  const f = fixture({ active: { ...config, generationTimeoutMs: 2000 } })
  await assert.rejects(f.client.submit('scope', 'op', input, 1), /NOT_QUALIFIED/)
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 0)
  assert.equal(f.intent.rows.size, 0)
  const publicResult = await saladPublicCapabilities(true, appValues(), f.transport)
  assert.equal(publicResult.personal.available, false)
})

test('application checkpoint acknowledgment precedes POST; lost reply survives reconstructed wrapper', async () => {
  const f = fixture()
  let stored: Record<string, unknown> = {}
  const checkpoints: string[] = []
  const persist = async (key: string, value: unknown) => { stored = { ...stored, [key]: structuredClone(value) }; checkpoints.push(key) }
  const wrapper = durableLtxJob({}, 'scene:2:ltx', persist)
  const transport: Fetcher = async (url, init) => {
    if (init?.method === 'POST') {
      assert.equal(checkpoints.length, 1)
      assert.ok(stored['scene:2:ltx'])
      await f.transport(url, init)
      throw new Error('lost response private detail')
    }
    return f.transport(url, init)
  }
  const first = await createSaladClient(config, saladCheckpoint(wrapper), transport).submit('user:video', wrapper.operationKey!, input, 1)
  assert.equal(first.status, 'unknown')
  await f.worker.drain()
  const resumed = durableLtxJob(structuredClone(stored), 'scene:2:ltx', persist)
  const final = await createSaladClient(config, saladCheckpoint(resumed), transport).submit('user:video', resumed.operationKey!, input, 1)
  assert.equal(final.status, 'succeeded')
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
  assert.equal(f.generations(), 1)
  assert.equal(resumed.current?.salad?.id, first.id)
  assert.equal(resumed.current?.v2, undefined)
})

test('same slot wrappers serialize one intent and fence stale CAS; missing/failed durable callback never submits', async () => {
  const f = fixture()
  const steps = {}
  const a = durableLtxJob(steps, 'scene', async () => {})
  const b = durableLtxJob(steps, 'scene', async () => {})
  const results = await Promise.allSettled([a, b].map(j => createSaladClient(config, saladCheckpoint(j), f.transport).submit('scope', 'op', input, 1)))
  assert.ok(results.some(r => r.status === 'fulfilled'))
  await f.worker.drain()
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
  const before = a.current!.salad!
  assert.equal(await saladCheckpoint(b).compareAndSet({ ...before, revision: before.revision - 1 }, { ...before, revision: before.revision + 1 }), false)
  for (const callback of [undefined, async () => { throw new Error('private DB credential') }]) {
    const empty = durableLtxJob({}, 'different', callback)
    const fresh = fixture()
    const client = createSaladClient(config, saladCheckpoint(empty), fresh.transport)
    await assert.rejects(client.submit('scope', 'different', input, 1), (error: unknown) => {
      assert.ok(error instanceof SaladError)
      assert.equal(error.message, 'SALAD_SAFE_FAILURE')
      return true
    })
    assert.equal(empty.current, undefined)
    assert.equal(fresh.requests.filter(r => r.method === 'POST').length, 0)
  }
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
})

test('foreign provider checkpoint is never overwritten or interpreted as Salad', async () => {
  const f = fixture()
  const legacy = { endpoint: '/text-to-video', fingerprint: digest, started: true as const, id: 'legacy-id' }
  const wrapper = { current: legacy, async save() { assert.fail('must not overwrite') } }
  await assert.rejects(createSaladClient(config, saladCheckpoint(wrapper), f.transport).submit('scope', 'op', input, 1), /PROVIDER_CONFLICT/)
  assert.equal(f.requests.length, 0)
})

test('application rejects unsupported dimensions, references, native4k and missing context before I/O', async () => {
  const noCall: Fetcher = async () => assert.fail('I/O before eligibility')
  const base = { prompt: 'fixture', quality: '720p', userId: 'user', videoId: 'video', job: durableLtxJob({}, 'scene', async () => {}) }
  await assert.rejects(generateSaladVideo(base, {}, noCall), /DISABLED/)
  await assert.rejects(generateSaladVideo({ ...base, job: undefined }, appValues(), noCall), /DURABLE_CONTEXT/)
  await assert.rejects(generateSaladVideo({ ...base, imageUri: 'https://fixture.invalid/image' }, appValues(), noCall), /UNSUPPORTED_OPERATION/)
  await assert.rejects(generateSaladVideo({ ...base, quality: '4k' }, appValues(), noCall), /UNSUPPORTED_PROFILE/)
  await assert.rejects(generateSaladVideo(base, appValues(), noCall), /UNSUPPORTED_PROFILE/)
})

test('application returns verified real CPU fixture from qualified worker and resumes without new POST', async () => {
  const profile = { width: 1280, height: 736, num_frames: 9, fps: 16 }
  const bytes = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=1280x736:r=16',
    '-frames:v', '9', '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'])
  const active = { ...config, qualification: { ...config.qualification, profiles: [profile] } }
  const f = fixture({ active, generate: async () => ({ bytes, sha256: sha256(bytes) }) })
  const transport: Fetcher = async (url, init) => {
    const response = await f.transport(url, init)
    if (init?.method === 'POST') {
      await f.worker.drain()
      const accepted = await response.json() as Job
      return json(await f.journal.load(accepted.id), 202)
    }
    return response
  }
  const state = {}
  let writes = 0
  const params = { prompt: 'qualified fixture', quality: '720p', duration: 0.5, userId: 'user', videoId: 'video',
    job: durableLtxJob(state, 'scene:0', async () => { writes++ }) }
  const first = await generateSaladVideo(params, appValues(active), transport)
  assert.equal(first.engine, 'salad')
  assert.equal(first.model, MODEL)
  assert.equal(first.resolution, '1280x736')
  assert.equal(first.duration, 9 / 16)
  assert.equal(first.provenance?.provider, 'salad')
  assert.equal(sha256(new Uint8Array(first.videoBuffer)), sha256(bytes))
  assert.ok(writes >= 2)
  const resumed = await generateSaladVideo({ ...params, job: durableLtxJob(state, 'scene:0', async () => {}) }, appValues(active), transport)
  assert.equal(sha256(new Uint8Array(resumed.videoBuffer)), sha256(bytes))
  assert.equal(f.requests.filter(r => r.method === 'POST').length, 1)
})

// Server-route tests use the real handler and server identity double only; no account connection.
let session: { id: string; email: string } | null = null
nodeMock.module('../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: session }, error: null }),
} }) } })
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key'
const { GET: capabilitiesRoute } = await import('../src/app/api/video/capabilities/route.ts')
const { generateVideoSmart, textToVideo } = await import('../src/lib/ltx.ts')
const { tryLocalRoute } = await import('../src/lib/local-engine.ts')

test('authenticated public handler never trusts body identity or reports a client GPU as ready', async () => {
  delete process.env.SALAD_ENABLED
  session = null
  assert.equal((await capabilitiesRoute()).status, 401)
  session = { id: 'user', email: 'client@example.test' }
  const clientResponse = await capabilitiesRoute()
  assert.equal(clientResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal((await clientResponse.json()).personal.allowed, false)
  session = { id: 'owner', email: 'matiss.frasne@gmail.com' }
  const ownerResponse = await capabilitiesRoute()
  assert.equal((await ownerResponse.json()).personal.reason, 'SALAD_DISABLED')
})

test('real smart routing: owner never contacts Mac/API when Salad disabled; customer remains API', async () => {
  delete process.env.SALAD_ENABLED
  process.env.LOCAL_ENGINE_ENABLED = 'true'
  process.env.LOCAL_VIDEO_API_URL = 'http://127.0.0.1:8188'
  let calls = 0
  const previous = globalThis.fetch
  globalThis.fetch = async () => { calls++; throw new Error('I/O not permitted') }
  try {
    await assert.rejects(generateVideoSmart('fixture', 'empire', 'matiss.frasne@gmail.com', { quality: '720p' }), /SALAD_DISABLED/)
    await assert.rejects(generateVideoSmart('fixture', 'empire', 'matiss.frasne@gmail.com', {
      quality: '720p', execution: { operationKey: 'new-api-context', store: {
        async load() { return null }, async compareAndSet() { assert.fail('API intent must not be created') },
      } },
    }), /SALAD_CHECKPOINT_PROVIDER_CONFLICT/)
    assert.equal(await tryLocalRoute({ prompt: 'fixture', plan: 'free', quality: '720p', userEmail: 'client@example.test' }), null)
    await assert.rejects(generateVideoSmart('fixture', 'creator', 'client@example.test', { quality: '720p' }), /LTX_DURABLE_CONTEXT_REQUIRED/)
    const f = fixture()
    const job = await f.client.submit('scope', 'op', input, 1)
    const checkpoint = { current: { started: true as const, endpoint: '/salad/jobs', fingerprint: job.fingerprint, id: job.id, salad: job }, async save() {} }
    await assert.rejects(generateVideoSmart('fixture', 'creator', 'client@example.test', { job: checkpoint }), /PROVIDER_CONFLICT/)
    await assert.rejects(textToVideo({ prompt: 'fixture', model: 'ltx-2-3-pro', duration: 6, resolution: '1920x1080' }, checkpoint), /PROVIDER_CONFLICT/)
    assert.equal(calls, 0)
  } finally { globalThis.fetch = previous }
})


test('owner without API credentials cannot fall back to stock; Salad never gets a fabricated fixed price', async () => {
  const { generateVisualWithFallback } = await import('../src/lib/fallbacks.ts')
  const { estimateCost } = await import('../src/lib/ltx-utils.ts')
  delete process.env.LTX_API_KEY
  delete process.env.RUNPOD_API_KEY
  delete process.env.RUNPOD_ENDPOINT_ID
  delete process.env.SALAD_ENABLED
  const previous = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('I/O forbidden') }
  try {
    await assert.rejects(generateVisualWithFallback('fixture', '720p', 'matiss.frasne@gmail.com', 'free', '16:9', false), /SALAD_DISABLED/)
    assert.equal(calls, 0)
    assert.throws(() => estimateCost('salad', 6, '720p'), /DYNAMIC_QUOTE_REQUIRED/)
    assert.equal(estimateCost('ltx-fast', 6, '720p'), 0.18)
  } finally { globalThis.fetch = previous }
})
