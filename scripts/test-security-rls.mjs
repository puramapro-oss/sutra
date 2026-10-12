// Isolated PostgreSQL on a private Unix socket. Never reads a DB URL or contacts Supabase.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const exec = promisify(execFile)
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = await mkdtemp('/tmp/sutra-t02-pg-')
const data = join(directory, 'data')
const owner = 'sutra_test_owner'
const alice = '10000000-0000-4000-8000-000000000001'
const bob = '10000000-0000-4000-8000-000000000002'
let started = false, checks = 0
const sql = async command => (await exec(join(bin, 'psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
  '-h', directory, '-p', '55432', '-U', owner, '-d', 'postgres', '-c', command])).stdout.trim()
const asUser = command => sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${alice}'; ${command}`)
const expectDenied = async command => {
  await assert.rejects(asUser(command), error => /permission denied|row-level security/.test(error.stderr)); checks++
}
try {
  await exec(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username', owner, '--no-locale', '--encoding=UTF8'])
  await exec(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', `-h '' -k ${directory} -p 55432`, '-w', 'start'])
  started = true
  const schema = await readFile(new URL('../src/data/setup-schema.ts', import.meta.url), 'utf8')
  const audit = await readFile(new URL('../migrations/audit_completion.sql', import.meta.url), 'utf8')
  const karma = await readFile(new URL('../migrations/v7_karma_light.sql', import.meta.url), 'utf8')
  const profiles = schema.match(/CREATE TABLE IF NOT EXISTS sutra\.profiles \([\s\S]*?\n\);/)?.[0]
  const social = audit.match(/CREATE TABLE IF NOT EXISTS sutra\.social_accounts \([\s\S]*?\n\);/)?.[0]
  const profilePolicy = schema.match(/CREATE POLICY "own_profiles"[^;]+;/)?.[0]
  const socialPolicy = audit.match(/CREATE POLICY "own_social_accounts"[^;]+;/)?.[0]
  assert.ok(profiles && social && profilePolicy && socialPolicy)
  const seeds = karma.match(/CREATE TABLE IF NOT EXISTS sutra\.karma_seeds \([\s\S]*?\n\);/)?.[0]
  const ledger = karma.match(/CREATE TABLE IF NOT EXISTS sutra\.karma_seed_transactions \([\s\S]*?\n\);/)?.[0]
  const award = karma.match(/CREATE OR REPLACE FUNCTION sutra\.karma_award_seeds\([\s\S]*?\$\$ LANGUAGE plpgsql SECURITY DEFINER;/)?.[0]
  assert.ok(seeds && ledger && award)
  await sql(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA sutra, auth TO anon, authenticated, service_role;
    INSERT INTO auth.users VALUES ('${alice}'), ('${bob}');
    ${profiles} ${social}
    ALTER TABLE sutra.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.social_accounts ENABLE ROW LEVEL SECURITY;
    ${profilePolicy} ${socialPolicy}
    GRANT ALL ON ALL TABLES IN SCHEMA sutra TO authenticated, service_role;
    INSERT INTO sutra.profiles(id,email,subscription_status) VALUES
      ('${alice}','alice@test.invalid','active'), ('${bob}','bob@test.invalid','active');
    INSERT INTO sutra.social_accounts(user_id,platform,account_id,access_token) VALUES
      ('${alice}','youtube','one','synthetic-token'), ('${bob}','youtube','two','synthetic-token');
    CREATE TABLE sutra.security_test_documents(user_id uuid, body text);
    ALTER TABLE sutra.security_test_documents ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_documents ON sutra.security_test_documents FOR ALL USING (user_id = auth.uid());
    GRANT ALL ON sutra.security_test_documents TO authenticated, service_role;
    INSERT INTO sutra.security_test_documents VALUES ('${alice}','A'), ('${bob}','B');`)
  await sql(`${seeds} ${ledger} ${award}
    ALTER TABLE sutra.karma_seeds ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.karma_seed_transactions ENABLE ROW LEVEL SECURITY;`)

  // Prove the vulnerable canonical policy under ordinary authenticated table grants.
  assert.equal(await asUser(`UPDATE sutra.profiles SET is_admin=true, credits=999, subscription_status='banned' WHERE id='${alice}' RETURNING is_admin;`), 't'); checks++
  assert.equal(await asUser(`UPDATE sutra.profiles SET subscription_status='active' WHERE id='${alice}' RETURNING subscription_status;`), 'active'); checks++
  assert.equal(await asUser('SELECT count(access_token) FROM sutra.social_accounts;'), '1'); checks++
  await asUser(`SELECT sutra.karma_award_seeds('${bob}',999,'synthetic');`)
  assert.equal(await sql(`SELECT balance FROM sutra.karma_seeds WHERE user_id='${bob}';`), '999'); checks++
  await sql(`UPDATE sutra.profiles SET is_admin=false,credits=0;
    GRANT UPDATE(is_admin) ON sutra.profiles TO PUBLIC;
    GRANT SELECT(access_token) ON sutra.social_accounts TO PUBLIC;
    CREATE POLICY accidental_broad_read ON sutra.profiles FOR SELECT USING (true);`)
  // Apply the integrated migration order with realistic Supabase grants, then test isolation.
  await sql(`CREATE TABLE sutra.videos(id uuid PRIMARY KEY,user_id uuid,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE sutra.sutra_auto_videos(id uuid PRIMARY KEY,user_id uuid,status text);
    ALTER DEFAULT PRIVILEGES IN SCHEMA sutra GRANT ALL ON TABLES TO service_role;`)
  for (const name of ['v10_durable_jobs_quota.sql', 'v11_pipeline_checkpoints.sql', '20261012_social_publication_journals.sql']) {
    const source = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8')
    await sql(source); await sql(source)
  }
  const migration = await readFile(new URL('../migrations/20261012_t02_account_permissions.sql', import.meta.url), 'utf8')
  await sql(migration); await sql(migration) // replay-safe, no changed privileges on retry
  await expectDenied(`SELECT sutra.karma_award_seeds('${bob}',999,'synthetic');`)
  await assert.rejects(sql(`SET ROLE anon; SELECT sutra.karma_award_seeds('${bob}',999,'synthetic');`), error => /permission denied/.test(error.stderr)); checks++
  await sql(`SET ROLE service_role; SELECT sutra.karma_award_seeds('${bob}',1,'synthetic');`)
  assert.equal(await sql(`SELECT balance FROM sutra.karma_seeds WHERE user_id='${bob}';`), '1000'); checks++
  for (const assignment of ["is_admin=true", "credits=999", "wallet_balance=999", "plan='admin'",
    "subscription_status='active'", 'access_revoked_at=null', "email='impersonated@test.invalid'", `id='${bob}'`, 'monthly_video_count=0']) {
    await expectDenied(`UPDATE sutra.profiles SET ${assignment} WHERE id='${alice}';`)
  }
  await expectDenied(`DELETE FROM sutra.profiles WHERE id='${alice}';`)
  await expectDenied(`INSERT INTO sutra.profiles(id,email) VALUES ('30000000-0000-4000-8000-000000000003','x@test.invalid');`)
  assert.equal(await asUser(`UPDATE sutra.profiles SET name='Alice',preferred_quality='1080p' WHERE id='${alice}' RETURNING name;`), 'Alice'); checks++
  assert.equal(await asUser(`UPDATE sutra.profiles SET name='stolen' WHERE id='${bob}' RETURNING id;`), ''); checks++
  assert.equal(await asUser('SELECT count(*) FROM sutra.profiles;'), '1'); checks++
  for (const column of ['access_token', 'refresh_token', 'metadata']) await expectDenied(`SELECT ${column} FROM sutra.social_accounts;`)
  await expectDenied(`UPDATE sutra.social_accounts SET is_active=true;`)
  await expectDenied(`INSERT INTO sutra.social_accounts(user_id,platform,account_id) VALUES ('${alice}','x','forged');`)
  assert.equal(await asUser('SELECT account_id FROM sutra.social_accounts;'), 'one'); checks++
  assert.equal(await asUser('SELECT body FROM sutra.security_test_documents;'), 'A'); checks++
  assert.equal(await sql(`SET ROLE service_role; UPDATE sutra.profiles SET subscription_status='banned',access_revoked_at=now() WHERE id='${alice}' RETURNING id;`), alice); checks++
  assert.equal(await asUser('SELECT count(*) FROM sutra.profiles;'), '0'); checks++
  assert.equal(await asUser('SELECT count(body) FROM sutra.security_test_documents;'), '0'); checks++
  await expectDenied(`INSERT INTO sutra.security_test_documents VALUES ('${alice}','forbidden');`)
  await sql(`SET ROLE service_role; UPDATE sutra.profiles SET subscription_status='active' WHERE id='${alice}';`)
  assert.equal(await asUser('SELECT count(body) FROM sutra.security_test_documents;'), '0'); checks++
  assert.equal(await sql(`SET ROLE service_role; UPDATE sutra.profiles SET access_revoked_at=null WHERE id='${alice}' RETURNING id;`), alice); checks++
  assert.equal(await asUser('SELECT body FROM sutra.security_test_documents;'), 'A'); checks++
  await assert.rejects(sql('SET ROLE anon; SELECT email FROM sutra.profiles;'), error => /permission denied/.test(error.stderr)); checks++
  for (const table of ['video_jobs', 'video_quota_counters', 'social_publication_journals']) {
    for (const role of ['authenticated', 'anon']) {
      await assert.rejects(sql(`SET ROLE ${role}; SELECT * FROM sutra.${table};`), error => /permission denied/.test(error.stderr)); checks++
    }
  }
  for (const role of ['authenticated', 'anon']) {
    assert.equal(await sql(`SELECT has_function_privilege('${role}','sutra.submit_video_job(uuid,text,uuid,jsonb,text,text,integer,jsonb)','EXECUTE');`), 'f'); checks++
    assert.equal(await sql(`SELECT has_function_privilege('${role}','sutra.persist_video_job_video(uuid,text,text,uuid,jsonb,boolean)','EXECUTE');`), 'f'); checks++
  }
  assert.equal(await sql(`SET ROLE service_role; SET search_path = sutra, public; SELECT sutra.reserve_video_quota('${alice}',10);`), 't'); checks++
  const operation = '30000000-0000-4000-8000-000000000003'
  await sql(`SET ROLE service_role; INSERT INTO sutra.social_publication_journals(production_id,kind,user_id) VALUES('${operation}','video','${alice}');`)
  assert.equal(await sql('SET ROLE service_role; SELECT count(*) FROM sutra.social_publication_journals;'), '1'); checks++
  await assert.rejects(sql('SET ROLE service_role; DELETE FROM sutra.social_publication_journals;'), error => /permission denied/.test(error.stderr)); checks++
  process.stdout.write(`RLS_LOCAL_PASS ${checks} assertions; baseline escalation reproduced; migration replayed; no remote DB\n`)
} finally {
  if (started) await exec(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'])
  process.stdout.write(`Local-only fixture retained: ${directory}\n`)
}
