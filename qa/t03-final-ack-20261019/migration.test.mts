/** Private PostgreSQL rehearsal using T01's existing guard and rollback recipe. */
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'

assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1')
assert.equal(process.env.PGHOST, '127.0.0.1')
const config = { host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'fixture' }
assert.ok(Number.isInteger(config.port) && config.port > 0)
const database = `t03_ack_${process.pid}_${Date.now()}`, restored = `${database}_restore`
const directory = mkdtempSync(join(tmpdir(), 'sutra-t03-ack-backup-'))
const canonical = readFileSync('migrations/20261015_final_durable_integrity.sql', 'utf8')
const user = randomUUID(), key = `t03-final-${randomUUID()}`
let client: pg.Client, copy: pg.Client
type Definition = { name: string; definition: string; anonymousExecute: boolean; authenticatedExecute: boolean; serviceExecute: boolean }
let baseline: Definition[], applied: Definition[], rollback: string
const t01 = (mode: string, expected: unknown = null, sql = '') => execFileSync('python3', ['-c',
  "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('transition','qa/t01-consolidation-20261014/checkpoint-transition.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); v=json.load(sys.stdin); sys.stdout.write(m.DEFINITIONS if v['mode']=='definitions' else m.guarded_sql(v['expected'],v['sql']))"],
{ input: JSON.stringify({ mode, expected, sql }), encoding: 'utf8', timeout: 10000 })
const definitionsSql = t01('definitions')
const definitions = async (connection = client): Promise<Definition[]> => (await connection.query(definitionsSql)).rows[0].json_agg
const rows = async (connection = client) => {
  const names = (await connection.query("SELECT tablename FROM pg_tables WHERE schemaname='sutra' ORDER BY tablename")).rows
  const output: Record<string, unknown> = {}
  for (const { tablename } of names) {
    assert.match(tablename, /^[a-z_][a-z_0-9]*$/)
    output[tablename] = (await connection.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS rows FROM sutra.${tablename} t`)).rows[0].rows
  }
  return output
}
const table = (sql: string, name: string) => {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`), end = sql.indexOf('\n);', start)
  assert.ok(start >= 0 && end > start)
  return sql.slice(start, end + 3)
}
before(async () => {
  const admin = new pg.Client({ ...config, database: 'postgres' })
  await admin.connect()
  try {
    for (const role of ['anon','authenticated','service_role']) {
      if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await admin.query(`CREATE ROLE ${role}`)
    }
    await admin.query(`CREATE DATABASE ${database}`); await admin.query(`CREATE DATABASE ${restored}`)
  } finally { await admin.end() }
  client = new pg.Client({ ...config, database, options: '-c search_path=sutra,public' })
  copy = new pg.Client({ ...config, database: restored, options: '-c search_path=sutra,public' })
  await client.connect(); await copy.connect()
  await client.query(`CREATE SCHEMA sutra; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE sutra.profiles(id uuid PRIMARY KEY);
    CREATE TABLE sutra.sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra.sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);`)
  await client.query(table(setupSchema, 'videos')); await client.query(table(setupSchema, 'activity_logs'))
  await client.query(table(readFileSync('migrations/sutra_auto.sql', 'utf8'), 'sutra_auto_videos'))
  for (const path of ['migrations/20261006_auto_occurrence_integrity.sql', 'migrations/v10_durable_jobs_quota.sql', 'migrations/v11_pipeline_checkpoints.sql']) await client.query(readFileSync(path, 'utf8'))
  await client.query('INSERT INTO auth.users VALUES($1);', [user]); await client.query('INSERT INTO profiles VALUES($1)', [user])
  await client.query('SELECT * FROM submit_video_job($1,$2,NULL,$3,$4,$5,1,NULL)',
    [user, 'production', { input: { userId: user, step: 'music', musicStyle: 'none' } }, key, 'a'.repeat(64)])
  baseline = await definitions(); assert.equal(baseline.length, 6)
  // Same six-definition rollback as T01's verify-checkpoint-restore.py, scoped to this fixture.
  rollback = 'BEGIN;\nSET LOCAL search_path TO sutra, pg_temp;\n' + baseline.map(row => row.definition + ';\n').join('')
    + 'DROP FUNCTION sutra.video_job_result_valid(sutra.video_jobs);\nCOMMIT;\n'
})
after(async () => {
  try {
    for (const connection of [client, copy]) {
      if (!connection) continue
      await connection.query('ROLLBACK')
      const pending = (await connection.query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows
      for (const row of pending) assert.equal((await connection.query('SELECT cancel_video_job($1) AS ok', [row.idempotency_key])).rows[0].ok, true)
      assert.equal((await connection.query('SELECT coalesce(sum(reserved),0)::int AS n FROM video_quota_counters')).rows[0].n, 0)
      process.stdout.write(JSON.stringify({ fixture: 'T03_BACKUP_FIXTURE_SETTLED', reserved: 0, cancellations: pending.length }) + '\n')
    }
  } finally { await client?.end(); await copy?.end() }
})

test('synthetic pre-migration dump restores into a second private DB with exact rows, functions, ACL and CHECKs', async () => {
  const file = join(directory, 'before.dump'), bin = process.env.T03_PG_BIN!
  execFileSync(join(bin, 'pg_dump'), ['--format=custom', '--file', file, database], { timeout: 30000 })
  execFileSync(join(bin, 'pg_restore'), ['--exit-on-error', '--dbname', restored, file], { timeout: 30000 })
  assert.deepEqual(await definitions(copy), baseline)
  assert.deepEqual(await rows(copy), await rows())
  const checks = "SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='sutra'::regnamespace ORDER BY 1,2"
  assert.deepEqual((await copy.query(checks)).rows, (await client.query(checks)).rows)
  writeFileSync(join(process.env.T03_PROOF_DIR!, 'backup.json'), JSON.stringify({ fixture_only: true, file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), exact_rows_definitions_acl_constraints: true,
    production_auth_and_objects: 'NOT_TESTED' }, null, 2) + '\n')
})

test('v11 upgrade and double replay preserve data; guarded function rollback retains writes made after migration', async () => {
  const beforeRows = await rows()
  await client.query(t01('guard', baseline, canonical)); applied = await definitions()
  assert.equal(applied.length, 7)
  for (let i = 0; i < 2; i++) await client.query(t01('guard', applied, canonical))
  assert.deepEqual(await definitions(), applied); assert.deepEqual(await rows(), beforeRows)
  const helper = applied.find(row => row.name === 'video_job_result_valid')!
  assert.equal(helper.serviceExecute, true); assert.equal(helper.anonymousExecute, false); assert.equal(helper.authenticatedExecute, false)
  await client.query("INSERT INTO activity_logs(user_id,type,description) VALUES($1,'fixture','post-migration write retained')", [user])
  const acquiredRows = await rows()
  await client.query(t01('guard', applied, rollback))
  assert.deepEqual(await definitions(), baseline); assert.deepEqual(await rows(), acquiredRows)
  await client.query(t01('guard', baseline, canonical))
  assert.deepEqual(await definitions(), applied); assert.deepEqual(await rows(), acquiredRows)
  writeFileSync(join(process.env.T03_PROOF_DIR!, 'rollback.json'), JSON.stringify({ fixture_only: true,
    migration_sha256: createHash('sha256').update(canonical).digest('hex'), rollback_sha256: createHash('sha256').update(rollback).digest('hex'),
    restored_exact_functions_acl: true, retained_post_migration_rows: true, reapply_exact: true }, null, 2) + '\n')
})

test('T01 guard rejects definition drift; SQL error halfway through migration rolls back all replacements', async () => {
  const stable = await definitions(), stableRows = await rows()
  await client.query("CREATE OR REPLACE FUNCTION cancel_video_job(p_key text) RETURNS boolean LANGUAGE plpgsql SET search_path=sutra,pg_temp AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_DRIFT'; END $$")
  await assert.rejects(client.query(t01('guard', stable, canonical)), /SUTRA_FUNCTION_DEFINITION_DRIFT/)
  await client.query('ROLLBACK')
  await client.query(stable.find(row => row.name === 'cancel_video_job')!.definition)
  const broken = canonical.replace('COMMIT;', "SELECT fixture_missing_migration_operation();\nCOMMIT;")
  await assert.rejects(client.query(t01('guard', stable, broken)), /fixture_missing_migration_operation/)
  await client.query('ROLLBACK')
  assert.deepEqual(await definitions(), stable); assert.deepEqual(await rows(), stableRows)
})

test('cancel audit insert failure cannot release quota or acknowledge cancellation; concurrent retry writes one receipt', async () => {
  const beforeRows = await rows()
  await client.query(`CREATE FUNCTION fixture_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FIXTURE_AUDIT_SQL_FAILURE'; END $$;
    CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON activity_logs FOR EACH ROW EXECUTE FUNCTION fixture_audit_failure();`)
  try { await assert.rejects(client.query('SELECT cancel_video_job($1)', [key]), /FIXTURE_AUDIT_SQL_FAILURE/) }
  finally { await client.query('DROP TRIGGER fixture_audit_failure ON activity_logs; DROP FUNCTION fixture_audit_failure();') }
  assert.deepEqual(await rows(), beforeRows)
  const peers = Array.from({ length: 8 }, () => new pg.Client({ ...config, database, options: '-c search_path=sutra,public' }))
  try {
    await Promise.all(peers.map(peer => peer.connect()))
    const results = await Promise.all(peers.map(peer => peer.query('SELECT cancel_video_job($1) AS ok', [key])))
    assert.equal(results.filter(result => result.rows[0].ok).length, 1)
  } finally { await Promise.all(peers.map(peer => peer.end())) }
  assert.deepEqual((await client.query('SELECT reserved,completed,released FROM video_quota_counters WHERE user_id=$1', [user])).rows, [{ reserved: 0, completed: 0, released: 1 }])
  assert.equal((await client.query("SELECT count(*)::int AS n FROM activity_logs WHERE type='video_cancelled'")).rows[0].n, 1)
  assert.equal((await client.query("SELECT status,progress->'effects' ? 'activity_logs:cancelled' AS receipt FROM video_jobs WHERE idempotency_key=$1", [key])).rows[0].receipt, true)
})
