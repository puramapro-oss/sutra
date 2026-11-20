/** Real local SQL transactions + simulated providers; never a remote database. */
import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'
import { pipelineSteps, checkpointStage, type PipelineStage } from '../../src/lib/pipeline-state'

if (process.env.PGHOST !== '127.0.0.1' || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('PRIVATE_FIXTURE_REQUIRED')
const options = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
const database = `t03_durable_${process.pid}_${Date.now()}`
let pool: pg.Pool
const query = (sql: string, values: unknown[] = []) => pool.query(sql, values)
const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
function table(sql: string, name: string) {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`)
  assert.ok(start >= 0)
  const end = sql.indexOf('\n);', start)
  assert.ok(end > start)
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
  await query(table(setupSchema, 'activity_logs'))
  await query(table(source('migrations/sutra_auto.sql'), 'sutra_auto_videos'))
  await query(source('migrations/20261006_auto_occurrence_integrity.sql'))
  await query(source('migrations/v10_durable_jobs_quota.sql'))
  await query(source('migrations/v11_pipeline_checkpoints.sql'))
  const finalMigration = source('migrations/20261014_durable_checkpoint_integrity.sql')
  await query(finalMigration); await query(finalMigration)
  await query(source('migrations/20261015_final_durable_integrity.sql')) // Exact integrated migration, replay-safe.
})
after(async () => { await pool?.end() })
const cp = (id: string, worker: string, progress: object) => query('SELECT checkpoint_video_job_v2($1,$2,$3,NULL)', [id, worker, progress])
const snapshot = async (id: string) => (await query('SELECT * FROM video_jobs WHERE id=$1', [id])).rows[0]
async function job(kind = 'create', input: Record<string, unknown> = {}) {
  const user = randomUUID(), video = randomUUID(), key = randomUUID()
  await query('INSERT INTO auth.users VALUES($1)', [user]); await query('INSERT INTO profiles VALUES($1)', [user])
  const payload = { input: { userId: user, videoId: video, videoRowId: video, step: 'all', musicStyle: 'cinematic', ...input } }
  const row = (await query('SELECT * FROM submit_video_job($1,$2,$3,$4,$5,$6,2,$7)',
    [user, kind, ['create', 'export'].includes(kind) ? video : null, payload, key, 'a'.repeat(64), ['create', 'auto'].includes(kind) ? {} : null])).rows[0]
  await query("SELECT * FROM claim_video_job_by_key($1,'w',600)", [key])
  return { id: row.id as string, user, video, key }
}
const counter = async (user: string) => (await query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1', [user])).rows[0]

test('SQL done rejects legacy null result and retains reservation; only explicit music skip succeeds', async () => {
  for (const kind of ['create', 'auto', 'production']) {
    const j = await job(kind)
    await cp(j.id, 'w', { result: null })
    await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
    assert.equal((await snapshot(j.id)).status, 'processing')
    assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
  }
  const skipped = await job('production', { step: 'music', musicStyle: 'none' })
  await cp(skipped.id, 'w', { result: null, steps: { 'stage:music': { status: 'skipped', value: null } } })
  await query("SELECT finish_video_job($1,'w','done')", [skipped.id])
  assert.deepEqual(await counter(skipped.user), { reserved: 0, completed: 1, released: 0 })
})

test('duplicate final result is idempotent; conflicting result cannot replace the completed output', async () => {
  const j = await job(); const result = { url: 'https://fixture.invalid/first.mp4' }
  await Promise.all(Array.from({ length: 12 }, () => cp(j.id, 'w', { result })))
  await assert.rejects(cp(j.id, 'w', { result: { url: 'https://fixture.invalid/second.mp4' } }), /CHECKPOINT_CONFLICT/)
  assert.deepEqual((await snapshot(j.id)).progress.result, result)
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})

test('conflicting concurrent results elect one durable winner without overwriting it', async () => {
  const j = await job()
  const deliveries = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => cp(j.id, 'w', { result: { index } })))
  const winner = deliveries.findIndex(item => item.status === 'fulfilled')
  assert.equal(deliveries.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal(deliveries.filter(item => item.status === 'rejected' && /CHECKPOINT_CONFLICT/.test(String(item.reason))).length, 11)
  assert.deepEqual((await snapshot(j.id)).progress.result, { index: winner })
})

test('completed stages and scenes survive conflicting late delivery, while provider journal can advance', async () => {
  const j = await job()
  const complete = { status: 'complete', value: 'https://fixture.invalid/voice.mp3' }
  await cp(j.id, 'w', { steps: { 'stage:voice': complete }, scenes: { '0': { url: 'clip-one' } } })
  await assert.rejects(cp(j.id, 'w', { steps: { 'stage:voice': { status: 'skipped', value: null } } }), /CHECKPOINT_CONFLICT/)
  await assert.rejects(cp(j.id, 'w', { scenes: { '0': { url: 'clip-two' } } }), /CHECKPOINT_CONFLICT/)
  await cp(j.id, 'w', { steps: { 'stage:voice': complete, 'asset:video:ltx': { id: 'fixture', status: 'processing' } } })
  await cp(j.id, 'w', { steps: { 'asset:video:ltx': { id: 'fixture', status: 'completed' } } })
  assert.deepEqual((await snapshot(j.id)).progress.steps['stage:voice'], complete)
  assert.equal((await snapshot(j.id)).progress.steps['asset:video:ltx'].status, 'completed')
})

test('paid outputs and remote identities are immutable before aggregate stage completion', async () => {
  const j = await job()
  for (const key of ['script', 'scene:0', 'scene:0:visual', 'asset:video', 'asset:voice', 'music',
    'voice_b64:0', 'assembly', 'verified', 'saved', 'music:suno', 'assembly_render_id', 'music:started']) {
    await cp(j.id, 'w', { steps: { [key]: 'original-fixture' } })
    await cp(j.id, 'w', { steps: { [key]: 'original-fixture' } })
    await assert.rejects(cp(j.id, 'w', { steps: { [key]: 'late-conflicting-fixture' } }), /CHECKPOINT_CONFLICT/)
    assert.equal((await snapshot(j.id)).progress.steps[key], 'original-fixture')
  }
  // Export must be able to renew measured validation; a provider journal progresses.
  await cp(j.id, 'w', { steps: { mediaValidation: { checkedAt: 'first' }, 'scene:0:ltx': { status: 'pending' } } })
  await cp(j.id, 'w', { steps: { mediaValidation: { checkedAt: 'later' }, 'scene:0:ltx': { status: 'completed' } } })
})

test('targeted exhausted claim quarantines atomically and retains uncertain work and budget', async () => {
  const j = await job()
  await cp(j.id, 'w', { steps: { 'music:started': true, 'music:suno': { taskId: 'remote-fixture' } } })
  await query("UPDATE video_jobs SET attempts=max_attempts,lease_until=now()-interval '1 second' WHERE id=$1", [j.id])
  const rows = await Promise.all(Array.from({ length: 12 }, (_, i) => query('SELECT * FROM claim_video_job_by_key($1,$2,600)', [j.key, `w${i}`])))
  assert.equal(rows.flatMap(r => r.rows).length, 0)
  const row = await snapshot(j.id)
  assert.equal(row.status, 'reconciliation_required'); assert.equal(row.locked_by, null)
  assert.equal(row.progress.steps['music:suno'].taskId, 'remote-fixture')
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})

test('canonical SQL CHECKs accept orchestrator states; rejected state rolls back business write', async () => {
  const j = await job('auto', { config: { default_voice_enabled: true, default_music_genre: 'cinematic' } })
  for (const status of ['planning', 'generating_script', 'generating_video', 'generating_audio', 'compositing', 'failed']) {
    await query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)", [j.id, j.video, { status }])
  }
  await assert.rejects(query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)",
    [j.id, j.video, { status: 'invented-state' }]), /SUTRA_INVALID_VIDEO_TRANSITION/)
  // The RPC rejects first; retain a direct proof that the SQL CHECK also fences writes.
  await assert.rejects(query("UPDATE sutra_auto_videos SET status='invented-state' WHERE id=$1", [j.video]), /sutra_auto_videos_status_check/)
  assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1', [j.video])).rows[0].status, 'failed')
  await assert.rejects(query("SELECT finish_video_job($1,'w','ready')", [j.id]), /INVALID_JOB_TRANSITION/)
  await assert.rejects(query("UPDATE video_jobs SET status='ready' WHERE id=$1", [j.id]), /video_jobs_status_check/)
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})

test('canonical auto ready and pending_approval require final proof, complete stages and requested tracks', async () => {
  const media = { url: 'https://fixture.invalid/final.mp4', outputVerified: true, duration: 5,
    outputSize: { width: 720, height: 1280 }, verification: { url: 'https://fixture.invalid/final.mp4',
      sha256: 'a'.repeat(64), duration: 5, width: 720, height: 1280, fps: 30, hasAudio: true } }
  const stages = {
    'stage:script': { status: 'complete', value: { narration: 'fixture', music_style: 'cinematic' } },
    'stage:scenes': { status: 'complete', value: [{ url: 'https://fixture.invalid/raw.mp4' }] },
    'stage:images': { status: 'skipped', value: [] },
    'stage:voice': { status: 'complete', value: 'https://fixture.invalid/voice.mp3' },
    'stage:music': { status: 'complete', value: 'https://fixture.invalid/music.mp3' },
    'stage:subtitles': { status: 'skipped', value: null },
    'stage:composition': { status: 'complete', value: media },
    'stage:export': { status: 'complete', value: media },
  }
  const j = await job('auto', { config: { default_voice_enabled: true, default_music_genre: 'cinematic' } })
  await cp(j.id, 'w', { steps: stages })
  for (const status of ['ready', 'pending_approval']) {
    await query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)",
      [j.id, j.video, { status, video_final_url: media.url }])
    assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1', [j.video])).rows[0].status, status)
  }
  assert.equal((await query('SELECT count(*)::int total FROM sutra_auto_memory WHERE related_video_id=$1', [j.video])).rows[0].total, 1)
  const missing = await job('auto', { config: { default_voice_enabled: true, default_music_genre: 'cinematic' } })
  await cp(missing.id, 'w', { steps: { ...stages, 'stage:music': { status: 'skipped', value: null } } })
  await assert.rejects(query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)",
    [missing.id, missing.video, { status: 'ready', video_final_url: media.url }]), /REQUIRED_TRACK_MISSING/)
  assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1', [missing.video])).rows[0].status, 'planning')
})

test('separate worker process exits after durable remote ID; replacement polls once and replay does nothing', async () => {
  const j = await job()
  const run = (worker: string) => spawnSync(process.execPath, ['--import', 'tsx',
    fileURLToPath(new URL('./restart-worker.mts', import.meta.url)), j.id, worker], {
    env: { ...process.env, PGDATABASE: database }, encoding: 'utf8', timeout: 15_000,
  })
  const interrupted = run('w')
  assert.equal(interrupted.status, 23, interrupted.stderr)
  assert.match(interrupted.stdout, /submitted:1/)
  assert.equal((await snapshot(j.id)).progress.steps.remote.id, 'accepted-before-exit')
  await query("UPDATE video_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [j.id])
  await query("SELECT * FROM claim_video_job_by_key($1,'replacement',600)", [j.key])
  const replacement = run('replacement')
  assert.equal(replacement.status, 0, replacement.stderr)
  assert.match(replacement.stdout, /submitted:0 polled:1/)
  const replay = run('replacement')
  assert.equal(replay.status, 0, replay.stderr)
  assert.match(replay.stdout, /submitted:0 polled:0/)
})

test('worker restart after provider ACK lost reconciles persisted ID once, preserves all independent stages', async () => {
  const j = await job(); let submissions = 0, polls = 0
  const run = async (worker: string) => {
    const done = structuredClone((await snapshot(j.id)).progress.steps ?? {})
    const hooks = { heartbeat: async () => { await query('SELECT heartbeat_video_job_v2($1,$2,600)', [j.id, worker]) },
      onStepResolved: async (key: string, value: unknown) => { await cp(j.id, worker, { steps: { [key]: value } }) } }
    const step = pipelineSteps(done, hooks)
    await step('visual', async () => {
      if (!done.remote) {
        submissions++
        await hooks.onStepResolved('remote', { id: 'accepted-fixture' })
        throw new Error('PROVIDER_RESPONSE_LOST_WORKER_STOPPED')
      }
      assert.equal(done.remote.id, 'accepted-fixture'); polls++
      return 'https://fixture.invalid/reconciled.mp4'
    }, true, Boolean(done.remote))
    for (const stage of ['script', 'scenes', 'images', 'voice', 'music', 'subtitles', 'composition', 'export', 'publication'] as PipelineStage[]) {
      await checkpointStage(done, hooks, stage, { fixture: stage })
    }
  }
  await assert.rejects(run('w'), /WORKER_STOPPED/)
  await query("UPDATE video_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [j.id])
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => query('SELECT * FROM claim_video_job_by_key($1,$2,600)', [j.key, `replacement-${i}`])))
  const owners = claims.flatMap(r => r.rows); assert.equal(owners.length, 1)
  await assert.rejects(cp(j.id, 'w', { steps: { late: true } }), /LEASE_LOST/)
  await run(owners[0].locked_by); await run(owners[0].locked_by)
  assert.equal(submissions, 1); assert.equal(polls, 1)
  const stages = (await snapshot(j.id)).progress.steps
  assert.deepEqual(Object.keys(stages).filter(k => k.startsWith('stage:')).sort(),
    ['script', 'storyboard', 'scenes', 'images', 'voice', 'music', 'subtitles', 'composition', 'export', 'publication'].map(stage => `stage:${stage}`).sort())
  assert.deepEqual(stages['stage:storyboard'], { status: 'skipped', value: [] })
})

test('provider response without durable ID never resubmits after restart; completed video survives music failure', async () => {
  const j = await job(); let videos = 0, music = 0
  const run = async () => {
    const done = structuredClone((await snapshot(j.id)).progress.steps ?? {})
    const step = pipelineSteps(done, { onStepResolved: async (key, value) => { await cp(j.id, 'w', { steps: { [key]: value } }) } })
    await step('video', async () => { videos++; return 'https://fixture.invalid/video.mp4' }, true)
    await step('music', async () => { music++; throw new Error('MUSIC_RESPONSE_LOST') }, true)
  }
  await assert.rejects(run(), /MUSIC_RESPONSE_LOST/)
  await assert.rejects(run(), /RECONCILIATION_REQUIRED/)
  assert.equal(videos, 1); assert.equal(music, 1)
  await assert.rejects(query("SELECT persist_video_job_video($1,'w','videos',$2,$3,false)", [j.id, j.video, { status: 'ready', video_url: 'https://fixture.invalid/video.mp4' }]), /FINAL_MEDIA_PROOF_REQUIRED/)
  assert.equal((await snapshot(j.id)).progress.steps.video, 'https://fixture.invalid/video.mp4')
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})

test('SQL checkpoint rollback before paid intent prevents any provider call and allows a safe retry', async () => {
  const j = await job(); let calls = 0, fail = true
  const run = async () => {
    const done = structuredClone((await snapshot(j.id)).progress.steps ?? {})
    const step = pipelineSteps(done, { onStepResolved: async (key, value) => {
      if (fail) {
        fail = false
        const connection = await pool.connect()
        try {
          await connection.query('BEGIN')
          await connection.query('SELECT checkpoint_video_job_v2($1,\'w\',$2,NULL)', [j.id, { steps: { [key]: value } }])
          await connection.query('SELECT 1/0')
        } finally { await connection.query('ROLLBACK'); connection.release() }
      } else await cp(j.id, 'w', { steps: { [key]: value } })
    } })
    return step('paid', async () => { calls++; return 'fixture-output' }, true)
  }
  await assert.rejects(run(), /division by zero/); assert.equal(calls, 0)
  assert.equal((await snapshot(j.id)).progress.steps?.['paid:started'], undefined)
  assert.equal(await run(), 'fixture-output'); assert.equal(calls, 1)
})

test('cancellation during remote execution fences late results and releases reservation exactly once', async () => {
  const j = await job()
  await cp(j.id, 'w', { steps: { 'video:started': true, remote: { id: 'remote-fixture' } } })
  const cancelled = await Promise.all(Array.from({ length: 12 }, () => query('SELECT cancel_video_job($1) ok', [j.key])))
  assert.equal(cancelled.filter(r => r.rows[0].ok).length, 1)
  await assert.rejects(cp(j.id, 'w', { result: { url: 'late' } }), /LEASE_LOST/)
  await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /LEASE_LOST/)
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'restart',600)", [j.key])).rows.length, 0)
  assert.equal((await snapshot(j.id)).progress.steps.remote.id, 'remote-fixture')
  assert.deepEqual(await counter(j.user), { reserved: 0, completed: 0, released: 1 })
})
