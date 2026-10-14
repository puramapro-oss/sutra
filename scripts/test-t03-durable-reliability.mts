/** Terminal receipt recovery only: no adapter, provider or real media execution. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { VideoJob } from '../src/lib/video-queue'
import { runVideoJob } from '../src/lib/video-worker'
import { finishJob } from '../src/lib/video-queue'

const USER = '00000000-0000-4000-8000-000000000003'
const VIDEO = '00000000-0000-4000-8000-000000000004'
const JOB = '00000000-0000-4000-8000-000000000005'
const WORKER = 't03-durable-fixture'
function fixture(kind: VideoJob['kind'], step = 'all', musicStyle = 'cinematic'): VideoJob {
  return { id: JOB, user_id: USER, video_id: kind === 'create' || kind === 'export' ? VIDEO : null,
    kind, payload: { input: { userId: USER, videoId: VIDEO, videoRowId: VIDEO, step, musicStyle } },
    progress: { result: null, steps: {} }, provider_job_ids: {}, status: 'processing',
    attempts: 2, max_attempts: 3, locked_by: WORKER, last_error: null, idempotency_key: 't03-fixture' }
}
function db(row: VideoJob, ackLost = false) {
  const calls: string[] = []
  const previous = globalThis.fetch
  globalThis.fetch = async (request, init) => {
    const url = new URL(request instanceof Request ? request.url : request)
    assert.equal(url.origin, 'https://db.fixture.invalid')
    calls.push(url.pathname)
    let body: unknown
    let status = 200
    if (url.pathname === '/rest/v1/rpc/heartbeat_video_job_v2') body = true
    else if (ackLost && url.pathname === '/rest/v1/rpc/finish_video_job') { body = { message: 'ACK_LOST' }; status = 503 }
    else if (ackLost && url.pathname === '/rest/v1/video_jobs' && !init?.body) body = row
    else throw new Error('UNEXPECTED_SIDE_EFFECT')
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { calls, restore: () => { globalThis.fetch = previous } }
}

for (const kind of ['create', 'export', 'auto', 'production'] as const) {
  test(`legacy null final checkpoint in ${kind} is quarantined without replaying paid work`, async t => {
    const row = fixture(kind); const h = db(row); t.after(h.restore)
    await assert.rejects(runVideoJob(row, WORKER), /SUTRA_RECONCILIATION_REQUIRED/)
    assert.deepEqual(h.calls, ['/rest/v1/rpc/heartbeat_video_job_v2'])
    assert.equal(row.progress.result, null)
  })
}
for (const [style, stage] of [
  ['cinematic', { status: 'skipped', value: null }],
  ['none', { status: 'complete', value: null }],
  ['none', { status: 'skipped', value: 'https://wrong.fixture.invalid/music.mp3' }],
  ['none', { status: 'skipped' }],
] as const) {
  test(`null music requires explicit skip, matching empty value: ${JSON.stringify([style, stage])}`, async t => {
    const row = fixture('production', 'music', style)
    row.progress.steps = { 'stage:music': stage }
    const h = db(row); t.after(h.restore)
    await assert.rejects(runVideoJob(row, WORKER), /SUTRA_RECONCILIATION_REQUIRED/)
    assert.equal(h.calls.length, 1)
  })
}
test('explicit music none still resumes its acknowledged skipped result', async t => {
  const row = fixture('production', 'music', 'none')
  row.progress.steps = { 'stage:music': { status: 'skipped', value: null } }
  const h = db(row); t.after(h.restore)
  assert.equal(await runVideoJob(row, WORKER), null)
  assert.equal(h.calls.length, 1)
})
test('new music-none execution persists its skip and null result without invoking a provider', async t => {
  const row = fixture('production', 'music', 'none'); row.progress = { steps: {} as Record<string, unknown> }
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
  let finalWrites = 0
  globalThis.fetch = async (request, init) => {
    const url = new URL(request instanceof Request ? request.url : request)
    assert.equal(url.origin, 'https://db.fixture.invalid')
    const body = JSON.parse(String(init?.body))
    if (url.pathname === '/rest/v1/rpc/checkpoint_video_job_v2') {
      Object.assign(row.progress.steps!, body.p_progress.steps ?? {})
      if (Object.hasOwn(body.p_progress, 'result')) {
        finalWrites++; row.progress.result = body.p_progress.result
      }
    } else assert.ok(['/rest/v1/rpc/heartbeat_video_job_v2', '/rest/v1/rpc/record_video_job_event'].includes(url.pathname))
    return new Response('true', { headers: { 'content-type': 'application/json' } })
  }
  assert.equal(await runVideoJob(row, WORKER), null)
  assert.equal(finalWrites, 1)
  assert.deepEqual((row.progress.steps as Record<string, unknown>)['stage:music'], { status: 'skipped', value: null })
})
for (const value of [undefined, 'https://unexpected.fixture.invalid/music.mp3']) {
  test(`lost finish ACK rejects contradictory skipped-music value ${String(value)}`, async t => {
    const row = fixture('production', 'music', 'none'); row.status = 'done'; row.locked_by = null
    row.progress.steps = { 'stage:music': { status: 'skipped', ...(value === undefined ? {} : { value }) } }
    const h = db(row, true); t.after(h.restore)
    await assert.rejects(finishJob(JOB, WORKER, 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
    assert.deepEqual(h.calls, ['/rest/v1/rpc/finish_video_job', '/rest/v1/video_jobs'])
  })
}
