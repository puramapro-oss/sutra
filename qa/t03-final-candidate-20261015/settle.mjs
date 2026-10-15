// Teardown only for this launcher's isolated cluster. Not a production reconciler.
import assert from 'node:assert/strict'
import pg from 'pg'
assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
assert.ok(Number.isInteger(Number(process.env.PGPORT)) && Number(process.env.PGPORT) > 0)
const config = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
const admin = new pg.Client({ ...config, database: 'postgres' })
await admin.connect()
let databases
try { databases = (await admin.query("SELECT datname FROM pg_database WHERE datname ~ '^(t03_final_)[0-9]+_[0-9]+$'")).rows }
finally { await admin.end() }
assert.ok(databases.length > 0, 'expected fixture database')
for (const { datname } of databases) {
  const client = new pg.Client({ ...config, database: datname, options: '-c search_path=sutra,public' })
  await client.connect()
  try {
    await client.query('DELETE FROM fixture_faults')
    const pending = (await client.query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows
    for (const { idempotency_key } of pending) assert.equal((await client.query('SELECT cancel_video_job($1) AS ok', [idempotency_key])).rows[0].ok, true)
    const budget = (await client.query('SELECT coalesce(sum(reserved),0)::int AS reserved FROM video_quota_counters')).rows[0]
    assert.equal(budget.reserved, 0)
    assert.equal((await client.query("SELECT count(*)::int AS n FROM video_jobs WHERE status NOT IN ('done','failed','cancelled')")).rows[0].n, 0)
    process.stdout.write(JSON.stringify({ database: datname, fixture_only_cancellations: pending.length, ...budget }) + '\n')
  } finally { await client.end() }
}
