/** Post-integration delta: actual canonical SQL, private PG, no provider I/O. */
import assert from 'node:assert/strict'
import { test, before, after, afterEach } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'
import { checkpointStage, pipelineSteps, type PipelineStage } from '../../src/lib/pipeline-state'

if (process.env.PGHOST !== '127.0.0.1' || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('PRIVATE_FIXTURE_REQUIRED')
const options = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
assert.ok(Number.isInteger(options.port) && options.port > 0)
const database = `t03_closure_${process.pid}_${Date.now()}`
let pool: pg.Pool
let syntheticCancellations = 0
const query = (sql: string, args: unknown[] = []) => pool.query(sql, args)
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const canonical = 'migrations/20261015_final_durable_integrity.sql'
function table(sql: string, name: string) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`)
  const end = sql.indexOf('\n);', start)
  assert.ok(start >= 0 && end > start)
  return sql.slice(start, end + 3)
}
before(async () => {
  const admin = new pg.Client({ ...options, database: 'postgres' })
  await admin.connect(); await admin.query(`CREATE DATABASE ${database}`); await admin.end()
  pool = new pg.Pool({ ...options, database, max: 12, options: '-c search_path=sutra,public' })
  await query(`CREATE SCHEMA sutra; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE sutra.profiles(id uuid PRIMARY KEY);
    CREATE TABLE sutra.sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra.sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);`)
  await query(table(setupSchema, 'videos'))
  await query(table(source('migrations/sutra_auto.sql'), 'sutra_auto_videos'))
  for (const path of ['migrations/20261006_auto_occurrence_integrity.sql', 'migrations/v10_durable_jobs_quota.sql',
    'migrations/v11_pipeline_checkpoints.sql', canonical]) await query(source(path))
  // Deliberately omit the 14 October migration: T01's cumulative port must suffice.
  await query(`CREATE TABLE fixture_faults(job_id uuid PRIMARY KEY, step text NOT NULL);
    CREATE FUNCTION fixture_fail_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM fixture_faults WHERE job_id=NEW.id AND NEW.progress->'steps' ? step)
      THEN RAISE EXCEPTION 'FIXTURE_SQL_CHECKPOINT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER fixture_checkpoint_error BEFORE UPDATE OF progress ON video_jobs
      FOR EACH ROW EXECUTE FUNCTION fixture_fail_checkpoint();`)
})
afterEach(async () => {
  // Explicit fixture teardown, never an automatic policy for real uncertain work.
  await query('DELETE FROM fixture_faults')
  const pending = (await query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows
  for (const { idempotency_key } of pending) {
    assert.equal((await query('SELECT cancel_video_job($1) AS ok', [idempotency_key])).rows[0].ok, true)
    syntheticCancellations++
  }
  assert.equal((await query('SELECT coalesce(sum(reserved),0)::int AS n FROM video_quota_counters')).rows[0].n, 0)
})
after(async () => {
  try {
    const budget = (await query(`SELECT coalesce(sum(reserved),0)::int AS reserved,
      coalesce(sum(completed),0)::int AS consumed,coalesce(sum(released),0)::int AS released FROM video_quota_counters`)).rows[0]
    assert.equal(budget.reserved, 0)
    assert.equal((await query("SELECT count(*)::int AS n FROM video_jobs WHERE status NOT IN ('done','failed','cancelled')")).rows[0].n, 0)
    assert.equal(budget.consumed + budget.released, (await query('SELECT count(*)::int AS n FROM video_jobs')).rows[0].n)
    process.stdout.write(`T03_FIXTURE_SETTLEMENT ${JSON.stringify({ ...budget, syntheticCancellations })}\n`)
  } finally { await pool?.end() }
})
const snapshot = async (id: string) => (await query('SELECT * FROM video_jobs WHERE id=$1', [id])).rows[0]
const counters = async (user: string) => (await query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1 ORDER BY period_start', [user])).rows
const cp = (id: string, worker: string, steps: object, extra: object = {}) => query('SELECT checkpoint_video_job_v2($1,$2,$3,NULL) AS ok', [id, worker, { steps, ...extra }])
async function identity() {
  const user = randomUUID()
  await query('INSERT INTO auth.users VALUES($1)', [user]); await query('INSERT INTO profiles VALUES($1)', [user])
  return user
}
async function submit(user: string, key = randomUUID(), kind = 'production', input: object = {}, limit = 1, hash = 'a'.repeat(64), video = randomUUID()) {
  const payload = { input: { userId: user, videoId: video, videoRowId: video, step: 'music', musicStyle: 'none', ...input } }
  const row = (await query('SELECT * FROM submit_video_job($1,$2,$3,$4,$5,$6,$7,$8)',
    [user, kind, kind === 'create' ? video : null, payload, key, hash, limit, ['create', 'auto'].includes(kind) ? {} : null])).rows[0]
  return { id: row.id as string, user, key, video }
}
async function job(kind = 'production', input: object = {}) {
  const j = await submit(await identity(), randomUUID(), kind, input)
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'first',600)", [j.key])).rowCount, 1)
  return j
}
const functions = () => query(`SELECT proname,pg_get_functiondef(p.oid) AS definition,proacl::text AS acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sutra'
  AND proname IN ('checkpoint_video_job_v2','finish_video_job','claim_video_job_by_key','claim_video_jobs','video_job_result_valid','persist_video_job_video') ORDER BY proname`)

test('cumulative canonical migration upgrades v11 directly and replays without changing live jobs or budgets', async () => {
  const j = await job()
  await cp(j.id, 'first', { 'stage:music': { status: 'skipped', value: null } }, { result: null })
  const beforeRow = await snapshot(j.id), beforeBudget = await counters(j.user), beforeFunctions = (await functions()).rows
  assert.equal(beforeFunctions.length, 6)
  await query(source(canonical)); await query(source(canonical))
  assert.deepEqual((await functions()).rows, beforeFunctions)
  // The historically layered route yields the same final functions and privileges.
  await query(source('migrations/20261014_durable_checkpoint_integrity.sql')); await query(source(canonical))
  assert.deepEqual((await functions()).rows, beforeFunctions)
  assert.deepEqual(await snapshot(j.id), beforeRow); assert.deepEqual(await counters(j.user), beforeBudget)
  await query("SELECT finish_video_job($1,'first','done')", [j.id])
  assert.deepEqual(await counters(j.user), [{ reserved: 0, completed: 1, released: 0 }])
})

test('12 simultaneous deliveries of one logical request create one job and one reservation, conflicting intent is refused', async () => {
  const user = await identity(), key = randomUUID()
  const deliveries = await Promise.all(Array.from({ length: 12 }, () => submit(user, key)))
  assert.equal(new Set(deliveries.map(j => j.id)).size, 1)
  await assert.rejects(submit(user, key, 'production', {}, 1, 'b'.repeat(64)), /IDEMPOTENCY_CONFLICT/)
  assert.deepEqual(await counters(user), [{ reserved: 1, completed: 0, released: 0 }])
  assert.equal((await query('SELECT count(*)::int AS n FROM video_jobs WHERE user_id=$1', [user])).rows[0].n, 1)
})

test('distinct concurrent submissions contend on one budget; initial video SQL failure rolls back its reservation', async () => {
  const user = await identity()
  const deliveries = await Promise.allSettled(Array.from({ length: 12 }, () => submit(user)))
  assert.equal(deliveries.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(deliveries.filter(r => r.status === 'rejected' && /QUOTA_EXHAUSTED/.test(String(r.reason))).length, 11)
  assert.deepEqual(await counters(user), [{ reserved: 1, completed: 0, released: 0 }])
  const other = await identity(), video = randomUUID(), key = randomUUID()
  await query("INSERT INTO videos(id,user_id,title,status) VALUES($1,$2,'preexisting','draft')", [video, other])
  await assert.rejects(submit(other, key, 'create', {}, 1, 'a'.repeat(64), video), /duplicate key/)
  assert.deepEqual(await counters(other), [])
  assert.equal((await query('SELECT count(*)::int AS n FROM video_jobs WHERE idempotency_key=$1', [key])).rows[0].n, 0)
  assert.equal((await query('SELECT status FROM videos WHERE id=$1', [video])).rows[0].status, 'draft')
})

test('SQL write failure at each of ten stage boundaries never advances memory; restart preserves all acknowledged stages', async () => {
  const j = await job()
  const stages: PipelineStage[] = ['script','storyboard','scenes','images','voice','music','subtitles','composition','export','publication']
  for (const stage of stages) {
    const key = `stage:${stage}`, value = stage === 'script' ? { scenes: [] } : stage === 'storyboard' ? [] : { fixture: stage }
    const status = stage === 'storyboard' ? 'skipped' : 'complete'
    const persisted = (await snapshot(j.id)).progress.steps ?? {}
    // Script derives storyboard independently; explicitly exercise that boundary on a separate job below.
    if (key in persisted) continue
    const memory = structuredClone(persisted)
    const hooks = { onStepResolved: async (k: string, v: unknown) => { assert.equal((await cp(j.id, 'first', { [k]: v })).rows[0].ok, true) } }
    await query('INSERT INTO fixture_faults VALUES($1,$2)', [j.id, key])
    await assert.rejects(checkpointStage(memory, hooks, stage, value, status), /FIXTURE_SQL_CHECKPOINT_FAILURE/)
    assert.deepEqual(memory, persisted); assert.deepEqual((await snapshot(j.id)).progress.steps ?? {}, persisted)
    await query('DELETE FROM fixture_faults WHERE job_id=$1', [j.id])
    await checkpointStage(memory, hooks, stage, value, status)
    const restarted = (await snapshot(j.id)).progress.steps
    assert.deepEqual(restarted, memory)
    await checkpointStage(restarted, hooks, stage, value, status)
    assert.deepEqual((await snapshot(j.id)).progress.steps, memory)
  }
  const split = await job()
  const memory: Record<string, unknown> = {}
  const hooks = { onStepResolved: async (k: string, v: unknown) => { await cp(split.id, 'first', { [k]: v }) } }
  await query('INSERT INTO fixture_faults VALUES($1,$2)', [split.id, 'stage:storyboard'])
  await assert.rejects(checkpointStage(memory, hooks, 'script', { scenes: [{ visual_prompt: 'already acquired' }] }), /FIXTURE_SQL_CHECKPOINT_FAILURE/)
  assert.ok(memory['stage:script']); assert.equal(memory['stage:storyboard'], undefined)
  await query('DELETE FROM fixture_faults WHERE job_id=$1', [split.id])
  await checkpointStage((await snapshot(split.id)).progress.steps, hooks, 'script', { scenes: [{ visual_prompt: 'already acquired' }] })
  assert.ok((await snapshot(split.id)).progress.steps['stage:storyboard'])
})

test('intent SQL failure prevents submission; lost result ACK is recovered from SQL after worker restart', async () => {
  const j = await job(), memory: Record<string, unknown> = {}
  let submissions = 0, loseAck = false
  const hooks = { onStepResolved: async (k: string, v: unknown) => {
    await cp(j.id, 'first', { [k]: v })
    if (k === 'music' && loseAck) throw new Error('FIXTURE_ACK_LOST_AFTER_COMMIT')
  } }
  const provider = async () => { submissions++; return 'https://fixture.invalid/music.mp3' }
  await query('INSERT INTO fixture_faults VALUES($1,$2)', [j.id, 'music:started'])
  await assert.rejects(pipelineSteps(memory, hooks)('music', provider, true), /FIXTURE_SQL_CHECKPOINT_FAILURE/)
  assert.equal(submissions, 0); assert.equal(memory['music:started'], undefined)
  await query('DELETE FROM fixture_faults WHERE job_id=$1', [j.id]); loseAck = true
  await assert.rejects(pipelineSteps(memory, hooks)('music', provider, true), /FIXTURE_ACK_LOST_AFTER_COMMIT/)
  assert.equal(memory.music, undefined); assert.equal(submissions, 1)
  const result = await pipelineSteps((await snapshot(j.id)).progress.steps, hooks)('music', provider, true)
  assert.equal(result, 'https://fixture.invalid/music.mp3'); assert.equal(submissions, 1)
})

test('music timeout after acquired video keeps budget and outputs; restart cannot submit again before reconciliation', async () => {
  const j = await job(), memory: Record<string, unknown> = { 'scene:0': { url: 'https://fixture.invalid/acquired.mp4' } }
  await cp(j.id, 'first', memory)
  let submissions = 0, reads = 0
  const hooks = { onStepResolved: async (k: string, v: unknown) => { await cp(j.id, 'first', { [k]: v }) } }
  await assert.rejects(pipelineSteps(memory, hooks)('music', async () => {
    submissions++; await hooks.onStepResolved('music:suno', { taskId: 'existing-remote-id' })
    throw new Error('FIXTURE_PROVIDER_RESPONSE_LOST')
  }, true), /FIXTURE_PROVIDER_RESPONSE_LOST/)
  const restarted = (await snapshot(j.id)).progress.steps
  await assert.rejects(pipelineSteps(restarted, hooks)('music', async () => { submissions++; return 'forbidden' }, true), /RECONCILIATION_REQUIRED/)
  assert.equal(submissions, 1); assert.deepEqual(await counters(j.user), [{ reserved: 1, completed: 0, released: 0 }])
  const music = await pipelineSteps(restarted, hooks)('music', async () => {
    assert.equal(restarted['music:suno'].taskId, 'existing-remote-id'); reads++; return 'https://fixture.invalid/reconciled.mp3'
  }, true, true)
  assert.equal(music, 'https://fixture.invalid/reconciled.mp3'); assert.equal(reads, 1); assert.equal(submissions, 1)
  assert.deepEqual((await snapshot(j.id)).progress.steps['scene:0'], memory['scene:0'])
})

test('missing cancellation ledger is SQL failure, never success; repair plus 12 cancellations settle once', async () => {
  const j = await job()
  await cp(j.id, 'first', { 'scene:0': { url: 'retained-fixture' } })
  await query('DELETE FROM video_quota_counters WHERE user_id=$1', [j.user])
  const before = await snapshot(j.id)
  await assert.rejects(query('SELECT cancel_video_job($1)', [j.key]), /QUOTA_RECONCILIATION_REQUIRED/)
  assert.deepEqual(await snapshot(j.id), before)
  await query('SELECT reserve_video_quota($1,1)', [j.user])
  const deliveries = await Promise.all(Array.from({ length: 12 }, () => query('SELECT cancel_video_job($1) AS ok', [j.key])))
  assert.equal(deliveries.filter(r => r.rows[0].ok).length, 1)
  assert.equal((await snapshot(j.id)).status, 'cancelled')
  assert.deepEqual((await snapshot(j.id)).progress, before.progress)
  assert.deepEqual(await counters(j.user), [{ reserved: 0, completed: 0, released: 1 }])
})

test('prior-month cancellation releases only the original reservation while another current-month job remains reserved', async () => {
  const old = await job()
  await query("UPDATE video_jobs SET created_at=date_trunc('month',now())-interval '1 day' WHERE id=$1", [old.id])
  await query("UPDATE video_quota_counters SET period_start=(date_trunc('month',now())-interval '1 month')::date WHERE user_id=$1", [old.user])
  const current = await submit(old.user)
  assert.equal((await query('SELECT cancel_video_job($1) AS ok', [old.key])).rows[0].ok, true)
  assert.deepEqual(await counters(old.user), [{ reserved: 0, completed: 0, released: 1 }, { reserved: 1, completed: 0, released: 0 }])
  assert.equal((await snapshot(current.id)).status, 'queued')
  assert.equal((await query('SELECT cancel_video_job($1) AS ok', [current.key])).rows[0].ok, true)
})

test('invalidated terminal output cannot become ready or done and cannot erase acquired checkpoints', async () => {
  const j = await job('auto', { config: { default_music_genre: 'none', default_voice_enabled: false } })
  const malformed = { url: 'https://fixture.invalid/raw.mp4', outputVerified: false }
  await cp(j.id, 'first', { 'stage:export': { status: 'complete', value: malformed }, 'scene:0': { url: malformed.url } },
    { result: { videoFinalUrl: malformed.url, status: 'ready', assemblyError: null } })
  const before = await snapshot(j.id)
  await assert.rejects(query("SELECT finish_video_job($1,'first','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
  await assert.rejects(query("SELECT persist_video_job_video($1,'first','sutra_auto_videos',$2,$3,false)",
    [j.id, j.video, { status: 'ready', video_final_url: malformed.url }]), /SUTRA_FINAL_MEDIA_PROOF_REQUIRED/)
  await assert.rejects(cp(j.id, 'first', { 'scene:0': { url: 'replacement' } }), /CHECKPOINT_CONFLICT/)
  assert.deepEqual(await snapshot(j.id), before)
  assert.deepEqual(await counters(j.user), [{ reserved: 1, completed: 0, released: 0 }])
  assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1', [j.video])).rows[0].status, 'planning')
})

test('expired owner cannot acknowledge or overwrite results; restarted owner settles disabled music once', async () => {
  const j = await job()
  await cp(j.id, 'first', { 'stage:music': { status: 'skipped', value: null } }, { result: null })
  await query("UPDATE video_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [j.id])
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => query('SELECT * FROM claim_video_job_by_key($1,$2,600)', [j.key, `restart-${i}`])))
  const owners = claims.flatMap(r => r.rows); assert.equal(owners.length, 1)
  await assert.rejects(cp(j.id, 'first', { 'stage:music': { status: 'complete', value: 'stale' } }), /LEASE_LOST/)
  await assert.rejects(query("SELECT finish_video_job($1,'first','done')", [j.id]), /LEASE_LOST/)
  await query("SELECT finish_video_job($1,$2,'done')", [j.id, owners[0].locked_by])
  assert.deepEqual(await counters(j.user), [{ reserved: 0, completed: 1, released: 0 }])
})
