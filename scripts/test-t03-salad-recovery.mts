/** T03: real worker/queue glue, transport-only doubles. No database/Salad runtime certification. */
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { VideoJob } from '../src/lib/video-queue'
import type { ProductionJobInput } from '../src/lib/production-pipeline'
import { MODEL, PROTOCOL } from '../src/lib/salad/contracts'

// Synthetic configuration only; no credentials, GPU or external transport.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.fixture.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fixture-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service'
const now = Date.now()
const qualification = { id: 'queue-fixture', evidenceSha256: 'a'.repeat(64), verifiedAt: now - 1000,
  image: `fixture/worker@sha256:${'b'.repeat(64)}`, architecture: 'linux/amd64', cuda: '12.0',
  gpu: 'FIXTURE-NO-GPU', vramMiB: 24000, requiredFreeVramMiB: 20000, model: MODEL,
  modelSha256: 'c'.repeat(64), encoderSha256: 'd'.repeat(64), vaeSha256: 'e'.repeat(64),
  profiles: [{ width: 1280, height: 736, num_frames: 81, fps: 16 }] }
const quote = { currency: 'USD', hourlyRate: 1, observedAt: now - 1000, expiresAt: now + 3600000,
  source: 'salad-approved-quote', evidenceSha256: 'f'.repeat(64) }
Object.assign(process.env, { SALAD_ENABLED: 'true', SALAD_GATEWAY_URL: 'https://queue-fixture.salad.cloud',
  SALAD_API_KEY: 'fixture-gateway-'.repeat(3), SALAD_WORKER_TOKEN: 'fixture-worker-'.repeat(3),
  SALAD_QUALIFICATION_JSON: JSON.stringify(qualification), SALAD_QUOTE_JSON: JSON.stringify(quote),
  SALAD_REQUEST_TIMEOUT_MS: '1000', SALAD_GENERATION_TIMEOUT_MS: '10000', SALAD_MAX_ESTIMATED_COMPUTE_USD: '1' })

const { runVideoJob } = await import('../src/lib/video-worker')
const { checkpoint, claimJobByKey, finishJob } = await import('../src/lib/video-queue')
const clone = <T,>(value: T): T => structuredClone(value)
const USER = '00000000-0000-4000-8000-000000000003'
const JOB = '00000000-0000-4000-8000-000000000030'
const WORKER = 't03-worker-a'
const otherSteps = {
  script: { title: 'Previously persisted script' },
  'stage:voice': { status: 'complete', value: 'fixture-voice' },
  'stage:music': { status: 'complete', value: 'fixture-music' },
  'stage:subtitles': { status: 'complete', value: ['fixture-subtitle'] },
  'stage:publication': { status: 'pending', value: 'not published' },
}
const cachedScene = { url: 'https://media.fixture.invalid/scene.mp4', engine: 'wan-classic', source: 'wan' }

function newJob(): VideoJob {
  const input: ProductionJobInput = {
    step: 'video', userId: USER, userEmail: 'matiss.frasne@gmail.com', userPlan: 'empire', genPlan: 'empire',
    qualityCap: '720p', mediaFormat: '16:9', idea: 'T03 interruption fixture', template: null,
    format: '16:9', voice: null, musicStyle: 'none', tone: null, brandKit: null, requestKey: 't03-recovery',
    previousData: { script: {
      title: 'Fixture', description: '', tags: [], narration: 'Fixture narration',
      scenes: [{ visual_prompt: 'A still landscape', duration_seconds: 5, use_stock: false }],
      music_prompt: '', music_style: 'none', thumbnail_prompt: '', estimated_duration: 5,
    } },
  }
  return {
    id: JOB, video_id: null, user_id: USER, kind: 'production', payload: { input },
    progress: { steps: clone(otherSteps), scenes: { preserved: 'other checkpoint' } },
    provider_job_ids: {}, status: 'processing', attempts: 1, max_attempts: 100,
    locked_by: WORKER, last_error: null, idempotency_key: 't03-recovery',
  }
}

interface Fault { rpc: string; key?: string; receipt: unknown; commit?: boolean; http?: number; expire?: boolean }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

/** Minimal lease/receipt fault double, NOT a replacement implementation or proof of SQL CAS. */
class Transport {
  row = newJob()
  now = 0
  expires = 600
  submissions = 0
  polls = 0
  forbidden: string[] = []
  trace: string[] = []
  faults: Fault[] = []
  events = new Set<string>()
  remote: () => Promise<Response> = async () => { throw new DOMException('fixture lost response', 'TimeoutError') }
  steps() { return this.row.progress.steps as Record<string, unknown> }
  expire() { this.now = this.expires + 1 }
  snapshot() { return clone(this.row) }
  async claim(worker: string) {
    const claimed = await claimJobByKey(this.row.idempotency_key, worker)
    assert.ok(claimed, 'fixture expects a claimable row')
    return claimed
  }
  async fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = new URL(input instanceof Request ? input.url : input)
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const raw = init?.body ?? (input instanceof Request ? await input.text() : '')
    const body = raw ? JSON.parse(String(raw)) as Record<string, unknown> : {}
    const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
      status, headers: { 'content-type': 'application/json' },
    })
    if (url.href === 'https://queue-fixture.salad.cloud/v1/capabilities' && method === 'GET') {
      return json({ protocol: PROTOCOL, provider: 'salad', state: 'ready', qualification, quote,
        operations: ['text-to-video'], audio: false, native4k: false, maxConcurrent: 1,
        quotaRemaining: null, generationTimeoutMs: 10000 })
    }
    if (url.origin === 'https://queue-fixture.salad.cloud' && url.pathname.startsWith('/v1/jobs/') && method === 'GET') {
      this.polls++
      const state = this.steps()['scene:0:ltx'] as { id: string; salad: { status: string } }
      assert.equal(url.pathname, `/v1/jobs/${state.id}`)
      return json({ ...state.salad, status: 'unknown' })
    }
    if (url.href === 'https://queue-fixture.salad.cloud/v1/jobs' && method === 'POST') {
      this.submissions++
      this.trace.push('remote:POST')
      assert.equal(this.steps()['scene:0:started'], true, 'intent must be acknowledged before POST')
      const state = this.steps()['scene:0:ltx'] as { id: string; salad: { status: string } }
      assert.equal(state.id, body.id, 'durable Salad identity acknowledged before POST')
      assert.equal(state.salad.status, 'submitting')
      assert.deepEqual(body.input, { prompt: 'A still landscape', profile: qualification.profiles[0] })
      assert.equal(init?.redirect, 'error')
      assert.ok(init?.signal, 'remote request must carry a timeout signal')
      return this.remote()
    }
    if (url.origin === 'https://supabase.fixture.invalid' && method === 'POST') {
      if (url.pathname === '/rest/v1/video_generations') {
        assert.equal(body.fallback_triggered, false)
        assert.equal(body.engine_used, 'local')
        return json(null, 201) // Non-authoritative observability only.
      }
      const rpc = url.pathname.replace('/rest/v1/rpc/', '')
      const progress = body.p_progress as Record<string, unknown> | undefined
      const delta = progress?.steps as Record<string, unknown> | undefined
      const key = delta ? Object.keys(delta).join(',') : progress ? 'result' : undefined
      this.trace.push(`${rpc}:${key ?? ''}:${String(body.p_worker)}`)
      if (rpc === 'claim_video_job_by_key') {
        assert.equal(body.p_key, this.row.idempotency_key)
        if (!['processing', 'queued'].includes(this.row.status) || (this.row.status === 'processing' && this.expires > this.now)) return json([])
        this.row.locked_by = String(body.p_worker)
        this.row.status = 'processing'
        this.row.attempts++
        this.expires = this.now + Number(body.p_lease_seconds)
        return json([this.snapshot()])
      }
      const faultAt = this.faults.findIndex(f => f.rpc === rpc && (!f.key || f.key === key))
      const fault = faultAt < 0 ? undefined : this.faults.splice(faultAt, 1)[0]
      if (fault?.expire) this.expire()
      assert.equal(body.p_job_id, JOB)
      const owns = this.row.status === 'processing' && this.row.locked_by === body.p_worker && this.expires > this.now
      let receipt: unknown = owns
      if (owns && (!fault || fault.commit)) {
        if (rpc === 'heartbeat_video_job_v2') this.expires = this.now + Number(body.p_lease_seconds)
        else if (rpc === 'checkpoint_video_job_v2') {
          assert.ok(progress)
          this.row.progress = { ...this.row.progress, ...clone(progress), steps: { ...this.steps(), ...clone(delta ?? {}) } }
        } else if (rpc === 'record_video_job_event') this.events.add(String(body.p_key))
        else if (rpc === 'finish_video_job') {
          const requested = body.p_status as VideoJob['status']
          this.row.status = requested === 'queued' && String(body.p_error).includes('SUTRA_RECONCILIATION_REQUIRED')
            ? 'reconciliation_required' : requested
          this.row.locked_by = null
          receipt = this.row.status
        } else {
          this.forbidden.push(`RPC:${rpc}`)
          throw new Error('T03_UNEXPECTED_WRITE')
        }
      }
      return json(fault ? fault.receipt : receipt, fault?.http ?? 200)
    }
    this.forbidden.push(`${method}:${url.origin}${url.pathname}`)
    throw new Error('T03_UNEXPECTED_NETWORK')
  }
  safe() {
    assert.deepEqual(this.forbidden, [], 'no provider fallback, ready write, storage or publication request')
    for (const [key, value] of Object.entries(otherSteps)) assert.deepEqual(this.steps()[key], value)
    assert.deepEqual(this.row.progress.scenes, { preserved: 'other checkpoint' })
    assert.equal(this.faults.length, 0, 'every injected fault must have been reached')
  }
}

function scenario(t: TestContext, cached = false) {
  const transport = new Transport()
  if (cached) transport.steps()['scene:0'] = clone(cachedScene)
  const originalFetch = globalThis.fetch
  globalThis.fetch = transport.fetch.bind(transport)
  t.after(() => { globalThis.fetch = originalFetch; transport.safe() })
  return transport
}

for (const interruption of ['timeout', 'worker-disconnect', 'accepted-202'] as const) {
  test(`remote ${interruption}: acknowledged intent survives 12 restarts, no second POST or paid fallback`, async t => {
    const h = scenario(t)
    h.remote = async () => {
      if (interruption === 'accepted-202') return new Response(JSON.stringify({ job_id: 'remote-fixture', status: 'queued' }), { status: 202 })
      throw interruption === 'timeout' ? new DOMException('fixture', 'TimeoutError') : new TypeError('fixture connection reset')
    }
    await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SALAD_RECONCILIATION_REQUIRED/)
    assert.equal(h.submissions, 1)
    assert.equal(h.steps()['scene:0:started'], true)
    assert.equal(h.steps()['scene:0'], undefined)
    const intent = clone(h.steps()['scene:0:ltx']) as { id: string }
    assert.match(intent.id, /^[a-f0-9]{64}$/)
    for (let i = 0; i < 12; i++) {
      h.expire()
      const worker = `restart-${i}`
      await assert.rejects(runVideoJob(await h.claim(worker), worker), /SALAD_RECONCILIATION_REQUIRED/)
      assert.equal((h.steps()['scene:0:ltx'] as { id: string }).id, intent.id)
    }
    assert.equal(h.submissions, 1)
    assert.equal(h.polls, 12)
    assert.equal(await finishJob(JOB, 'restart-11', 'queued', 'SUTRA_RECONCILIATION_REQUIRED'), 'reconciliation_required')
    assert.equal(await claimJobByKey(h.row.idempotency_key, 'another-worker'), null)
    assert.equal(h.row.progress.result, undefined)
  })
}

test('lease expires inside intent RPC: stale worker never submits; new owner may submit once', async t => {
  const h = scenario(t)
  h.faults.push({ rpc: 'checkpoint_video_job_v2', key: 'scene:0:started', receipt: false, expire: true })
  await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_CHECKPOINT_FAILED/)
  assert.equal(h.submissions, 0)
  assert.equal(h.steps()['scene:0:started'], undefined)
  await assert.rejects(runVideoJob(await h.claim('new-owner'), 'new-owner'), /SALAD_RECONCILIATION_REQUIRED/)
  assert.equal(h.submissions, 1)
})

test('intent committed but acknowledgement lost: neither old nor replacement worker submits', async t => {
  const h = scenario(t)
  h.faults.push({ rpc: 'checkpoint_video_job_v2', key: 'scene:0:started', receipt: null, commit: true })
  await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_CHECKPOINT_FAILED/)
  h.expire()
  await assert.rejects(runVideoJob(await h.claim('new-owner'), 'new-owner'), /SUTRA_RECONCILIATION_REQUIRED/)
  assert.equal(h.submissions, 0)
})

test('replacement worker while remote POST is pending cannot resubmit; late owner cannot finalize', async t => {
  const h = scenario(t)
  const entered = deferred<void>()
  const release = deferred<void>()
  h.remote = async () => { entered.resolve(); await release.promise; throw new TypeError('worker interrupted') }
  const first = assert.rejects(runVideoJob(h.snapshot(), WORKER), /SALAD_SAFE_FAILURE/)
  await entered.promise
  h.expire()
  const claimed = await h.claim('replacement')
  await assert.rejects(runVideoJob(claimed, 'replacement'), /SALAD_RECONCILIATION_REQUIRED/)
  const beforeLateOwner = h.snapshot()
  release.resolve()
  await first
  await assert.rejects(checkpoint(JOB, WORKER, { result: 'late-result' }), /SUTRA_CHECKPOINT_FAILED/)
  await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
  assert.deepEqual(h.snapshot(), beforeLateOwner)
  assert.equal(h.submissions, 1)
})

test('24 concurrent claimants exercise queue RPC contract; only granted snapshot enters worker', async t => {
  const h = scenario(t)
  h.expire()
  const claims = await Promise.all(Array.from({ length: 24 }, (_, i) => claimJobByKey(h.row.idempotency_key, `worker-${i}`)))
  const granted = claims.filter((row): row is VideoJob => row !== null)
  assert.equal(granted.length, 1, 'transport fixture grants one lease; actual SQL proof is separate')
  await assert.rejects(runVideoJob(granted[0], granted[0].locked_by!), /SALAD_RECONCILIATION_REQUIRED/)
  assert.equal(h.submissions, 1)
})

for (const fault of [
  { receipt: false }, { receipt: null }, { receipt: 'true' },
  { receipt: { message: 'fixture unavailable', code: 'fixture' }, http: 503 },
]) {
  test(`unconfirmed intent receipt ${JSON.stringify(fault.receipt)} prevents any submission`, async t => {
    const h = scenario(t)
    h.faults.push({ rpc: 'checkpoint_video_job_v2', key: 'scene:0:started', ...fault })
    await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_CHECKPOINT_FAILED/)
    assert.equal(h.submissions, 0)
    assert.equal(h.steps()['scene:0:started'], undefined)
  })
}

for (const boundary of ['stage:scenes', 'stage:images', 'result']) {
  test(`persisted scene survives lost ${boundary} receipt; replay retains independent checkpoints`, async t => {
    const h = scenario(t, true)
    h.faults.push({ rpc: 'checkpoint_video_job_v2', key: boundary, receipt: null, commit: true })
    await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_CHECKPOINT_FAILED/)
    h.expire()
    const resumed = await runVideoJob(await h.claim('resumed'), 'resumed')
    assert.deepEqual(resumed, [cachedScene])
    assert.deepEqual(h.row.progress.result, [cachedScene])
    assert.deepEqual(h.steps()['stage:scenes'], { status: 'complete', value: [cachedScene] })
    assert.deepEqual(h.steps()['stage:images'], { status: 'skipped', value: [] })
    assert.equal(h.submissions, 0)
    assert.equal(h.events.size, 1)
    assert.equal(h.row.status, 'processing', 'a raw scene is not a ready video')
  })
}

test('event acknowledgement loss propagates; replay is idempotent and does not regenerate cached scene', async t => {
  const h = scenario(t, true)
  h.faults.push({ rpc: 'record_video_job_event', receipt: null, commit: true })
  await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_EVENT_PERSISTENCE_FAILED/)
  assert.equal(h.row.progress.result, undefined)
  h.expire()
  await runVideoJob(await h.claim('resumed'), 'resumed')
  assert.equal(h.events.size, 1)
  assert.equal(h.submissions, 0)
})

test('heartbeat and snapshot ownership refusals stop the real executor before any external work', async t => {
  const h = scenario(t)
  const wrong = h.snapshot()
  await assert.rejects(runVideoJob(wrong, 'wrong-owner'), /SUTRA_JOB_LEASE_LOST/)
  const invalid = h.snapshot()
  invalid.user_id = 'different-user'
  await assert.rejects(runVideoJob(invalid, WORKER), /SUTRA_INVALID_JOB_OWNER/)
  assert.equal(h.trace.length, 0)
  h.faults.push({ rpc: 'heartbeat_video_job_v2', receipt: false })
  await assert.rejects(runVideoJob(h.snapshot(), WORKER), /SUTRA_JOB_LEASE_LOST/)
  assert.equal(h.submissions, 0)
})
