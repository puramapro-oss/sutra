/** Independent T03 cross-boundary tests of T04's actual client AND worker. No compute or real DB. */
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const source = process.env.T03_SALAD_SOURCE
if (!source) throw new Error('T03_COMMITTED_SALAD_SOURCE_REQUIRED')
const { createSaladClient } = await import(pathToFileURL(resolve(source, 'src/lib/salad/client.ts')).href)
const { createSaladWorker } = await import(pathToFileURL(resolve(source, 'src/lib/salad/worker.ts')).href)
const { MODEL } = await import(pathToFileURL(resolve(source, 'src/lib/salad/contracts.ts')).href)
type Job = Record<string, unknown> & { id: string; revision: number; status: string }
const copy = <T,>(value: T): T => structuredClone(value)
const INITIAL_TIME = 1_800_000_000_000
const input = { prompt: 'T03 synthetic landscape', profile: { width: 768, height: 512, num_frames: 81, fps: 16 } }
const config = {
  enabled: true, gatewayUrl: 'https://t03-fixture.salad.cloud',
  gatewayApiKey: 'fixture-gateway-'.repeat(3), workerToken: 'fixture-worker-'.repeat(3),
  requestTimeoutMs: 1000, generationTimeoutMs: 10000,
  qualification: {
    id: 't03-synthetic-qualification', evidenceSha256: 'a'.repeat(64), verifiedAt: INITIAL_TIME - 1000,
    image: `fixture/worker@sha256:${'b'.repeat(64)}`, architecture: 'linux/amd64', cuda: '12.0',
    gpu: 'FIXTURE-NO-GPU', vramMiB: 10000, requiredFreeVramMiB: 9000, model: MODEL,
    modelSha256: 'c'.repeat(64), encoderSha256: 'd'.repeat(64), vaeSha256: 'e'.repeat(64), profiles: [input.profile],
  },
  quote: { currency: 'USD', hourlyRate: 1, observedAt: INITIAL_TIME - 1000, expiresAt: INITIAL_TIME + 3600000,
    source: 'salad-approved-quote', evidenceSha256: 'f'.repeat(64) },
}
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

/** Only a receipt/owner fault double. Production durable journal/global engine lock is NOT certified here. */
class Store {
  rows = new Map<string, Job>()
  epoch = 0
  reserveFault?: 'before' | 'after'
  casFault?: 'before' | 'after'
  constructor(readonly kind: 'submission-intent' | 'exclusive-execution') {}
  port(epoch = this.epoch) {
    return {
      kind: this.kind,
      load: async (id: string) => copy(this.rows.get(id) ?? null),
      reserve: async (job: Job) => {
        if (epoch !== this.epoch) throw new Error('FIXTURE_LEASE_EXPIRED')
        const fault = this.reserveFault
        this.reserveFault = undefined
        if (fault === 'before') throw new Error('FIXTURE_WRITE_REFUSED')
        if (this.rows.has(job.id)) return 'existing'
        if (this.kind === 'exclusive-execution' && [...this.rows.values()].some(j => !['succeeded', 'rejected'].includes(j.status))) return 'busy'
        this.rows.set(job.id, copy(job))
        if (fault === 'after') throw new Error('FIXTURE_ACK_LOST')
        return 'created'
      },
      compareAndSet: async (previous: Job, next: Job) => {
        const fault = this.casFault
        this.casFault = undefined
        if (epoch !== this.epoch || fault === 'before' || this.rows.get(previous.id)?.revision !== previous.revision) return false
        this.rows.set(next.id, copy(next))
        return fault !== 'after'
      },
    }
  }
}

function setup(t: TestContext) {
  const app = new Store('submission-intent')
  const remote = new Store('exclusive-execution')
  let clock = INITIAL_TIME
  t.mock.method(Date, 'now', () => clock)
  let compute = 0
  let posts = 0
  let polls = 0
  let dropResponse = false
  const complete = deferred()
  const forbidden: string[] = []
  const q = config.qualification
  const ports = () => ({
    journal: remote.port(),
    artifacts: {
      put: async () => { forbidden.push('artifact-write'); throw new Error('NO_MEDIA_EXPECTED') },
      get: async () => { forbidden.push('artifact-read'); return null },
    },
    inspect: async () => ({ platform: 'linux', architecture: 'x64', image: q.image, cuda: q.cuda, gpu: q.gpu,
      vramMiB: q.vramMiB, freeVramMiB: q.vramMiB, modelSha256: q.modelSha256,
      encoderSha256: q.encoderSha256, vaeSha256: q.vaeSha256, state: 'idle' }),
    bridge: {
      health: async () => true,
      generate: async () => { compute++; await complete.promise; throw new Error('FIXTURE_REMOTE_PROCESS_INTERRUPTED') },
    },
  })
  let worker = createSaladWorker(config, ports())
  const fetcher: typeof fetch = async (url, init) => {
    const request = new Request(url, init)
    const parsed = new URL(request.url)
    assert.equal(parsed.origin, config.gatewayUrl)
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal)
    if (request.method === 'POST') {
      posts++
      const body = await request.clone().json() as { id: string }
      assert.ok(app.rows.has(body.id), 'real client must persist intention before sending POST')
    } else if (parsed.pathname.startsWith('/v1/jobs/')) polls++
    const response = await worker.handle(request)
    if (request.method === 'POST' && dropResponse) throw new DOMException('FIXTURE_TIMEOUT_AFTER_ACCEPT', 'TimeoutError')
    return response
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { forbidden.push('un-injected-network'); throw new Error('T03_NO_NETWORK') }
  t.after(() => { globalThis.fetch = originalFetch; assert.deepEqual(forbidden, []) })
  return {
    app, remote, client: () => createSaladClient(config, app.port(), fetcher),
    counts: () => ({ compute, posts, polls }),
    timeoutResponse: () => { dropResponse = true },
    interrupt: async () => { complete.resolve(); await worker.drain() },
    drain: () => worker.drain(),
    expire: () => { clock += config.generationTimeoutMs + 1 },
    replaceWorker: () => { worker = createSaladWorker(config, ports()) },
  }
}

test('actual client + worker: accepted POST response lost, interrupted process, reconstruction polls same ID only', async t => {
  const h = setup(t)
  h.timeoutResponse()
  const unknown = await h.client().submit('scope-t03', 'scene-0', input, 1)
  assert.equal(unknown.status, 'unknown')
  await h.interrupt()
  h.replaceWorker()
  for (let i = 0; i < 12; i++) {
    const resumed = await h.client().submit('scope-t03', 'scene-0', input, 1)
    assert.equal(resumed.id, unknown.id)
    assert.equal(resumed.status, 'unknown')
  }
  assert.deepEqual(h.counts(), { compute: 1, posts: 1, polls: 12 })
  assert.equal(h.remote.rows.size, 1)
})

for (const fault of ['before', 'after'] as const) {
  test(`client intent ${fault}-write interruption: no POST before confirmed reserve`, async t => {
    const h = setup(t)
    h.app.reserveFault = fault
    await assert.rejects(h.client().submit('scope-t03', 'scene-0', input, 1), /FIXTURE_/)
    assert.equal(h.counts().posts, 0)
    if (fault === 'after') {
      for (let i = 0; i < 6; i++) assert.equal((await h.client().submit('scope-t03', 'scene-0', input, 1)).status, 'unknown')
      assert.deepEqual(h.counts(), { compute: 0, posts: 0, polls: 6 })
    } else {
      await h.client().submit('scope-t03', 'scene-0', input, 1)
      await h.interrupt()
      assert.equal(h.counts().compute, 1)
    }
  })
}

test('client accepted-state receipt lost after commit: reconstructed client GETs durable remote ID', async t => {
  const h = setup(t)
  h.app.casFault = 'after'
  await assert.rejects(h.client().submit('scope-t03', 'scene-0', input, 1), /SALAD_JOURNAL_CONFLICT/)
  await h.interrupt()
  h.replaceWorker()
  const resumed = await h.client().submit('scope-t03', 'scene-0', input, 1)
  assert.equal(resumed.status, 'unknown')
  assert.deepEqual(h.counts(), { compute: 1, posts: 1, polls: 1 })
})

test('remote execution reserve committed but ACK lost: restart never computes an ambiguous existing claim', async t => {
  const h = setup(t)
  h.remote.reserveFault = 'after'
  const first = await h.client().submit('scope-t03', 'scene-0', input, 1)
  assert.equal(first.status, 'unknown')
  h.expire()
  h.replaceWorker()
  assert.equal((await h.client().resume('scope-t03', 'scene-0', input)).status, 'unknown')
  assert.deepEqual(h.counts(), { compute: 0, posts: 1, polls: 1 })
  assert.equal([...h.remote.rows.values()][0].status, 'running', 'expiry cannot erase the durable claim')
})

test('expired remote owner cannot checkpoint; fresh worker GET reports unknown and never starts compute', async t => {
  const h = setup(t)
  await h.client().submit('scope-t03', 'scene-0', input, 1)
  h.remote.epoch++
  h.expire()
  await assert.rejects(h.interrupt(), /SALAD_PERSISTENCE_UNCERTAIN/)
  h.replaceWorker()
  assert.equal((await h.client().submit('scope-t03', 'scene-0', input, 1)).status, 'unknown')
  assert.deepEqual(h.counts(), { compute: 1, posts: 1, polls: 1 })
  assert.equal([...h.remote.rows.values()][0].revision, 0)
})

test('UNKNOWN holds execution slot after restart and deadline; different operation cannot start a second engine', async t => {
  const h = setup(t)
  await h.client().submit('scope-t03', 'scene-0', input, 1)
  await h.interrupt()
  h.expire()
  h.replaceWorker()
  const blocked = await h.client().submit('scope-t03', 'scene-1', input, 1)
  assert.equal(blocked.status, 'unknown')
  assert.equal(blocked.lastHttpStatus, 409)
  assert.deepEqual(h.counts(), { compute: 1, posts: 2, polls: 0 })
  assert.equal(h.remote.rows.size, 1)
})

test('concurrent reconstructed clients keep one remote submission even with racing reconciliation CAS', async t => {
  const h = setup(t)
  const attempts = await Promise.allSettled(Array.from({ length: 24 }, () => h.client().submit('scope-t03', 'scene-0', input, 1)))
  assert.ok(attempts.some(result => result.status === 'fulfilled'))
  for (const result of attempts) {
    if (result.status === 'rejected') assert.match(String(result.reason), /SALAD_JOURNAL_CONFLICT/)
  }
  await h.interrupt()
  assert.equal(h.counts().posts, 1)
  assert.equal(h.counts().compute, 1)
  assert.equal(h.app.rows.size, 1)
})

test('replayed operation with different input refuses before GET/POST and preserves original checkpoint', async t => {
  const h = setup(t)
  await h.client().submit('scope-t03', 'scene-0', input, 1)
  const original = copy([...h.app.rows.values()])
  await assert.rejects(h.client().submit('scope-t03', 'scene-0', { ...input, prompt: 'changed input' }, 1), /SALAD_IDEMPOTENCY_CONFLICT/)
  assert.deepEqual([...h.app.rows.values()], original)
  await h.interrupt()
  assert.deepEqual(h.counts(), { compute: 1, posts: 1, polls: 0 })
})
