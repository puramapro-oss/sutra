// Independent T07 acceptance of integrated R107. No scheduler or provider implementation here.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mock } from 'node:test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startWire } from './wire.mjs'
const user = { id: '70700000-0000-4000-8000-000000000020', email: 'automation-test@fixture.invalid' }
const wire = await startWire(user), results = [], observations = []
const sql = wire.sql
const one = async (query, args = []) => (await sql(query, args)).rows[0]
const tick = async () => {
  const response = await wire.tick()
  return { code: response.status, ...await response.json() }
}
const at = value => mock.timers.setTime(new Date(value).getTime())
const post = body => wire.handle(new Request('http://localhost/api/production', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))
const patch = body => wire.handle(new Request('http://localhost/api/auto/config', {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))
const daily = (changes = {}) => ({ id: randomUUID(), name: 'Synthetic schedule', is_active: true,
  frequency: 'daily', days: [], timezone: 'UTC', time: '12:00', ...changes })
const configure = async (start = '2026-11-06T00:00:00.123456Z', schedules = [daily()]) => {
  const previous = await one('SELECT schedules FROM sutra_auto_config WHERE user_id=$1', [user.id])
  assert.equal((await patch({ schedules, expectedSchedules: previous.schedules, is_active: true })).status, 200)
  await sql('UPDATE sutra_auto_config SET auto_publish=false,require_approval_before_publish=true WHERE user_id=$1', [user.id])
  // Privileged test seed after configuration trigger; never a client-supplied backfill.
  await sql('UPDATE sutra_auto_config SET scheduler_cursor=$2 WHERE user_id=$1', [user.id, start])
  return schedules
}
const activeJobs = async () => (await sql("SELECT * FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required') ORDER BY created_at,id")).rows
const quota = () => one('SELECT coalesce(sum(reserved),0)::int AS reserved,coalesce(sum(released),0)::int AS released FROM video_quota_counters')
const cursor = async () => (await one('SELECT to_jsonb(c) AS c FROM sutra_auto_config c WHERE user_id=$1', [user.id])).c.scheduler_cursor
const check = async (name, fn) => {
  try { await fn(); results.push({ name, status: 'PASS' }); process.stdout.write(`PASS ${name}\n`) }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1; process.stdout.write(`FAIL ${name}: ${error.message}\n`) }
  finally {
    for (const key of Object.keys(wire.faults)) wire.faults[key] = false
    wire.releaseWorker()
    for (const job of await activeJobs()) await sql('SELECT cancel_video_job($1)', [job.idempotency_key])
    await sql('UPDATE sutra_auto_config SET is_active=false WHERE is_active')
    assert.equal((await quota()).reserved, 0)
  }
}
mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-06T00:00:00Z') })
try {
  await check('API schedule CAS: double edit has one winner; invalid IANA and cursor writes rejected', async () => {
    const initial = (await one('SELECT schedules FROM sutra_auto_config')).schedules
    const requests = await Promise.all([daily(), daily()].map(schedule => patch({ schedules: [schedule], expectedSchedules: initial })))
    assert.deepEqual(requests.map(r => r.status).sort(), [200, 409])
    const saved = (await one('SELECT schedules FROM sutra_auto_config')).schedules
    assert.equal((await patch({ schedules: [daily({ timezone: 'Invalid/Zone' })], expectedSchedules: saved })).status, 400)
    assert.equal((await patch({ scheduler_cursor: '2000-01-01T00:00:00Z' })).status, 400)
    assert.deepEqual((await one('SELECT schedules FROM sutra_auto_config')).schedules, saved)
  })
  await check('R107: microsecond cursor survives real PostgreSQL restart and 20h interruption, exactly one noon job', async () => {
    await configure()
    at('2026-11-06T00:00:00Z'); assert.equal((await tick()).status, 'ok')
    const sent = wire.evidence.rpc.find(r => r.name === 'schedule_auto_video_jobs')
    assert.equal(sent.params.p_from, '2026-11-06T00:00:00.123456+00:00')
    assert.equal((await activeJobs()).length, 0)
    const saved = await cursor(); await wire.reopen(); assert.equal(await cursor(), saved)
    at('2026-11-06T20:00:00Z'); assert.equal((await tick()).status, 'ok')
    assert.equal((await activeJobs()).length, 1); assert.equal((await quota()).reserved, 1)
    const occurrence = await one('SELECT scheduled_for FROM sutra_auto_videos WHERE id=$1', [(await activeJobs())[0].payload.input.videoRowId])
    assert.equal(occurrence.scheduled_for.toISOString(), '2026-11-06T12:00:00.000Z')
    observations.push({ risk: 'R107', cursorBeforeRestart: saved, cursorAfterCatchup: await cursor(), jobs: 1 })
  })
  await check('12 concurrent ticks and repeated delivery reserve one occurrence; cancellation never resurrects it', async () => {
    await configure(); at('2026-11-06T20:00:00Z')
    const responses = await Promise.all(Array.from({ length: 12 }, tick))
    assert.ok(responses.some(r => r.status === 'ok'))
    const jobs = await activeJobs(); assert.equal(jobs.length, 1); assert.equal((await quota()).reserved, 1)
    await sql('SELECT cancel_video_job($1)', [jobs[0].idempotency_key])
    assert.equal((await tick()).status, 'ok')
    assert.equal((await one('SELECT count(*)::int AS n FROM video_jobs WHERE idempotency_key=$1', [jobs[0].idempotency_key])).n, 1)
    assert.equal((await one('SELECT status FROM video_jobs WHERE id=$1', [jobs[0].id])).status, 'cancelled')
    assert.equal((await quota()).reserved, 0)
  })
  await check('lost committed RPC response then restart reconciles without a second occurrence, charge or inline retry', async () => {
    await configure(); at('2026-11-06T20:00:00Z'); wire.faults.loseSchedule = true
    const before = wire.evidence.rpc.length, first = await tick()
    assert.equal(first.status, 'partial_failure'); assert.ok(!JSON.stringify(first).includes('SYNTHETIC_PRIVATE'))
    assert.equal(wire.evidence.rpc.length, before + 1)
    const [job] = await activeJobs(); assert.ok(job)
    await wire.reopen(); assert.equal((await tick()).status, 'ok')
    assert.deepEqual((await activeJobs()).map(j => j.id), [job.id]); assert.equal((await quota()).reserved, 1)
  })
  await check('network-before-write and quota failure preserve cursor and roll back every occurrence before retry', async () => {
    await configure(undefined, [daily(), daily({ time: '13:00' })]); at('2026-11-06T20:00:00Z')
    const saved = await cursor()
    for (const fault of ['beforeSchedule', 'quota']) {
      wire.faults[fault] = true; assert.equal((await tick()).status, 'partial_failure'); wire.faults[fault] = false
      assert.equal(await cursor(), saved); assert.equal((await activeJobs()).length, 0); assert.equal((await quota()).reserved, 0)
    }
    assert.equal((await tick()).status, 'ok'); assert.equal((await activeJobs()).length, 2); assert.equal((await quota()).reserved, 2)
  })
  await check('multi-day outage reports bounded catchup; every daily occurrence recovered once', async () => {
    await configure('2026-11-01T00:00:00Z'); at('2026-11-06T20:00:00Z')
    const first = await tick(); assert.equal(first.status, 'partial_failure')
    assert.ok(first.processed.some(p => p.status === 'scheduling_catchup_pending'))
    assert.equal(new Date(await cursor()).toISOString(), '2026-11-02T00:00:00.000Z')
    for (let i = 0; i < 5; i++) await tick()
    assert.equal((await tick()).status, 'ok')
    const jobs = await activeJobs(); assert.equal(jobs.length, 6); assert.equal(new Set(jobs.map(j => j.idempotency_key)).size, 6)
    assert.equal((await quota()).reserved, 6)
  })
  for (const [name, start, end, schedules, expected] of [
    ['DST fold', '2026-10-24T23:00:00Z', '2026-10-25T03:00:00Z', [daily({ timezone: 'Europe/Paris', time: '02:30' })], ['2026-10-25T01:30:00.000Z']],
    ['DST spring gap', '2027-03-27T23:00:00Z', '2027-03-28T03:00:00Z', [daily({ timezone: 'Europe/Paris', time: '02:30' })], ['2027-03-28T01:00:00.000Z']],
    ['daily weekly biweekly monthly', '2026-12-06T23:00:00Z', '2026-12-07T10:00:00Z',
      ['daily', 'weekly', 'biweekly', 'monthly'].map(frequency => daily({ frequency, days: ['MO'], timezone: 'Europe/Paris', time: '10:00' })),
      Array(4).fill('2026-12-07T09:00:00.000Z')],
  ]) await check(`integrated SQL calendar: ${name}`, async () => {
    await configure(start, schedules); at(end); assert.equal((await tick()).status, 'ok'); await tick()
    const jobs = await activeJobs(); assert.equal(jobs.length, expected.length)
    const rows = (await sql('SELECT scheduled_for FROM sutra_auto_videos WHERE id=ANY($1::uuid[]) ORDER BY scheduled_for', [jobs.map(j => j.payload.input.videoRowId)])).rows
    assert.deepEqual(rows.map(r => r.scheduled_for.toISOString()), expected)
  })
  await check('expired lease resumes checkpoint; stale worker fenced; cancel preserves provider identity and unique audit/quota', async () => {
    await configure(); at('2026-11-06T20:00:00Z'); await tick()
    const [job] = await activeJobs()
    assert.ok(await wire.queue.claimJobByKey(job.idempotency_key, 'fixture-worker-old', 60))
    await wire.queue.checkpoint(job.id, 'fixture-worker-old', {}, { fixture: 'already-started-remote-operation' })
    await wire.reopen()
    await sql("UPDATE video_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [job.id])
    const resumed = await wire.queue.claimJobByKey(job.idempotency_key, 'fixture-worker-new', 60)
    assert.equal(resumed.provider_job_ids.fixture, 'already-started-remote-operation')
    await assert.rejects(wire.queue.checkpoint(job.id, 'fixture-worker-old', {}, {}))
    const oldReleased = (await quota()).released
    const cancels = await Promise.all(Array.from({ length: 12 }, () => wire.queue.cancelJobByKey(job.idempotency_key)))
    assert.equal(cancels.filter(Boolean).length, 1)
    await assert.rejects(wire.queue.checkpoint(job.id, 'fixture-worker-new', {}, {}))
    const saved = await one('SELECT status,provider_job_ids,progress FROM video_jobs WHERE id=$1', [job.id])
    assert.equal(saved.status, 'cancelled'); assert.equal(saved.provider_job_ids.fixture, 'already-started-remote-operation')
    const audit = (await sql("SELECT * FROM activity_logs WHERE metadata->>'job_id'=$1", [job.id])).rows
    assert.equal(audit.length, 1); assert.equal(audit[0].metadata.provider_submitted, true)
    assert.equal(saved.progress.effects['activity_logs:cancelled'], audit[0].id)
    assert.deepEqual(await quota(), { reserved: 0, released: oldReleased + 1 })
  })
  await check('production API cancellation recovers lost submit and cancel ACK, restart and repeated request', async () => {
    const requestId = randomUUID(), idea = 'Synthetic free cancellation'
    wire.faults.loseSubmit = true
    assert.equal((await post({ step: 'script', idea, template: 'youtube', format: '16:9', requestId })).status, 503)
    const [job] = await activeJobs(); assert.ok(job)
    wire.faults.loseCancel = true
    assert.equal((await post({ step: 'cancel', targetStep: 'script', requestId, idea })).status, 503)
    await wire.reopen()
    const response = await wire.handle(new Request(`http://localhost/api/production?requestId=${requestId}&targetStep=script`))
    assert.equal(response.status, 200); assert.equal((await response.json()).status, 'cancelled')
    assert.equal((await post({ step: 'cancel', targetStep: 'script', requestId, idea })).status, 200)
    assert.equal((await one("SELECT count(*)::int n FROM activity_logs WHERE metadata->>'job_id'=$1", [job.id])).n, 1)
    assert.equal((await quota()).reserved, 0); assert.equal(wire.evidence.workerCalls, 0)
  })
  await check('scheduler RPC permissions deny ordinary client; stale cursor and oversized window fail closed', async () => {
    await configure(); at('2026-11-06T20:00:00Z'); await tick()
    const p = wire.evidence.rpc.filter(r => r.name === 'schedule_auto_video_jobs').at(-1).params
    const args = [p.p_user_id, p.p_from, p.p_through, p.p_updated_at, JSON.stringify(p.p_jobs), p.p_limit]
    await assert.rejects(sql('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6)', args), /SCHEDULE_CONFLICT/)
    await assert.rejects(sql("SELECT schedule_auto_video_jobs($1,now(),now()+interval '25 hours',now(),'[]',1)", [user.id]), /INVALID_SCHEDULING_WINDOW/)
    const permissions = await one("SELECT has_function_privilege('authenticated','sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,integer)','EXECUTE') allowed")
    assert.equal(permissions.allowed, false)
  })
  await check('activation and publication remain disabled; no worker or provider invoked by scheduler tests', async () => {
    assert.equal((await one('SELECT is_active,auto_publish,require_approval_before_publish FROM sutra_auto_config')).is_active, false)
    assert.equal((await one('SELECT auto_publish FROM sutra_auto_config')).auto_publish, false)
    assert.equal(wire.evidence.workerCalls, 0); assert.equal(wire.evidence.providerCalls, 0); assert.equal(wire.evidence.publicationCalls, 0)
    await assert.rejects(fetch('https://provider.fixture.invalid/paid'), /T08_NETWORK_DENIED/)
    assert.equal((await quota()).reserved, 0)
  })
} finally {
  mock.timers.reset()
  await wire.close(process.env.T07_PROOF_DIR)
  writeFileSync(join(process.env.T07_PROOF_DIR, 'results.json'), JSON.stringify({
    candidate: process.env.T07_CANDIDATE_SHA, results, observations,
    scope: 'real local PostgreSQL + canonical API handlers; mocked session/transport; no browser or provider',
  }, null, 2) + '\n')
}
