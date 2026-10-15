/** New boundary proof: real production HTTP handlers, queue and canonical SQL.
 * Only Supabase transport/session and the provider worker are simulated. */
import assert from 'node:assert/strict'
import { test, mock, before, after, beforeEach, afterEach } from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'
import type { VideoJob } from '../../src/lib/video-queue'

assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
const config = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
assert.ok(Number.isInteger(config.port) && config.port > 0)
const database = `t03_final_${process.pid}_${Date.now()}`
let pool: pg.Pool, user: string, workerCalls = 0, acquisitions = 0, rpcCalls = 0, teardownCancellations = 0
let readFailure = false
let ackFault: { rpc: string; mode: 'lost' | 'malformed' } | null = null
const privateMarker = 'T03_SYNTHETIC_PRIVATE_DIAGNOSTIC'
const query = (sql: string, args: unknown[] = []) => pool.query(sql, args)
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
function table(sql: string, name: string) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`), end = sql.indexOf('\n);', start)
  assert.ok(start >= 0 && end > start)
  return sql.slice(start, end + 3)
}
function latch() {
  let open!: () => void
  const promise = new Promise<void>(resolve => { open = resolve })
  return { promise, open }
}
let workerGate: { entered: ReturnType<typeof latch>; release: ReturnType<typeof latch> } | null = null
const rpcDefinitions: Record<string, { args: string[]; set?: boolean }> = {
  submit_video_job: { args: ['p_user_id','p_kind','p_video_id','p_payload','p_key','p_request_hash','p_limit','p_initial'], set: true },
  claim_video_job_by_key: { args: ['p_key','p_worker','p_lease_seconds'], set: true },
  checkpoint_video_job_v2: { args: ['p_job_id','p_worker','p_progress','p_provider_job_ids'] },
  finish_video_job: { args: ['p_job_id','p_worker','p_status','p_error'] },
  cancel_video_job: { args: ['p_key'] },
}
const transport = {
  rpc: async (name: string, params: Record<string, unknown>) => {
    const spec = rpcDefinitions[name]
    assert.ok(spec, `Unexpected RPC ${name}`); rpcCalls++
    try {
      const placeholders = spec.args.map((_, i) => `$${i + 1}`).join(',')
      const result = await query(spec.set ? `SELECT * FROM ${name}(${placeholders})` : `SELECT ${name}(${placeholders}) AS result`, spec.args.map(arg => params[arg]))
      if (ackFault?.rpc === name) {
        const mode = ackFault.mode; ackFault = null
        if (mode === 'lost') throw new Error(privateMarker)
        return { data: null, error: null }
      }
      return { data: spec.set ? result.rows : result.rows[0].result, error: null }
    } catch (error) { return { data: null, error } }
  },
  from: (name: string) => {
    assert.ok(['profiles', 'video_jobs'].includes(name))
    const filters: Array<[string, unknown]> = []
    const execute = async () => {
      try {
        if (readFailure && name === 'video_jobs') await query('SELECT * FROM fixture_private_unavailable')
        const rows = (await query(`SELECT * FROM ${name} WHERE ${filters.map(([key], i) => `${key}=$${i + 1}`).join(' AND ')}`, filters.map(([, value]) => value))).rows
        assert.ok(rows.length <= 1)
        const row = rows[0] ?? null
        return { data: name === 'profiles' && row ? { ...row, email: 'fixture@example.invalid', plan: 'free', preferred_quality: '1080p' } : row, error: null }
      } catch (error) { return { data: null, error } }
    }
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { assert.ok(['id','user_id','kind','idempotency_key'].includes(key)); filters.push([key, value]); return builder },
      single: execute, maybeSingle: execute,
    }
    return builder
  },
}
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => transport } })
mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: {
  getUser: async () => ({ data: { user: { id: user, email: 'fixture@example.invalid' } }, error: null }),
} }) } })
mock.module('../../src/lib/video-worker.ts', { namedExports: { runVideoJob: async (job: VideoJob, worker: string) => {
  workerCalls++
  // Simulated no-music worker. The checkpoint and finish are the real SQL paths.
  if (!Object.hasOwn(job.progress, 'result')) {
    acquisitions++
    await queue.checkpoint(job.id, worker, { steps: { 'stage:music': { status: 'skipped', value: null } }, result: null })
  }
  const gate = workerGate
  if (gate) { gate.entered.open(); await gate.release.promise }
  return null
} } })
const queue = await import('../../src/lib/video-queue.ts')
const route = await import('../../src/app/api/production/route.ts')
const body = () => ({ step: 'music', musicStyle: 'none', idea: 'offline fixture', requestId: randomUUID() })
const key = (requestId: string) => `production-${user}-music-${requestId}`
const post = (data: object) => route.POST(new Request('https://sutra.example.test/api/production', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }))
const cancel = (requestId: string) => post({ step: 'cancel', targetStep: 'music', requestId, idea: 'offline cancellation' })
const get = (requestId: string) => route.GET(new Request(`https://sutra.example.test/api/production?targetStep=music&requestId=${requestId}`))
const jobFor = async (requestId: string) => (await query('SELECT * FROM video_jobs WHERE idempotency_key=$1', [key(requestId)])).rows[0]
const budget = async () => (await query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1', [user])).rows
const reserveWithoutWorker = async (request: ReturnType<typeof body>) => {
  ackFault = { rpc: 'submit_video_job', mode: 'lost' }
  assert.equal((await post(request)).status, 503)
  assert.equal(workerCalls, 0)
  return jobFor(request.requestId)
}

before(async () => {
  const admin = new pg.Client({ ...config, database: 'postgres' })
  await admin.connect(); await admin.query(`CREATE DATABASE ${database}`); await admin.end()
  pool = new pg.Pool({ ...config, database, max: 12, options: '-c search_path=sutra,public' })
  await query(`CREATE SCHEMA sutra; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);`)
  await query(table(setupSchema, 'videos')); await query(table(setupSchema, 'activity_logs'))
  await query(table(source('migrations/sutra_auto.sql'), 'sutra_auto_videos'))
  for (const path of ['migrations/20261006_auto_occurrence_integrity.sql','migrations/v10_durable_jobs_quota.sql',
    'migrations/v11_pipeline_checkpoints.sql','migrations/20261015_final_durable_integrity.sql']) await query(source(path))
  await query(`CREATE TABLE fixture_faults(job_id uuid PRIMARY KEY, target_status text);
    CREATE FUNCTION fixture_fail_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM fixture_faults WHERE job_id=NEW.id AND target_status=NEW.status)
      THEN RAISE EXCEPTION 'T03_SYNTHETIC_PRIVATE_DIAGNOSTIC'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_status_error BEFORE UPDATE OF status ON video_jobs FOR EACH ROW EXECUTE FUNCTION fixture_fail_status();`)
})
beforeEach(async () => {
  user = randomUUID(); await query('INSERT INTO auth.users VALUES($1)', [user]); await query('INSERT INTO profiles VALUES($1)', [user])
  workerCalls = acquisitions = rpcCalls = 0; ackFault = null; readFailure = false; workerGate = null
})
afterEach(async () => {
  workerGate?.release.open(); ackFault = null; readFailure = false
  await query('DELETE FROM fixture_faults')
  for (const row of (await query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows) {
    assert.equal((await query('SELECT cancel_video_job($1) AS ok', [row.idempotency_key])).rows[0].ok, true)
    teardownCancellations++
  }
  assert.equal((await query('SELECT coalesce(sum(reserved),0)::int AS reserved FROM video_quota_counters')).rows[0].reserved, 0)
})
after(async () => {
  try {
    const totals = (await query(`SELECT coalesce(sum(reserved),0)::int AS reserved,coalesce(sum(completed),0)::int AS consumed,
      coalesce(sum(released),0)::int AS released FROM video_quota_counters`)).rows[0]
    assert.equal(totals.reserved, 0)
    assert.equal(totals.consumed + totals.released, (await query('SELECT count(*)::int AS n FROM video_jobs')).rows[0].n)
    assert.equal((await query("SELECT count(*)::int AS n FROM video_jobs WHERE status NOT IN ('done','failed','cancelled')")).rows[0].n, 0)
    process.stdout.write(`T03_FINAL_SETTLEMENT ${JSON.stringify({ ...totals, teardownCancellations, providerCalls: 0 })}\n`)
  } finally { await pool?.end() }
})

test('lost submission ACK is reconciled by GET, then cancelled without a second logical job', async () => {
  const request = body(), job = await reserveWithoutWorker(request)
  assert.deepEqual(await budget(), [{ reserved: 1, completed: 0, released: 0 }])
  const calls = rpcCalls, receipt = await get(request.requestId)
  assert.deepEqual(await receipt.json(), { jobId: job.id, status: 'queued' }); assert.equal(rpcCalls, calls)
  assert.match(receipt.headers.get('cache-control') ?? '', /no-store/)
  assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: true } })
  assert.equal((await post(request)).status, 409); assert.equal(workerCalls, 0)
  assert.equal((await query('SELECT count(*)::int AS n FROM video_jobs WHERE user_id=$1', [user])).rows[0].n, 1)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }])
})

test('a still-uncommitted submission remains absent; false cancel is not evidence of cancellation', async () => {
  const request = body(), tx = await pool.connect()
  try {
    await tx.query('BEGIN')
    await tx.query('SELECT * FROM submit_video_job($1,$2,NULL,$3,$4,$5,1,NULL)', [user, 'production', { input: { userId: user, step: 'music', musicStyle: 'none' } }, key(request.requestId), 'a'.repeat(64)])
    assert.equal((await get(request.requestId)).status, 404)
    assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: false } })
    await tx.query('COMMIT')
    assert.equal((await (await get(request.requestId)).json()).status, 'queued')
    assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: true } })
    assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }]); assert.equal(workerCalls, 0)
  } finally { await tx.query('ROLLBACK'); tx.release() }
})

for (const mode of ['lost', 'malformed'] as const) test(`${mode} cancel ACK after commit stays 503 until the durable receipt is read`, async () => {
  const request = body(); await reserveWithoutWorker(request)
  ackFault = { rpc: 'cancel_video_job', mode }
  const response = await cancel(request.requestId)
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /T03_SYNTHETIC|fixture_private/)
  const before = rpcCalls
  assert.equal((await (await get(request.requestId)).json()).status, 'cancelled'); assert.equal(rpcCalls, before)
  assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: false } })
  assert.equal((await post(request)).status, 409); assert.equal(workerCalls, 0)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }])
})

test('SQL cancellation failure rolls back quota release and job state; the same intent can cancel later', async () => {
  const request = body(), job = await reserveWithoutWorker(request)
  await query('INSERT INTO fixture_faults VALUES($1,$2)', [job.id, 'cancelled'])
  const response = await cancel(request.requestId)
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /T03_SYNTHETIC/)
  assert.equal((await jobFor(request.requestId)).status, 'queued')
  assert.deepEqual(await budget(), [{ reserved: 1, completed: 0, released: 0 }])
  await query('DELETE FROM fixture_faults')
  assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: true } })
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }])
})

test('an SQL read error is 503 without a mutation; user binding prevents observing another owner', async () => {
  const request = body(), job = await reserveWithoutWorker(request), owner = user, calls = rpcCalls
  readFailure = true
  const response = await get(request.requestId)
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Statut indisponible' })
  readFailure = false; user = randomUUID()
  assert.equal((await get(request.requestId)).status, 404)
  user = owner
  assert.deepEqual(await (await get(request.requestId)).json(), { jobId: job.id, status: 'queued' })
  assert.equal(rpcCalls, calls); assert.equal(workerCalls, 0)
})

test('cancellation wins between a persisted checkpoint and finish: no success, no reacquisition', async () => {
  const request = body(), gate = { entered: latch(), release: latch() }; workerGate = gate
  const running = post(request)
  try {
    await gate.entered.promise
    assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: true } })
  } finally { gate.release.open() }
  const result = await running
  assert.equal(result.status, 503); assert.equal((await result.json()).status, 'write_unconfirmed')
  assert.equal((await (await get(request.requestId)).json()).status, 'cancelled')
  assert.deepEqual((await jobFor(request.requestId)).progress.steps['stage:music'], { status: 'skipped', value: null })
  assert.equal((await post(request)).status, 409); assert.equal(workerCalls, 1); assert.equal(acquisitions, 1)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }])
})

test('finish wins before cancellation; disabled music null is a valid reusable terminal receipt', async () => {
  const request = body(), response = await post(request)
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { data: null, quotaReconciliationRequired: false })
  assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: false } })
  assert.equal((await (await get(request.requestId)).json()).data, null)
  assert.deepEqual(await (await post(request)).json(), { data: null }); assert.equal(workerCalls, 1)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 1, released: 0 }])
})

test('12 concurrent HTTP deliveries share one worker, checkpoint and reservation', async () => {
  const request = body(), gate = { entered: latch(), release: latch() }; workerGate = gate
  const first = post(request)
  try {
    await gate.entered.promise
    const others = await Promise.all(Array.from({ length: 11 }, () => post(request)))
    assert.ok(others.every(response => response.status === 202)); assert.equal(workerCalls, 1)
    assert.deepEqual(await budget(), [{ reserved: 1, completed: 0, released: 0 }])
  } finally { gate.release.open() }
  assert.equal((await first).status, 200); assert.equal(acquisitions, 1)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 1, released: 0 }])
})

test('12 cancellations after lease expiry release once and fence the obsolete worker checkpoint', async () => {
  const request = body(), job = await reserveWithoutWorker(request)
  assert.ok(await queue.claimJobByKey(key(request.requestId), 'obsolete', 600))
  await query("UPDATE video_jobs SET lease_until=now()-interval '1 minute' WHERE id=$1", [job.id])
  const results = await Promise.all(Array.from({ length: 12 }, async () => {
    const response = await cancel(request.requestId); assert.equal(response.status, 200)
    return (await response.json()).data.cancelled
  }))
  assert.equal(results.filter(Boolean).length, 1)
  await assert.rejects(queue.checkpoint(job.id, 'obsolete', { result: null }), /SUTRA_CHECKPOINT_FAILED/)
  assert.equal((await (await get(request.requestId)).json()).status, 'cancelled')
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 0, released: 1 }])
})

test('an uncertain remote intention stays quarantined on HTTP redelivery and keeps acquired output', async () => {
  const request = body(), job = await reserveWithoutWorker(request)
  await queue.claimJobByKey(key(request.requestId), 'interrupted', 600)
  const steps = { 'scene:0': { url: 'https://fixture.invalid/acquired.mp4' }, 'music:started': { started: true } }
  await queue.checkpoint(job.id, 'interrupted', { steps }, { music: 'synthetic-remote-id' })
  await queue.finishJob(job.id, 'interrupted', 'reconciliation_required', 'FIXTURE_REMOTE_OUTCOME_UNKNOWN')
  const calls = rpcCalls
  assert.deepEqual(await (await get(request.requestId)).json(), { jobId: job.id, status: 'reconciliation_required' })
  assert.equal(rpcCalls, calls); assert.equal((await post(request)).status, 409); assert.equal(workerCalls, 0)
  assert.deepEqual(await budget(), [{ reserved: 1, completed: 0, released: 0 }])
  assert.deepEqual((await jobFor(request.requestId)).progress.steps, steps)
  assert.deepEqual(await (await cancel(request.requestId)).json(), { data: { cancelled: true } })
  assert.deepEqual((await jobFor(request.requestId)).provider_job_ids, { music: 'synthetic-remote-id' })
})

test('lost finish ACK is recovered from a valid SQL receipt without a second quota mutation', async () => {
  const request = body(); ackFault = { rpc: 'finish_video_job', mode: 'lost' }
  const response = await post(request)
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { data: null, quotaReconciliationRequired: false })
  assert.equal((await post(request)).status, 200); assert.equal(workerCalls, 1)
  assert.deepEqual(await budget(), [{ reserved: 0, completed: 1, released: 0 }])
})

test('SQL failure during finish never returns success or consumes quota despite the acquired checkpoint', async () => {
  const request = body(), gate = { entered: latch(), release: latch() }; workerGate = gate
  const running = post(request)
  try {
    await gate.entered.promise
    await query('INSERT INTO fixture_faults VALUES($1,$2)', [(await jobFor(request.requestId)).id, 'done'])
  } finally { gate.release.open() }
  const response = await running
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /T03_SYNTHETIC/)
  assert.equal((await jobFor(request.requestId)).status, 'queued')
  assert.deepEqual(await budget(), [{ reserved: 1, completed: 0, released: 0 }])
  const receipt = await (await get(request.requestId)).json()
  assert.equal(receipt.status, 'queued'); assert.equal(Object.hasOwn(receipt, 'data'), false)
  assert.deepEqual((await jobFor(request.requestId)).progress.steps['stage:music'], { status: 'skipped', value: null })
  assert.equal((await post(request)).status, 202); assert.equal(workerCalls, 1)
})
