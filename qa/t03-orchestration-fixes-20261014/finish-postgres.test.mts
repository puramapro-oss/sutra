/** New delta only: actual finishJob + PostgreSQL transactions behind a lost HTTP ACK. */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'
const host = process.env.PGHOST
const port = Number(process.env.PGPORT)
if (host !== '127.0.0.1' || !Number.isInteger(port) || port < 1 || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('Disposable loopback DB required')
const database = `sutra_t03_finish_${process.pid}_${Date.now()}`
const connection = { host, port, user: 'fixture', database }
let pool: pg.Pool
const query = (sql: string, args?: unknown[]) => pool.query(sql, args)
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://db.fixture.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' })
const { finishJob } = await import('../../src/lib/video-queue')
const originalFetch = globalThis.fetch
const transport = { mutations: 0, reads: 0, committed: 0, forbidden: 0 }
before(async () => {
  const admin = new pg.Client({ ...connection, database: 'postgres' }); await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`); await admin.end()
  pool = new pg.Pool({ ...connection, max: 12, options: '-c search_path=sutra,public' })
  await query(`CREATE SCHEMA sutra; CREATE TABLE sutra.videos(id uuid PRIMARY KEY,user_id uuid,status text,created_at timestamptz DEFAULT now());`)
  const auditTable = setupSchema.match(/CREATE TABLE IF NOT EXISTS sutra\.activity_logs \([\s\S]*?\n\);/)?.[0]
  assert.ok(auditTable, 'canonical activity log table is required')
  await query(auditTable)
  for (const name of ['v10_durable_jobs_quota.sql', 'v11_pipeline_checkpoints.sql', '20261014_durable_checkpoint_integrity.sql', '20261015_final_durable_integrity.sql']) {
    await query(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'))
  }
  globalThis.fetch = async (request, options) => {
    const url = new URL(request instanceof Request ? request.url : request)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url.origin !== 'https://db.fixture.invalid') { transport.forbidden++; throw new Error('EXTERNAL_NETWORK_DENIED') }
    if (options?.method === 'POST' && url.pathname === '/rest/v1/rpc/finish_video_job') {
      transport.mutations++
      const b = JSON.parse(String(options.body))
      try {
        await query('SELECT finish_video_job($1,$2,$3,$4)', [b.p_job_id, b.p_worker, b.p_status, b.p_error])
        transport.committed++
      } catch { return json({ message: 'FIXTURE_DB_REJECTED' }, 409) }
      return json({ message: 'FIXTURE_RESPONSE_LOST_AFTER_COMMIT' }, 503)
    }
    if (url.pathname === '/rest/v1/video_jobs' && (!options?.method || options.method === 'GET')) {
      transport.reads++
      const id = url.searchParams.get('id')?.replace(/^eq\./, '')
      return json((await query('SELECT id,status,locked_by,progress,kind,payload FROM video_jobs WHERE id=$1', [id])).rows[0] ?? null)
    }
    transport.forbidden++; throw new Error('UNEXPECTED_DB_OPERATION')
  }
})
after(async () => { globalThis.fetch = originalFetch; await pool?.end(); assert.equal(transport.forbidden, 0) })

async function newJob(skipMusic = false) {
  const id = randomUUID(), user = randomUUID()
  const reservations = await Promise.all(Array.from({ length: 12 }, () => query('SELECT reserve_video_quota($1,1) AS ok', [user])))
  assert.equal(reservations.filter(r => r.rows[0].ok).length, 1, 'budget admits only one concurrent reservation')
  await query(`INSERT INTO video_jobs(id,user_id,kind,payload,idempotency_key,status,locked_by,lease_until,attempts)
    VALUES($1::uuid,$2,'production',$3,$1::text,'processing','first',clock_timestamp()+interval '5 minutes',1)`, [id, user, { input: { userId: user, ...(skipMusic ? { step: 'music', musicStyle: 'none' } : { step: 'voice' }) } }])
  await query("SELECT checkpoint_video_job_v2($1,'first',$2,'{}')", [id, skipMusic
    ? { result: null, steps: { 'stage:music': { status: 'skipped', value: null } } }
    : { result: { url: 'https://media.fixture.invalid/final.mp4' }, steps: { 'stage:voice': { status: 'complete', value: 'https://media.fixture.invalid/final.mp4' } } }])
  return { id, user }
}
const counters = async (user: string) => (await query('SELECT reserved,completed,failed,released FROM video_quota_counters WHERE user_id=$1', [user])).rows[0]

test('lost finish response plus 12 duplicate completions: one completed debit, read reconciliation only', async () => {
  const j = await newJob(); const committed = transport.committed
  const result = await Promise.all(Array.from({ length: 12 }, () => finishJob(j.id, 'first', 'done')))
  assert.deepEqual(result, Array(12).fill('done'))
  assert.equal(transport.committed - committed, 1)
  assert.deepEqual(await counters(j.user), { reserved: 0, completed: 1, failed: 0, released: 0 })
})
test('expired lease after final checkpoint: new owner finishes; old owner cannot alter result or budget', async () => {
  const j = await newJob()
  await query("UPDATE video_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1", [j.id])
  await assert.rejects(finishJob(j.id, 'first', 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => query('SELECT * FROM claim_video_job_by_key($1,$2,600)', [j.id, `resume-${i}`])))
  const owners = claims.flatMap(r => r.rows); assert.equal(owners.length, 1)
  assert.equal(owners[0].progress.result.url, 'https://media.fixture.invalid/final.mp4')
  await assert.rejects(() => query("SELECT checkpoint_video_job_v2($1,'first',$2,'{}')", [j.id, { result: { url: 'stale' } }]), /LEASE_LOST/)
  assert.equal(await finishJob(j.id, owners[0].locked_by, 'done'), 'done')
  assert.deepEqual(await counters(j.user), { reserved: 0, completed: 1, failed: 0, released: 0 })
})
test('cancel races finish: exactly one quota settlement, cancellation can never reconcile as done', async () => {
  for (let i = 0; i < 6; i++) {
    const j = await newJob()
    const [finish] = await Promise.allSettled([finishJob(j.id, 'first', 'done'),
      ...Array.from({ length: 6 }, () => query('SELECT cancel_video_job($1)', [j.id]))])
    const row = (await query('SELECT status,progress FROM video_jobs WHERE id=$1', [j.id])).rows[0]
    const c = await counters(j.user)
    assert.equal(c.reserved, 0); assert.equal(c.completed + c.released, 1); assert.equal(c.failed, 0)
    assert.equal(row.progress.result.url, 'https://media.fixture.invalid/final.mp4')
    if (row.status === 'done') { assert.equal(finish.status, 'fulfilled'); assert.equal(c.completed, 1) }
    else { assert.equal(row.status, 'cancelled'); assert.equal(finish.status, 'rejected'); assert.equal(c.released, 1) }
  }
})
test('quota settlement DB failure rolls back done, retains result; restoring ledger allows safe finish', async () => {
  const j = await newJob()
  await query('DELETE FROM video_quota_counters WHERE user_id=$1', [j.user])
  await assert.rejects(finishJob(j.id, 'first', 'done'), /SUTRA_JOB_FINISH_UNCONFIRMED/)
  const row = (await query('SELECT status,progress FROM video_jobs WHERE id=$1', [j.id])).rows[0]
  assert.equal(row.status, 'processing'); assert.ok(row.progress.result)
  await query('SELECT reserve_video_quota($1,1)', [j.user])
  assert.equal(await finishJob(j.id, 'first', 'done'), 'done')
  assert.deepEqual(await counters(j.user), { reserved: 0, completed: 1, failed: 0, released: 0 })
})
test('explicitly skipped music reconciles its committed null result after a lost ACK', async () => {
  const j = await newJob(true)
  assert.equal(await finishJob(j.id, 'first', 'done'), 'done')
  assert.deepEqual(await counters(j.user), { reserved: 0, completed: 1, failed: 0, released: 0 })
})
test('failed outcome with lost ACK and duplicate callbacks releases exactly one reservation', async () => {
  const j = await newJob()
  assert.deepEqual(await Promise.all(Array.from({ length: 12 }, () => finishJob(j.id, 'first', 'failed', 'fixture terminal failure'))), Array(12).fill('failed'))
  assert.deepEqual(await counters(j.user), { reserved: 0, completed: 0, failed: 0, released: 1 })
})
