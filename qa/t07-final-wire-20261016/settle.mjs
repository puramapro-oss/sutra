// Teardown only for the private cluster created by this runner.
import assert from 'node:assert/strict'
import pg from 'pg'
assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
assert.match(process.env.SUTRA_T07_PGDATA, /sutra-t07-wire-pg-[^/]+\/data$/)
const client = new pg.Client({ host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture', database: 'postgres', options: '-c search_path=sutra,public' })
await client.connect()
try {
  const pending = (await client.query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows
  for (const row of pending) assert.equal((await client.query('SELECT cancel_video_job($1) AS ok', [row.idempotency_key])).rows[0].ok, true)
  const totals = (await client.query('SELECT coalesce(sum(reserved),0)::int AS reserved FROM video_quota_counters')).rows[0]
  assert.equal(totals.reserved, 0)
  process.stdout.write(JSON.stringify({ fixtureCleanup: pending.length, ...totals }) + '\n')
} finally { await client.end() }
