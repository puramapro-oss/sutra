// QA relay only: real handlers and SQL; session, Supabase transport and worker mocked.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mock } from 'node:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema.ts'

export async function startWire(user) {
  assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
  assert.equal(process.env.PGHOST, '127.0.0.1')
  let pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture', database: 'postgres', options: '-c search_path=sutra,public' })
  const sql = (text, values = []) => pool.query(text, values)
  const source = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
  const table = (text, name) => {
    const begin = text.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`), end = text.indexOf('\n);', begin)
    assert.ok(begin >= 0 && end > begin); return text.slice(begin, end + 3)
  }
  await sql(`CREATE SCHEMA sutra; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);`)
  await sql(table(setupSchema, 'videos'))
  await sql(table(setupSchema, 'activity_logs'))
  for (const name of ['sutra_auto_videos', 'sutra_auto_config']) await sql(table(source('migrations/sutra_auto.sql'), name))
  for (const name of ['20261006_auto_occurrence_integrity.sql', 'v10_durable_jobs_quota.sql', 'v11_pipeline_checkpoints.sql', '20261015_final_durable_integrity.sql']) await sql(source('migrations/' + name))
  await sql('INSERT INTO auth.users VALUES($1)', [user.id]); await sql('INSERT INTO profiles VALUES($1)', [user.id])
  await sql('INSERT INTO sutra_auto_config(user_id) VALUES($1)', [user.id])
  const faults = { read: false, patch: false, loseSubmit: false, loseCancel: false }
  const evidence = { requests: [], rpc: [], workerCalls: 0, providerCalls: 0, publicationCalls: 0, restartedPools: 0, restarts: [] }
  const pending = new Set(), releases = []
  const definitions = {
    submit_video_job: ['p_user_id','p_kind','p_video_id','p_payload','p_key','p_request_hash','p_limit','p_initial'],
    claim_video_job_by_key: ['p_key','p_worker','p_lease_seconds'], checkpoint_video_job_v2: ['p_job_id','p_worker','p_progress','p_provider_job_ids'],
    finish_video_job: ['p_job_id','p_worker','p_status','p_error'], cancel_video_job: ['p_key'],
  }
  const service = {
    rpc: async (name, params) => {
      assert.ok(definitions[name], 'RPC allowlist')
      evidence.rpc.push(name)
      try {
        const set = ['submit_video_job', 'claim_video_job_by_key'].includes(name)
        const call = `${name}(${definitions[name].map((_, i) => '$' + (i + 1)).join(',')})`
        const result = await sql(set ? `SELECT * FROM ${call}` : `SELECT ${call} AS result`, definitions[name].map(k => params[k]))
        if ((name === 'submit_video_job' && faults.loseSubmit) || (name === 'cancel_video_job' && faults.loseCancel)) {
          faults.loseSubmit = faults.loseCancel = false; throw new Error('SYNTHETIC_PRIVATE_ACK')
        }
        return { data: set ? result.rows : result.rows[0].result, error: null }
      } catch (error) { return { data: null, error } }
    },
    from: name => {
      assert.ok(['profiles','video_jobs','sutra_auto_config','sutra_auto_videos'].includes(name), name)
      const filters = [], ranges = []; let updates, upsert = false
      const execute = async (single = false) => {
        try {
          if (faults.read && !updates) throw new Error('SYNTHETIC_PRIVATE_READ')
          if (faults.patch && updates) throw new Error('SYNTHETIC_PRIVATE_PATCH')
          const values = [], bind = value => { values.push(value); return '$' + values.length }
          let statement = `SELECT * FROM ${name}`
          if (updates) {
            assert.equal(name, 'sutra_auto_config')
            const entries = Object.entries(updates).filter(([key]) => key !== 'user_id')
            assert.ok(entries.every(([key]) => ['schedules', 'is_active'].includes(key)))
            statement = `UPDATE ${name} SET ` + entries.map(([key, value]) => `${key}=${bind(key === 'schedules' ? JSON.stringify(value) : value)}`).join(',')
            if (upsert) filters.push(['user_id', updates.user_id])
          }
          if (filters.length) statement += ' WHERE ' + filters.map(([key, value]) => {
            assert.ok(['id','user_id','kind','idempotency_key','schedules','status'].includes(key))
            return Array.isArray(value) ? `${key}=ANY(${bind(value)}::text[])` : `${key}=${bind(value)}`
          }).join(' AND ')
          for (const [key, value] of ranges) {
            assert.equal(key, 'scheduled_for'); statement += (filters.length ? ' AND ' : ' WHERE ') + `${key}<=${bind(value)}`
          }
          if (updates) statement += ' RETURNING *'
          const result = await sql(statement, values)
          if (name === 'profiles') result.rows = result.rows.map(row => ({ ...row, email: user.email, plan: 'creator', preferred_quality: '1080p' }))
          return { data: single ? result.rows[0] ?? null : result.rows, error: null }
        } catch (error) { return { data: null, error } }
      }
      const builder = {
        select: () => builder, eq: (key, value) => { filters.push([key, value]); return builder },
        lte: (key, value) => { ranges.push([key, value]); return builder },
        in: (key, values) => { filters.push([key, values]); return builder }, order: () => builder, limit: () => builder,
        update: value => { updates = value; return builder }, upsert: value => { updates = value; upsert = true; return builder },
        single: () => execute(true), maybeSingle: () => execute(true), then: (yes, no) => execute().then(yes, no),
      }
      return builder
    },
  }
  mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => service } })
  mock.module('../../src/lib/supabase-server.ts', { namedExports: { createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) } })
  mock.module('../../src/lib/sutra-auto.ts', { namedExports: { publishAutoVideoRecord: async () => { evidence.publicationCalls++; throw new Error('PUBLICATION_FORBIDDEN') } } })
  mock.module('../../src/lib/video-worker.ts', { namedExports: { runVideoJob: async (job, worker) => {
    evidence.workerCalls++
    await queue.checkpoint(job.id, worker, {}, { fixture: 'synthetic-remote-already-submitted' })
    await new Promise(resolve => releases.push(resolve))
    return null // No provider invocation and no fabricated finished media.
  } } })
  const queue = await import('../../src/lib/video-queue.ts')
  const production = await import('../../src/app/api/production/route.ts')
  const config = await import('../../src/app/api/auto/config/route.ts')
  const status = await import('../../src/app/api/video/status/[jobId]/route.ts')
  const cron = await import('../../src/app/api/cron/sutra-auto/route.ts')
  return {
    sql, faults, evidence, queue,
    accepts: path => path === '/api/auto/config' || path === '/api/production' || path.startsWith('/api/video/status/'),
    handle: async request => {
      const path = new URL(request.url).pathname
      evidence.requests.push({ path, method: request.method, body: request.method === 'POST' || request.method === 'PATCH' ? await request.clone().json() : null })
      const task = path === '/api/auto/config' ? config[request.method](request)
        : path === '/api/production' ? production[request.method](request)
        : status.GET(request, { params: Promise.resolve({ jobId: path.split('/').at(-1) }) })
      pending.add(task)
      try { return await task } finally { pending.delete(task) }
    },
    tick: () => cron.GET(new Request('http://localhost/api/cron/sutra-auto', { headers: { authorization: 'Bearer synthetic-local-cron-only' } })),
    releaseWorker: () => releases.splice(0).forEach(resolve => resolve()),
    reopen: async () => {
      const data = process.env.SUTRA_T07_PGDATA
      assert.match(data, /sutra-t07-wire-pg-[^/]+\/data$/)
      const before = (await sql('SELECT pg_postmaster_start_time() AS started')).rows[0].started
      await pool.end()
      const restarted = spawnSync('/opt/homebrew/opt/postgresql@18/bin/pg_ctl', ['-D', data, '-l', join(dirname(data), 'restart.log'), '-m', 'fast', '-w', 'restart'], {
        env: { PATH: process.env.PATH, HOME: process.env.HOME, LC_ALL: 'C' }, encoding: 'utf8', timeout: 30000,
      })
      assert.equal(restarted.error, undefined, 'private restart must not time out while capturing inherited stdout')
      assert.equal(restarted.status, 0, 'private PostgreSQL restart must succeed')
      pool = new pg.Pool({ host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture', database: 'postgres', options: '-c search_path=sutra,public' })
      const after = (await sql('SELECT pg_postmaster_start_time() AS started')).rows[0].started
      assert.ok(after > before, 'PostgreSQL postmaster must actually restart')
      evidence.restarts.push({ before, after, status: restarted.status, stdout: restarted.stdout, stderr: restarted.stderr })
      evidence.restartedPools++
    },
    close: async output => {
      releases.splice(0).forEach(resolve => resolve()); await Promise.allSettled([...pending])
      const jobs = (await sql('SELECT id,status,kind,idempotency_key,provider_job_ids,created_at,updated_at FROM video_jobs')).rows
      const beforeCleanup = (await sql('SELECT reserved,completed,released FROM video_quota_counters')).rows
      let cleanupCancellations = 0
      for (const row of jobs.filter(row => !['done','failed','cancelled'].includes(row.status))) {
        assert.equal((await sql('SELECT cancel_video_job($1) AS ok', [row.idempotency_key])).rows[0].ok, true); cleanupCancellations++
      }
      const counters = (await sql('SELECT reserved,completed,released FROM video_quota_counters')).rows
      const activityLogs = (await sql('SELECT * FROM activity_logs ORDER BY created_at,id')).rows
      assert.ok(counters.every(row => row.reserved === 0))
      writeFileSync(join(output, 'database.json'), JSON.stringify({ jobs, beforeCleanup, counters, cleanupCancellations, activityLogs, evidence }, null, 2) + '\n')
      await pool.end()
    },
  }
}
