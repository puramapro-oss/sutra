/** Real local SQL transactions + simulated providers; never a remote database. */
import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'

if (process.env.PGHOST !== '127.0.0.1' || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('PRIVATE_FIXTURE_REQUIRED')
const options = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
const database = `t03_final_${process.pid}_${Date.now()}`
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
  await query(table(source('migrations/sutra_auto.sql'), 'sutra_auto_videos'))
  await query(source('migrations/20261006_auto_occurrence_integrity.sql'))
  await query(source('migrations/v10_durable_jobs_quota.sql'))
  await query(source('migrations/v11_pipeline_checkpoints.sql'))
  const finalMigration = source('migrations/20261014_durable_checkpoint_integrity.sql')
  await query(finalMigration); await query(finalMigration)
  const integrated = source('migrations/20261015_final_durable_integrity.sql')
  await query(integrated); await query(integrated)
})
after(async () => { await pool?.end() })
const cp = (id: string, worker: string, progress: object) => query('SELECT checkpoint_video_job_v2($1,$2,$3,NULL)', [id, worker, progress])
const snapshot = async (id: string) => (await query('SELECT * FROM video_jobs WHERE id=$1', [id])).rows[0]
async function job(kind = 'create', input: Record<string, unknown> = {}) {
  const user = randomUUID(), video = randomUUID(), key = randomUUID()
  await query('INSERT INTO auth.users VALUES($1)', [user]); await query('INSERT INTO profiles VALUES($1)', [user])
  if (kind === 'export') await query("INSERT INTO videos(id,user_id,title,status) VALUES($1,$2,'fixture','draft')", [video, user])
  const payload = { input: { userId: user, videoId: video, videoRowId: video, step: 'all', musicStyle: 'cinematic', ...input } }
  const row = (await query('SELECT * FROM submit_video_job($1,$2,$3,$4,$5,$6,2,$7)',
    [user, kind, ['create', 'export'].includes(kind) ? video : null, payload, key, 'a'.repeat(64), ['create', 'auto'].includes(kind) ? {} : null])).rows[0]
  await query("SELECT * FROM claim_video_job_by_key($1,'w',600)", [key])
  return { id: row.id as string, user, video, key }
}
const counter = async (user: string) => (await query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1', [user])).rows[0]

for (const result of [false, true, '', 0, [], {}, { videoUrl: 'raw.mp4' }]) {
  test(`SQL refuses invalid terminal result ${JSON.stringify(result)} without consuming quota`, async () => {
    const j = await job(); await cp(j.id, 'w', { result })
    await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
    assert.equal((await snapshot(j.id)).status, 'processing')
    assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
  })
}
test('generation RPC cannot enter social states without media or publication journal', async () => {
  for (const status of ['publishing', 'published', 'partially_published']) {
    const j = await job('auto')
    await assert.rejects(query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)",
      [j.id, j.video, { status }]), /INVALID_VIDEO_TRANSITION/)
    assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1', [j.video])).rows[0].status, 'planning')
  }
})
test('retry has durable backoff shared by targeted and batch claims, including concurrent restart', async () => {
  const j = await job(); await cp(j.id, 'w', { steps: { 'scene:0': { url: 'completed' } } })
  await query("SELECT finish_video_job($1,'w','queued','TRANSIENT_SQL_READ')", [j.id])
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'early',600)", [j.key])).rowCount, 0)
  assert.equal((await query("SELECT * FROM claim_video_jobs('early-batch',10,600)")).rows.some(r => r.id === j.id), false)
  await query("UPDATE video_jobs SET updated_at=clock_timestamp()-interval '31 seconds' WHERE id=$1", [j.id])
  const attempts = await Promise.all(Array.from({ length: 12 }, (_, index) => query('SELECT * FROM claim_video_job_by_key($1,$2,600)', [j.key, `restart-${index}`])))
  assert.equal(attempts.flatMap(r => r.rows).length, 1)
  assert.deepEqual((await snapshot(j.id)).progress.steps['scene:0'], { url: 'completed' })
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})
test('uncertain operation is quarantined directly, with reservation and completed video retained', async () => {
  const j = await job()
  await cp(j.id, 'w', { steps: { 'scene:0': { url: 'completed' }, 'music:started': true } })
  assert.equal((await query("SELECT finish_video_job($1,'w','queued','SUTRA_RECONCILIATION_REQUIRED: lost response')", [j.id])).rows[0].finish_video_job, 'reconciliation_required')
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'restart',600)", [j.key])).rowCount, 0)
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})
test('completed prior-month reservation is settled once, current-month budget untouched', async () => {
  const j = await job('production', { step: 'music', musicStyle: 'none' })
  await query("UPDATE video_jobs SET created_at=date_trunc('month',now())-interval '1 day' WHERE id=$1", [j.id])
  await query("UPDATE video_quota_counters SET period_start=(date_trunc('month',now())-interval '1 month')::date WHERE user_id=$1", [j.user])
  await query("INSERT INTO video_quota_counters(user_id,period_start,reserved) VALUES($1,date_trunc('month',now())::date,2)", [j.user])
  await cp(j.id, 'w', { result: null, steps: { 'stage:music': { status: 'skipped', value: null } } })
  const finishes = await Promise.allSettled(Array.from({ length: 12 }, () => query("SELECT finish_video_job($1,'w','done')", [j.id])))
  assert.equal(finishes.filter(r => r.status === 'fulfilled').length, 1)
  const rows = (await query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1 ORDER BY period_start', [j.user])).rows
  assert.deepEqual(rows, [{ reserved: 0, completed: 1, released: 0 }, { reserved: 2, completed: 0, released: 0 }])
})
test('expired lease cannot cancel the new worker result through stale finish or checkpoint', async () => {
  const j = await job()
  await query("UPDATE video_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [j.id])
  await query("SELECT * FROM claim_video_job_by_key($1,'new-worker',600)", [j.key])
  await assert.rejects(cp(j.id, 'w', { result: 'stale' }), /LEASE_LOST/)
  await assert.rejects(query("SELECT finish_video_job($1,'w','failed')", [j.id]), /LEASE_LOST/)
  assert.equal((await snapshot(j.id)).locked_by, 'new-worker')
  await query('SELECT cancel_video_job($1)', [j.key])
  await assert.rejects(cp(j.id, 'new-worker', { steps: { 'scene:0': 'late' } }), /LEASE_LOST/)
  assert.deepEqual(await counter(j.user), { reserved: 0, completed: 0, released: 1 })
})

const finalUrl = 'https://fixture.invalid/final.mp4'
const finalMedia = { url: finalUrl, outputVerified: true, duration: 5, outputSize: { width: 720, height: 1280 },
  verification: { url: finalUrl, sha256: 'a'.repeat(64), duration: 5, width: 720, height: 1280, fps: 30, hasAudio: true } }
const complete = <T,>(value: T) => ({ status: 'complete', value })
function finalProgress(kind = 'create', step = 'all') {
  return { result: kind === 'create' ? { videoUrl: finalUrl }
    : kind === 'auto' ? { videoFinalUrl: finalUrl, status: 'ready', assemblyError: null }
    : kind === 'production' && step === 'all' ? { assembly: finalMedia } : { url: finalUrl },
  steps: { 'stage:script': complete({ narration: 'fixture', music_style: 'cinematic' }),
    'stage:storyboard': complete([{ visual_prompt: 'fixture' }]), 'stage:scenes': complete([{ url: 'https://fixture.invalid/raw.mp4' }]),
    'stage:images': { status: 'skipped', value: [] }, 'stage:voice': complete('https://fixture.invalid/voice.mp3'),
    'stage:music': complete('https://fixture.invalid/music.mp3'), 'stage:subtitles': complete([]),
    'stage:composition': complete(finalMedia), 'stage:export': complete(finalMedia) } }
}
test('valid measured results finish once for every generation kind and production assembly', async () => {
  for (const [kind, step] of [['create', 'all'], ['auto', 'all'], ['export', 'all'], ['production', 'all'], ['production', 'assembly']]) {
    const j = await job(kind, { step })
    await cp(j.id, 'w', finalProgress(kind, step))
    assert.equal((await query("SELECT finish_video_job($1,'w','done')", [j.id])).rows[0].finish_video_job, 'done')
    assert.deepEqual(await counter(j.user), { reserved: 0, completed: 1, released: 0 })
  }
})
test('substep results agree with their complete checkpoint; invalid string sentinels are refused', async () => {
  for (const [step, stage, result, value] of [
    ['script', 'script', { scenes: [{ visual_prompt: 'fixture' }] }, { scenes: [{ visual_prompt: 'fixture' }] }],
    ['video', 'scenes', [{ url: 'https://fixture.invalid/raw.mp4' }], [{ url: 'https://fixture.invalid/raw.mp4' }]],
    ['voice', 'voice', { url: 'https://fixture.invalid/voice.mp3' }, 'https://fixture.invalid/voice.mp3'],
    ['music', 'music', 'https://fixture.invalid/music.mp3', 'https://fixture.invalid/music.mp3'],
  ] as const) {
    const j = await job('production', { step })
    await cp(j.id, 'w', { result, steps: { [`stage:${stage}`]: complete(value) } })
    assert.equal((await query("SELECT finish_video_job($1,'w','done')", [j.id])).rows[0].finish_video_job, 'done')
  }
  for (const [step, stage, result, value] of [
    ['voice', 'voice', { url: 'null' }, 'null'], ['music', 'music', 'null', 'null'],
    ['video', 'scenes', [{ url: 'null' }], [{ url: 'null' }]],
  ]) {
    const j = await job('production', { step })
    await cp(j.id, 'w', { result, steps: { [`stage:${stage}`]: complete(value) } })
    await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
  }
})
test('SQL rejects missing stages, missing required tracks, raw or unmeasured final output', async () => {
  const changes: Array<(progress: ReturnType<typeof finalProgress>) => void> = [
    p => { delete (p.steps as Record<string, unknown>)['stage:composition'] },
    p => { p.steps['stage:export'].value.outputVerified = false },
    p => { p.steps['stage:voice'] = { status: 'skipped', value: '' } },
    p => { p.steps['stage:music'] = { status: 'skipped', value: '' } },
    p => { p.steps['stage:export'].value.verification.hasAudio = false },
    p => { p.steps['stage:scenes'].value = [{ url: finalUrl }] },
    p => { p.steps['stage:scenes'].value = [{ url: 'null' }] },
  ]
  for (const change of changes) {
    const j = await job()
    const progress = structuredClone(finalProgress()); change(progress)
    await cp(j.id, 'w', progress)
    await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
    assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
  }
})
test('quota SQL failure rolls back done, preserves acquired result and permits settlement-only retry', async () => {
  const j = await job(); const progress = finalProgress()
  await cp(j.id, 'w', progress)
  await query('DELETE FROM video_quota_counters WHERE user_id=$1', [j.user])
  await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /QUOTA_RECONCILIATION_REQUIRED/)
  const failed = await snapshot(j.id)
  assert.equal(failed.status, 'processing'); assert.deepEqual(failed.progress.result, progress.result)
  await query("INSERT INTO video_quota_counters(user_id,period_start,reserved) VALUES($1,date_trunc('month',now())::date,1)", [j.user])
  assert.equal((await query("SELECT finish_video_job($1,'w','done')", [j.id])).rows[0].finish_video_job, 'done')
  assert.deepEqual(await counter(j.user), { reserved: 0, completed: 1, released: 0 })
})
test('legacy compositing_failed is refused; generation states remain SQL-compatible and acquired data survives failure', async () => {
  const j = await job('auto')
  const acquired = { 'scene:0': { url: 'https://fixture.invalid/raw.mp4' }, 'music:started': true }
  await cp(j.id, 'w', { steps: acquired })
  await assert.rejects(query("UPDATE sutra_auto_videos SET status='compositing_failed' WHERE id=$1", [j.video]), /check constraint/)
  await assert.rejects(query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)", [j.id, j.video, { status: 'compositing_failed' }]), /INVALID_VIDEO_TRANSITION/)
  for (const status of ['planning', 'generating_script', 'generating_video', 'generating_audio', 'compositing', 'failed']) {
    assert.equal((await query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)", [j.id, j.video, { status }])).rows[0].persist_video_job_video, true)
  }
  assert.deepEqual((await snapshot(j.id)).progress.steps, acquired)
  const progress = finalProgress('auto'); await cp(j.id, 'w', progress)
  for (const status of ['ready', 'pending_approval']) {
    assert.equal((await query("SELECT persist_video_job_video($1,'w','sutra_auto_videos',$2,$3,false)", [j.id, j.video, { status, video_final_url: finalUrl }])).rows[0].persist_video_job_video, true)
  }
})
test('backoff grows on retry and exhausted jobs are quarantined without releasing uncertain budget', async () => {
  const j = await job()
  await query("UPDATE video_jobs SET attempts=2,max_attempts=3 WHERE id=$1", [j.id])
  await query("SELECT finish_video_job($1,'w','queued','transient')", [j.id])
  await query("UPDATE video_jobs SET updated_at=clock_timestamp()-interval '31 seconds' WHERE id=$1", [j.id])
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'early',600)", [j.key])).rowCount, 0)
  await query("UPDATE video_jobs SET updated_at=clock_timestamp()-interval '61 seconds' WHERE id=$1", [j.id])
  assert.equal((await query("SELECT * FROM claim_video_job_by_key($1,'last-worker',600)", [j.key])).rowCount, 1)
  assert.equal((await query("SELECT finish_video_job($1,'last-worker','queued','transient')", [j.id])).rows[0].finish_video_job, 'reconciliation_required')
  assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
})

test('ready rejects malformed scene receipts and missing audio for an acquired optional track', async () => {
  for (const malformed of ['null', '', 'optional-audio']) {
    const j = await job('export', { requiredTracks: { voice: false, music: false } })
    const progress = structuredClone(finalProgress('export'))
    if (malformed === 'optional-audio') progress.steps['stage:export'].value.verification.hasAudio = false
    else progress.steps['stage:scenes'].value = [{ url: malformed }]
    await cp(j.id, 'w', progress)
    await assert.rejects(query("SELECT persist_video_job_video($1,'w','videos',$2,$3,false)",
      [j.id, j.video, { status: 'ready', video_url: finalUrl }]), /STAGE_CHECKPOINT_REQUIRED|REQUIRED_TRACK_MISSING/)
    assert.equal((await query('SELECT status FROM videos WHERE id=$1', [j.video])).rows[0].status, 'draft')
  }
})

// The canonical media validator rejects fractional dimensions; SQL must agree.
test('SQL finalization and ready reject fractional measured dimensions', async () => {
  for (const dimension of ['width', 'height'] as const) {
    const j = await job('export', { requiredTracks: { voice: false, music: false } })
    const progress = structuredClone(finalProgress('export'))
    progress.steps['stage:export'].value.verification[dimension] += 0.5
    progress.steps['stage:export'].value.outputSize[dimension] += 0.5
    await cp(j.id, 'w', progress)
    await assert.rejects(query("SELECT persist_video_job_video($1,'w','videos',$2,$3,false)",
      [j.id, j.video, { status: 'ready', video_url: finalUrl }]), /FINAL_MEDIA_PROOF_REQUIRED|invalid input syntax for type integer/)
    await assert.rejects(query("SELECT finish_video_job($1,'w','done')", [j.id]), /RESULT_CHECKPOINT_REQUIRED/)
    assert.deepEqual(await counter(j.user), { reserved: 1, completed: 0, released: 0 })
  }
})
