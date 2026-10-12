import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createLtxClient, LtxJobError, cancelLtxJob, handleLtxWebhook, type LtxJob, type LtxJobStore } from '../src/lib/ltx-v2.ts'
import { validateLtxRequest, LTX_CAPABILITIES, type LtxEndpoint } from '../src/lib/ltx-v2-contract.ts'

process.env.LTX_API_KEY = 'contract-test-not-a-real-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://database.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'contract-test-not-a-real-key'
// Fail closed for any accidentally uninjected request, including DB/provider calls.
globalThis.fetch = async () => { throw new Error('UNMOCKED_NETWORK_FORBIDDEN') }
const { executionForCheckpoint } = await import('../src/lib/ltx-checkpoint.ts')
const { durableLtxJob } = await import('../src/lib/ltx-workflow.ts')
const T = '2026-10-12T10:00:00.000Z'
const request = { prompt: 'A slow pan', model: 'ltx-2-3-fast', duration: 6, resolution: '1280x720' } as const
const media = { durationSeconds: 8, width: 1920, height: 1080, fps: 24 }
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } })
const accepted = () => json({ id: 'job-123', created_at: T }, 202)
const status = (state: string, extra = {}) => json({ id: 'job-123', created_at: T, status: state, ...(state === 'completed' || state === 'failed' ? { completed_at: T } : {}), ...extra })
const done = () => status('completed', { result: { video_url: 'https://media.example.test/output.mp4' } })
function memoryStore() {
  const rows = new Map<string, LtxJob>()
  const store: LtxJobStore = {
    async load(key) { return structuredClone(rows.get(key) ?? null) },
    async compareAndSet(key, expected, next) {
      if (expected === null ? rows.has(key) : rows.get(key)?.revision !== expected) return false
      rows.set(key, structuredClone(next)); return true
    },
  }
  return { rows, store }
}
function harness(responses: Array<Response | Error | ((url: string, init?: RequestInit) => Response)> = [], store = memoryStore().store) {
  let time = Date.parse(T)
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const sleeps: number[] = []
  const client = createLtxClient({
    download: async (url) => {
      calls.push({ url, init: { cache: 'no-store', redirect: 'error' } })
      const next = responses.shift()
      if (next instanceof Error) throw next
      if (!next) throw new Error('UNEXPECTED_DOWNLOAD')
      const response = typeof next === 'function' ? next(url, { cache: 'no-store', redirect: 'error' }) : next
      if (!response.ok) throw new Error('DOWNLOAD_HTTP')
      return Buffer.from(await response.arrayBuffer())
    },
    now: () => time, random: () => 0.5,
    sleep: async (ms) => { sleeps.push(ms); time += ms },
    fetch: async (url, init) => {
      calls.push({ url: String(url), init })
      const next = responses.shift()
      if (next instanceof Error) throw next
      if (!next) throw new Error('UNEXPECTED_HTTP')
      return typeof next === 'function' ? next(String(url), init) : next
    },
  })
  const execution = { operationKey: 'scene-1', store, timeoutMs: 30_000 }
  return { client, calls, execution, sleeps }
}
const code = (expected: string) => (error: unknown) => {
  assert.ok(error instanceof LtxJobError)
  assert.equal(error.code, expected)
  assert.equal(error.retrySubmission, false)
  assert.equal(error.fallbackAllowed, false)
  return true
}

test('V2: one POST, durable ID, processing/completed, safe output download and truthful cost', async () => {
  const h = harness([accepted(), status('processing'), done(), new Response(new Uint8Array([1, 2, 3, 4]))])
  const job = await h.client.submit('text-to-video', request, h.execution)
  assert.equal((await h.execution.store.load(job.key))?.id, 'job-123')
  assert.equal(job.remoteStatus, 'unknown')
  const result = await h.client.wait(job, h.execution)
  assert.equal(result.remoteStatus, 'completed')
  assert.equal(result.cost.estimated, 0.18)
  assert.equal(result.cost.actual, null)
  assert.equal(result.cost.actualStatus, 'not_reported')
  assert.equal(result.quota.remaining, null)
  assert.equal((await h.client.download(result)).byteLength, 4)
  assert.deepEqual(h.sleeps, [5500])
  assert.equal(h.calls[0].url, 'https://api.ltx.io/v2/text-to-video')
  assert.equal(h.calls[1].url, 'https://api.ltx.io/v2/text-to-video/job-123')
  assert.equal(h.calls.filter(c => c.init?.method === 'POST').length, 1)
  assert.equal(h.calls[3].init?.headers, undefined, 'bearer never sent to output host')
  for (const c of h.calls) { assert.equal(c.init?.cache, 'no-store'); assert.equal(c.init?.redirect, 'error') }
  assert.ok(!('Idempotency-Key' in h.calls[0].init!.headers!))
})

test('resume after worker restart and repeat submit reuse the same job without POST', async () => {
  const m = memoryStore()
  const h = harness([accepted()], m.store)
  await h.client.submit('text-to-video', request, h.execution)
  const restarted = harness([done()], m.store)
  await restarted.client.submit('text-to-video', request, restarted.execution)
  const result = await restarted.client.resume(restarted.execution)
  assert.equal(result.id, 'job-123')
  assert.equal(restarted.calls.length, 1)
  assert.notEqual(restarted.calls[0].init?.method, 'POST')
  assert.equal((await restarted.client.submit('text-to-video', request, restarted.execution)).state, 'completed')
})

test('simultaneous submissions use atomic claim; exactly one paid request', async () => {
  const h = harness([accepted()])
  await Promise.allSettled(Array.from({ length: 16 }, () => h.client.submit('text-to-video', request, h.execution)))
  assert.equal(h.calls.length, 1)
})

test('same operation with changed content rejects, including references/media metadata', async () => {
  const h = harness([accepted()])
  await h.client.submit('text-to-video', request, h.execution)
  await assert.rejects(h.client.submit('text-to-video', { ...request, prompt: 'different' }, h.execution), code('LTX_OPERATION_CONFLICT'))
  assert.equal(h.calls.length, 1)
})

for (const [name, response] of [
  ['lost network response', new Error('lost')], ['HTTP 500', json({}, 500)], ['HTTP 503', json({}, 503)],
  ['malformed 202', json({ id: '../bad', created_at: T }, 202)], ['legacy binary HTTP 200', new Response(new Uint8Array([1]))],
  ['null body', json(null, 202)],
] as const) {
  test(`uncertain paid outcome: ${name}; persistent barrier prevents retry/fallback`, async () => {
    const h = harness([response])
    await assert.rejects(h.client.submit('text-to-video', request, h.execution), code('LTX_SUBMISSION_UNKNOWN'))
    await assert.rejects(h.client.submit('text-to-video', request, h.execution), code('LTX_SUBMISSION_REQUIRES_RECONCILIATION'))
    assert.equal(h.calls.length, 1)
  })
}
test('malformed acceptance retains a valid paid job ID for GET-only reconciliation', async () => {
  const h = harness([json({ id: 'job-123' }, 202), done()])
  await assert.rejects(h.client.submit('text-to-video', request, h.execution), (error) => {
    assert.ok(error instanceof LtxJobError)
    assert.equal(error.code, 'LTX_SUBMISSION_UNKNOWN')
    assert.equal(error.job?.id, 'job-123')
    assert.equal(error.job?.remoteCreatedAt, null)
    return true
  })
  const result = await h.client.resume(h.execution)
  assert.equal(result.id, 'job-123')
  assert.equal(result.state, 'completed')
  assert.equal(result.remoteCreatedAt, T)
  await h.client.submit('text-to-video', request, h.execution)
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls.filter(call => call.init?.method === 'POST').length, 1)
})
for (const http of [400, 401, 402, 403, 404, 422, 429]) {
  test(`submission HTTP ${http}: explicit status/quota, no automatic resubmission`, async () => {
    const h = harness([json({ error: { type: 'api_error', message: 'not logged' } }, http, { 'retry-after': '19' })])
    await assert.rejects(h.client.submit('text-to-video', request, h.execution), (error) => {
      assert.ok(error instanceof LtxJobError)
      assert.equal(error.job?.state, 'rejected')
      assert.equal(error.job?.lastHttpStatus, http)
      assert.equal(error.job?.quota.retryAfterSeconds, 19)
      assert.equal(error.job?.quota.status, http === 402 ? 'insufficient_credits' : http === 429 ? 'queue_limited' : 'unknown')
      return true
    })
    await assert.rejects(h.client.submit('text-to-video', request, h.execution))
    assert.equal(h.calls.length, 1)
  })
}

test('journal failure before submission prevents spending', async () => {
  const h = harness([], { load: async () => null, compareAndSet: async () => { throw new Error('db unavailable') } })
  await assert.rejects(h.client.submit('text-to-video', request, h.execution), code('LTX_JOURNAL_UNAVAILABLE'))
  assert.equal(h.calls.length, 0)
})

test('accepted but checkpoint lost: expose remote ID, never automatically reclaim submitting record', async () => {
  const m = memoryStore()
  const h = harness([accepted()], { ...m.store, compareAndSet: (k, r, n) => r === null ? m.store.compareAndSet(k, r, n) : Promise.reject(new Error('write lost')) })
  await assert.rejects(h.client.submit('text-to-video', request, h.execution), (e) => {
    assert.ok(e instanceof LtxJobError); assert.equal(e.code, 'LTX_CHECKPOINT_UNCONFIRMED'); assert.equal(e.job?.id, 'job-123'); return true
  })
  await assert.rejects(h.client.submit('text-to-video', request, h.execution), code('LTX_SUBMISSION_REQUIRES_RECONCILIATION'))
  assert.equal(h.calls.length, 1)
})

test('GET failures back off and recover without POST; Retry-After respected', async () => {
  const h = harness([accepted(), json({}, 429, { 'retry-after': '12' }), done()])
  const job = await h.client.submit('text-to-video', request, h.execution)
  assert.equal((await h.client.wait(job, h.execution)).state, 'completed')
  assert.deepEqual(h.sleeps, [12_000])
  assert.equal(h.calls.filter(c => c.init?.method === 'POST').length, 1)
})

test('local timeout retains remote job, and a later resume succeeds', async () => {
  const h = harness([accepted(), status('pending'), done()])
  const job = await h.client.submit('text-to-video', request, h.execution)
  await assert.rejects(h.client.wait(job, { ...h.execution, timeoutMs: 5000 }), code('LTX_WAIT_TIMEOUT_REMOTE_UNCHANGED'))
  assert.equal((await h.client.resume(h.execution)).state, 'completed')
  assert.equal(h.calls.filter(c => c.init?.method === 'POST').length, 1)
})

test('local cancellation is explicit; no undocumented remote DELETE or webhook acceptance', async () => {
  const h = harness([accepted()])
  const job = await h.client.submit('text-to-video', request, h.execution)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(h.client.wait(job, { ...h.execution, signal: controller.signal }), code('LTX_WAIT_CANCELLED_REMOTE_UNCHANGED'))
  assert.deepEqual(cancelLtxJob(job), { supported: false, code: 'LTX_REMOTE_CANCELLATION_UNSUPPORTED', remoteStatus: 'unknown', jobId: 'job-123', mayStillBeBilled: true })
  assert.throws(handleLtxWebhook, code('LTX_WEBHOOK_UNSUPPORTED_USE_POLLING'))
  assert.equal(h.calls.length, 1)
})

test('remote failure is retained as terminal; no post/fallback on resume', async () => {
  const h = harness([accepted(), status('failed', { error: { type: 'content_filtered_error', message: 'sensitive input' } })])
  await assert.rejects(h.client.wait(await h.client.submit('text-to-video', request, h.execution), h.execution), code('LTX_REMOTE_FAILED'))
  await assert.rejects(h.client.resume(h.execution), code('LTX_REMOTE_FAILED'))
  assert.equal(h.calls.length, 2)
})

test('404 expiry is not proof of failure or permission to spend again', async () => {
  const h = harness([accepted(), json({}, 404)])
  await assert.rejects(h.client.wait(await h.client.submit('text-to-video', request, h.execution), h.execution), (e) => {
    assert.ok(e instanceof LtxJobError); assert.equal(e.job?.remoteStatus, 'not_found'); assert.equal(e.job?.state, 'accepted'); return true
  })
  assert.equal(h.calls.length, 2)
})

for (const body of [{ id: 'wrong', created_at: T, status: 'completed' }, { id: 'job-123', created_at: T, status: 'cancelled' }, { id: 'job-123', created_at: T, status: 'completed', result: {} }]) {
  test(`invalid polling contract rejected: ${JSON.stringify(body)}`, async () => {
    const h = harness([accepted(), json(body)])
    await assert.rejects(h.client.wait(await h.client.submit('text-to-video', request, h.execution), h.execution), code('LTX_INVALID_POLL_RESPONSE'))
    assert.equal(h.calls.length, 2)
  })
}
for (const url of ['http://output.test/v.mp4', 'https://127.0.0.1/a', 'https://localhost/a', 'https://user:pass@cdn.test/a']) {
  test(`reject unsafe output URL ${new URL(url).hostname}`, async () => {
    const h = harness([accepted(), status('completed', { result: { video_url: url } })])
    await assert.rejects(h.client.wait(await h.client.submit('text-to-video', request, h.execution), h.execution), code('LTX_INVALID_OUTPUT'))
    assert.equal(h.calls.length, 2)
  })
}

test('output download failure can be retried without generation', async () => {
  const h = harness([accepted(), done(), json({}, 403), new Response(new Uint8Array([1]))])
  const job = await h.client.wait(await h.client.submit('text-to-video', request, h.execution), h.execution)
  await assert.rejects(h.client.download(job), code('LTX_OUTPUT_DOWNLOAD_FAILED_RESUME_SAME_JOB'))
  assert.equal((await h.client.download(job)).byteLength, 1)
  assert.equal(h.calls.filter(c => c.init?.method === 'POST').length, 1)
})

const endpoints: Array<[LtxEndpoint, Record<string, unknown>, number]> = [
  ['text-to-video', request, 0.18],
  ['image-to-video', { ...request, image_uri: 'https://input.test/first.png', last_frame_uri: 'https://input.test/last.png' }, 0.18],
  ['retake', { video_uri: 'https://input.test/v.mp4', start_time: 1, duration: 2 }, 0.8],
  ['extend', { video_uri: 'https://input.test/v.mp4', duration: 4, context: 3, mode: 'start' }, 0.7],
  ['video-to-video-reframe', { video_uri: 'https://input.test/v.mp4', resolution: '1080x1080', placement: { anchor: 'center' } }, 1.6],
  ['video-to-video-hdr', { video_uri: 'https://input.test/v.mp4' }, 0.8],
]
for (const [endpoint, body, cost] of endpoints) {
  test(`official operation ${endpoint}: HTTP route, output type and billing unit`, async () => {
    const hdr = endpoint === 'video-to-video-hdr'
    const result = hdr ? status('completed', { result: { exr_frames_url: 'https://output.test/frames.zip' } }) : done()
    const h = harness([accepted(), result])
    const execution = { ...h.execution, inputMedia: hdr ? { ...media, durationSeconds: 4 } : media }
    const job = await h.client.submit(endpoint, body as never, execution)
    assert.equal(job.cost.estimated, cost)
    assert.equal((await h.client.wait(job, execution)).output?.kind, hdr ? 'exr-zip' : 'video')
    assert.equal(h.calls[0].url, `https://api.ltx.io/v2/${endpoint}`)
  })
}

test('unsupported references/seed/callback/model/duration are rejected before any HTTP', async () => {
  const h = harness([])
  for (const extra of [{ seed: 12 }, { webhook_url: 'https://callback.test' }, { references: ['https://input.test'] }, { duration: 5 }, { duration: 12, model: 'ltx-2-3-pro' }, { fps: 48, duration: 12 }, { model: 'ltx-2-5-pro' }]) {
    await assert.rejects(h.client.submit('text-to-video', { ...request, ...extra } as never, h.execution))
  }
  assert.throws(() => validateLtxRequest('video-to-video' as never, {}))
  assert.throws(() => validateLtxRequest('toString' as never, {}))
  assert.equal(h.calls.length, 0)
  assert.equal(LTX_CAPABILITIES.multiReference, false)
})

test('source metadata and priced bounds: retake, extend frame limit, HDR, reframe', () => {
  const video_uri = 'https://input.test/v.mp4'
  assert.throws(() => validateLtxRequest('retake', { video_uri, start_time: 0, duration: 2 }), /METADATA/)
  assert.throws(() => validateLtxRequest('retake', { video_uri, start_time: 0, duration: 2 }, { ...media, fps: 0 }), /METADATA/)
  assert.throws(() => validateLtxRequest('retake', { video_uri, start_time: 8, duration: 2 }, media), /RANGE/)
  assert.throws(() => validateLtxRequest('extend', { video_uri, duration: 18, context: 4 }, media), /CONTEXT/)
  assert.throws(() => validateLtxRequest('extend', { video_uri, duration: 2 }, { ...media, width: 3840, height: 2160 }), /PRICE_UNVERIFIED/)
  assert.throws(() => validateLtxRequest('video-to-video-hdr', { video_uri }, media), /TOO_LONG/)
  assert.throws(() => validateLtxRequest('video-to-video-reframe', { video_uri, resolution: '1080x1080' }, { ...media, durationSeconds: 61 }), /TOO_LONG/)
  assert.throws(() => validateLtxRequest('video-to-video-reframe', { video_uri, resolution: '1080x1080', placement: { x: .9, y: .9, width: .5 } }, media), /PLACEMENT/)
  assert.equal(validateLtxRequest('retake', { video_uri, start_time: 0, duration: 2 }, media).cost.basis, 'input_seconds')
  assert.equal(validateLtxRequest('extend', { video_uri, duration: 4 }, media).cost.estimated, 1.2)
})

test('checkpoint adapter: concurrent submission persists one intent and preserves foreign slots', async () => {
  const steps: Record<string, unknown> = { foreign: 'keep' }
  const execution = executionForCheckpoint(durableLtxJob(steps, 'scene', async () => {}))
  const h = harness([accepted()], execution.store)
  await Promise.allSettled([h.client.submit('text-to-video', request, execution), h.client.submit('text-to-video', request, execution)])
  assert.equal(h.calls.length, 1)
  assert.equal(steps.foreign, 'keep')
  assert.equal((await execution.store.load(createHash('sha256').update(execution.operationKey).digest('hex')))?.id, 'job-123')
})
test('checkpoint adapter refuses spend on failed lease persistence', async () => {
  const execution = executionForCheckpoint(durableLtxJob({}, 'scene', async () => { throw new Error('LOST_LEASE') }))
  const h = harness([accepted()], execution.store)
  await assert.rejects(h.client.submit('text-to-video', request, execution))
  assert.equal(h.calls.length, 0)
})
test('checkpoint adapter refuses spend when durable persistence is absent', async () => {
  const steps = {}
  const execution = executionForCheckpoint(durableLtxJob(steps, 'scene'))
  const h = harness([accepted()])
  await assert.rejects(h.client.submit('text-to-video', request, execution))
  assert.equal(h.calls.length, 0)
  assert.deepEqual(steps, {})
})
test('separate journal wrappers for one scene serialize before the paid POST', async () => {
  const steps: Record<string, unknown> = { foreign: 'keep' }
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const checkpoint = async () => { await gate }
  const contexts = Array.from({ length: 16 }, () => executionForCheckpoint(durableLtxJob(steps, 'scene', checkpoint)))
  const h = harness(Array.from({ length: 16 }, accepted))
  const submits = contexts.map(context => h.client.submit('text-to-video', request, context))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 0, 'no spend before persistence acknowledgement')
  release()
  const outcomes = await Promise.allSettled(submits)
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(h.calls.length, 1)
  assert.equal(steps.foreign, 'keep')
  const resumed = executionForCheckpoint(durableLtxJob(steps, 'scene', async () => {}))
  assert.equal((await h.client.submit('text-to-video', request, resumed)).id, 'job-123')
  assert.equal(h.calls.length, 1)
})
test('journal coordination keeps scene scopes and current lease callbacks distinct', async () => {
  const steps: Record<string, unknown> = {}
  let oldSaves = 0, newSaves = 0
  const expired = executionForCheckpoint(durableLtxJob(steps, 'scene', async () => { oldSaves++; throw new Error('LEASE_LOST') }))
  const current = executionForCheckpoint(durableLtxJob(steps, 'scene', async () => { newSaves++ }))
  const other = executionForCheckpoint(durableLtxJob(steps, 'other', async () => {}))
  const h = harness([accepted(), accepted()])
  await assert.rejects(h.client.submit('text-to-video', request, expired))
  assert.equal(h.calls.length, 0)
  await Promise.all([h.client.submit('text-to-video', request, current), h.client.submit('text-to-video', request, other)])
  assert.equal(h.calls.length, 2)
  assert.equal(oldSaves, 1)
  assert.equal(newSaves, 2)
})
test('checkpoint adapter never overwrites a legacy job with a new POST', async () => {
  const execution = executionForCheckpoint(durableLtxJob({ scene: { started: true, id: 'legacy', endpoint: '/text-to-video', fingerprint: 'old' } }, 'scene'))
  const h = harness([accepted()], execution.store)
  await assert.rejects(h.client.submit('text-to-video', request, execution))
  assert.equal(h.calls.length, 0)
})

test('poll requires HTTP 200 even if another 2xx carries a plausible terminal body', async () => {
  const h = harness([accepted(), json({ id: 'job-123', created_at: T, completed_at: T, status: 'completed', result: { video_url: 'https://media.example.test/output.mp4' } }, 201)])
  const job = await h.client.submit('text-to-video', request, h.execution)
  await assert.rejects(h.client.poll(job, h.execution), code('LTX_POLL_HTTP_201'))
  assert.equal(h.calls.length, 2)
})
