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
  const features = await readFile(new URL('../migrations/v3_features.sql', import.meta.url), 'utf8')
  const auto = await readFile(new URL('../migrations/sutra_auto.sql', import.meta.url), 'utf8')
  const publicSocial = await readFile(new URL('../sql/social-autopilot.sql', import.meta.url), 'utf8')
  const points = features.match(/CREATE TABLE IF NOT EXISTS sutra\.purama_points \([\s\S]*?\n\);/)?.[0]
  const pointsPolicy = features.match(/CREATE POLICY "own_purama_points"[^;]+;/)?.[0]
  const memory = auto.match(/CREATE TABLE IF NOT EXISTS sutra\.sutra_auto_memory \([\s\S]*?\n\);/)?.[0]
  const memoryPolicy = auto.match(/CREATE POLICY "auto_memory_owner"[^;]+;/)?.[0]
  const memoryGrant = auto.match(/GRANT ALL ON sutra\.sutra_auto_memory\s+TO authenticated, service_role;/)?.[0]
  assert.ok(points && pointsPolicy && memory && memoryPolicy && memoryGrant)
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
  await sql(`${points} ${memory}
    ALTER TABLE sutra.purama_points ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.sutra_auto_memory ENABLE ROW LEVEL SECURITY;
    ${pointsPolicy} ${memoryPolicy} ${memoryGrant}
    GRANT ALL ON sutra.purama_points TO authenticated, service_role;
    INSERT INTO sutra.purama_points(user_id,balance) VALUES ('${alice}',10),('${bob}',20);
    INSERT INTO sutra.sutra_auto_memory(user_id,memory_type,content)
      VALUES ('${alice}','preference','A'),('${bob}','preference','B');`)
  const rewardTables = ['point_transactions', 'point_purchases', 'point_milestones', 'daily_gifts', 'user_achievements', 'lottery_tickets']
  for (const table of ['point_shop_items', 'achievements', 'lottery_draws', ...rewardTables]) {
    const definition = features.match(new RegExp(`CREATE TABLE IF NOT EXISTS sutra\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
    assert.ok(definition, `Missing canonical definition: ${table}`)
    await sql(definition)
    if (rewardTables.includes(table)) {
      const policy = features.match(new RegExp(`CREATE POLICY "own_${table}"[^;]+;`))?.[0]
      assert.ok(policy, `Missing canonical policy: ${table}`)
      await sql(`ALTER TABLE sutra.${table} ENABLE ROW LEVEL SECURITY; ${policy}
        GRANT ALL ON sutra.${table} TO authenticated, service_role;`)
    }
  }
  // This is the actual schema used by the OAuth/T06 routes, not sutra.social_accounts.
  await sql(`SET search_path=public; ${publicSocial}
    GRANT ALL ON public.social_accounts TO authenticated, service_role;
    GRANT SELECT(access_token),UPDATE(status) ON public.social_accounts TO PUBLIC;
    INSERT INTO public.social_accounts(user_id,platform,external_id,access_token,status)
      VALUES ('${alice}','youtube','one','fixture-token','revoked'),
             ('${bob}','youtube','two','fixture-token','connected');`)

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
  // The DDL owner can differ from the role that configured Supabase defaults.
  // New tables must obtain server privileges from migrations, never the fixture.
  await sql(`CREATE TABLE sutra.videos(id uuid PRIMARY KEY,user_id uuid,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE sutra.sutra_auto_videos(id uuid PRIMARY KEY,user_id uuid,status text);`)
  for (const name of ['v10_durable_jobs_quota.sql', 'v11_pipeline_checkpoints.sql', '20261012_social_publication_journals.sql', '20261012_private_media.sql']) {
    const source = await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8')
    await sql(source); await sql(source)
  }
  const migration = await readFile(new URL('../migrations/20261012_t02_account_permissions.sql', import.meta.url), 'utf8')
  await sql(migration); await sql(migration) // replay-safe, no changed privileges on retry
  // Reproduce residual defects on the integrated 589732c schema, after the first T02 migration.
  assert.equal(await asUser(`UPDATE sutra.purama_points SET balance=999 WHERE user_id='${alice}' RETURNING balance;`), '999'); checks++
  assert.equal(await asUser('SELECT count(access_token) FROM public.social_accounts;'), '1'); checks++
  assert.equal(await asUser(`UPDATE public.social_accounts SET status='connected',external_id='forged' WHERE user_id='${alice}' RETURNING status;`), 'connected'); checks++
  assert.equal(await asUser(`INSERT INTO sutra.daily_gifts(user_id,gift_type,gift_value) VALUES('${alice}','mega_coupon','{}') RETURNING user_id;`), alice); checks++
  // RLS does not apply to TRUNCATE: even a revoked user can delete Bob's rows.
  await sql(`UPDATE sutra.profiles SET access_revoked_at=now() WHERE id='${alice}';`)
  assert.equal(await asUser('SELECT count(*) FROM sutra.sutra_auto_memory;'), '0'); checks++
  await asUser('TRUNCATE sutra.sutra_auto_memory;')
  assert.equal(await sql('SELECT count(*) FROM sutra.sutra_auto_memory;'), '0'); checks++
  await sql(`UPDATE sutra.profiles SET access_revoked_at=null WHERE id='${alice}';
    INSERT INTO sutra.sutra_auto_memory(user_id,memory_type,content)
      VALUES ('${alice}','preference','A'),('${bob}','preference','B');
    UPDATE sutra.purama_points SET balance=10 WHERE user_id='${alice}';
    UPDATE public.social_accounts SET status='revoked',external_id='one' WHERE user_id='${alice}';
    CREATE POLICY accidental_public_social_read ON public.social_accounts FOR SELECT USING(true);
    GRANT UPDATE(balance) ON sutra.purama_points TO PUBLIC;
    GRANT TRUNCATE ON sutra.sutra_auto_memory TO PUBLIC, anon;`)
  const finalMigration = await readFile(new URL('../migrations/20261012_t02_final_permissions.sql', import.meta.url), 'utf8')
  await sql(finalMigration); await sql(finalMigration)
  const jobPermissions = await readFile(new URL('../migrations/20261013_job_service_permissions.sql', import.meta.url), 'utf8')
  await sql(jobPermissions); await sql(jobPermissions)
  for (const table of ['purama_points', ...rewardTables]) {
    for (const privilege of ['INSERT', 'UPDATE', 'DELETE']) {
      assert.equal(await sql(`SELECT has_table_privilege('authenticated','sutra.${table}','${privilege}');`), 'f'); checks++
      assert.equal(await sql(`SELECT has_any_column_privilege('authenticated','sutra.${table}','${privilege === 'DELETE' ? 'REFERENCES' : privilege}');`), 'f'); checks++
    }
    assert.equal(await sql(`SELECT has_table_privilege('service_role','sutra.${table}','SELECT,INSERT,UPDATE,DELETE');`), 't'); checks++
  }
  await expectDenied(`INSERT INTO sutra.daily_gifts(user_id,gift_type,gift_value) VALUES('${alice}','mega_coupon','{}');`)
  for (const role of ['authenticated', 'anon']) {
    for (const table of ['sutra.sutra_auto_memory', 'sutra.purama_points', 'public.social_accounts']) {
      await assert.rejects(sql(`SET ROLE ${role}; TRUNCATE ${table};`), error => /permission denied/.test(error.stderr)); checks++
      for (const privilege of ['TRIGGER', 'REFERENCES']) {
        assert.equal(await sql(`SELECT has_table_privilege('${role}','${table}','${privilege}');`), 'f'); checks++
      }
    }
  }
  assert.equal(await sql('SELECT count(*) FROM sutra.sutra_auto_memory;'), '2'); checks++
  for (const statement of [
    'UPDATE sutra.purama_points SET balance=999;', 'DELETE FROM sutra.purama_points;',
    `INSERT INTO sutra.purama_points(user_id,balance) VALUES('${alice}',999);`,
    'SELECT access_token FROM public.social_accounts;', 'SELECT refresh_token FROM public.social_accounts;',
    'SELECT metadata FROM public.social_accounts;', 'SELECT * FROM public.social_accounts;',
    "UPDATE public.social_accounts SET status='connected';", 'DELETE FROM public.social_accounts;',
    `INSERT INTO public.social_accounts(user_id,platform) VALUES('${alice}','tiktok');`,
  ]) await expectDenied(statement)
  assert.equal(await asUser('SELECT external_id FROM public.social_accounts;'), 'one'); checks++
  assert.equal(await asUser('SELECT balance FROM sutra.purama_points;'), '10'); checks++
  await assert.rejects(sql('SET ROLE anon; SELECT external_id FROM public.social_accounts;'), error => /permission denied/.test(error.stderr)); checks++
  assert.equal(await sql('SET ROLE service_role; SELECT count(access_token) FROM public.social_accounts;'), '2'); checks++
  assert.equal(await sql(`SET ROLE service_role; UPDATE public.social_accounts SET status='connected' WHERE user_id='${alice}' RETURNING status;`), 'connected'); checks++
  assert.equal(await sql(`SET ROLE service_role; UPDATE sutra.purama_points SET balance=11 WHERE user_id='${alice}' RETURNING balance;`), '11'); checks++
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
  assert.equal(await asUser('SELECT count(id) FROM public.social_accounts;'), '0'); checks++
  assert.equal(await asUser('SELECT count(*) FROM sutra.purama_points;'), '0'); checks++
  await expectDenied('TRUNCATE sutra.sutra_auto_memory;')
  await expectDenied(`INSERT INTO sutra.security_test_documents VALUES ('${alice}','forbidden');`)
  await sql(`SET ROLE service_role; UPDATE sutra.profiles SET subscription_status='active' WHERE id='${alice}';`)
  assert.equal(await asUser('SELECT count(body) FROM sutra.security_test_documents;'), '0'); checks++
  assert.equal(await sql(`SET ROLE service_role; UPDATE sutra.profiles SET access_revoked_at=null WHERE id='${alice}' RETURNING id;`), alice); checks++
  assert.equal(await asUser('SELECT body FROM sutra.security_test_documents;'), 'A'); checks++
  await assert.rejects(sql('SET ROLE anon; SELECT email FROM sutra.profiles;'), error => /permission denied/.test(error.stderr)); checks++
  for (const table of ['video_jobs', 'video_quota_counters', 'social_publication_journals', 'media_ownership']) {
    for (const role of ['authenticated', 'anon']) {
      await assert.rejects(sql(`SET ROLE ${role}; SELECT * FROM sutra.${table};`), error => /permission denied/.test(error.stderr)); checks++
    }
  }
  for (const table of ['video_jobs', 'video_quota_counters']) {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
      assert.equal(await sql(`SELECT has_table_privilege('service_role','sutra.${table}','${privilege}');`), 't'); checks++
    }
    for (const privilege of ['DELETE', 'TRUNCATE']) {
      assert.equal(await sql(`SELECT has_table_privilege('service_role','sutra.${table}','${privilege}');`), 'f'); checks++
    }
  }
  await sql(`SET ROLE service_role; INSERT INTO sutra.video_jobs(user_id,kind,idempotency_key)
    VALUES('${alice}','production','service-role-smoke');`)
  assert.equal(await sql(`SET ROLE service_role; UPDATE sutra.video_jobs SET status='cancelled'
    WHERE idempotency_key='service-role-smoke' RETURNING status;`), 'cancelled'); checks++
  assert.equal(await sql(`SET ROLE service_role; SELECT status FROM sutra.video_jobs
    WHERE idempotency_key='service-role-smoke';`), 'cancelled'); checks++
  for (const role of ['authenticated', 'anon']) {
    assert.equal(await sql(`SELECT has_function_privilege('${role}','sutra.submit_video_job(uuid,text,uuid,jsonb,text,text,integer,jsonb)','EXECUTE');`), 'f'); checks++
    assert.equal(await sql(`SELECT has_function_privilege('${role}','sutra.persist_video_job_video(uuid,text,text,uuid,jsonb,boolean)','EXECUTE');`), 'f'); checks++
  }
  assert.equal(await sql(`SET ROLE service_role; SET search_path = sutra, public; SELECT sutra.reserve_video_quota('${alice}',10);`), 't'); checks++
  const operation = '30000000-0000-4000-8000-000000000003'
  await sql(`SET ROLE service_role; INSERT INTO sutra.social_publication_journals(production_id,kind,user_id) VALUES('${operation}','video','${alice}');`)
  assert.equal(await sql('SET ROLE service_role; SELECT count(*) FROM sutra.social_publication_journals;'), '1'); checks++
  await sql(`SET ROLE service_role; INSERT INTO sutra.media_ownership(object_path,user_id) VALUES('legacy/alice.mp4','${alice}');`)
  assert.equal(await sql('SET ROLE service_role; SELECT count(*) FROM sutra.media_ownership;'), '1'); checks++
  await expectDenied(`INSERT INTO sutra.media_ownership(object_path,user_id) VALUES('legacy/forged.mp4','${alice}');`)
  await expectDenied(`UPDATE sutra.media_ownership SET user_id='${bob}';`)
  await expectDenied('DELETE FROM sutra.media_ownership;')
  await assert.rejects(sql('SET ROLE service_role; DELETE FROM sutra.social_publication_journals;'), error => /permission denied/.test(error.stderr)); checks++
  // Unknown shared schema: the complete transaction rolls back, no partial permission change.
  await sql(`COMMENT ON TABLE public.social_accounts IS 'another application';
    GRANT TRUNCATE ON sutra.sutra_auto_memory TO authenticated;`)
  await assert.rejects(sql(finalMigration), error => /SUTRA_SOCIAL_SCHEMA_REVIEW_REQUIRED/.test(error.stderr)); checks++
  assert.equal(await sql("SELECT has_table_privilege('authenticated','sutra.sutra_auto_memory','TRUNCATE');"), 't'); checks++
  await sql("COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';")
  await sql(finalMigration)
  assert.equal(await sql("SELECT has_table_privilege('authenticated','sutra.sutra_auto_memory','TRUNCATE');"), 'f'); checks++
  // A deployment without the optional public social schema must remain migratable.
  await sql('ALTER TABLE public.social_accounts RENAME TO unrelated_accounts;')
  await sql(finalMigration)
  assert.equal(await sql('SELECT count(*) FROM public.unrelated_accounts;'), '2'); checks++
  // Storage cutover is scoped to one bucket, even with broad legacy policies.
  await sql(`CREATE SCHEMA storage;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    CREATE TABLE storage.buckets(id text PRIMARY KEY, public boolean NOT NULL);
    CREATE TABLE storage.objects(id text PRIMARY KEY, bucket_id text NOT NULL);
    INSERT INTO storage.buckets VALUES('sutra-assets',true),('other-app',true);
    INSERT INTO storage.objects VALUES('sutra-object','sutra-assets'),('other-object','other-app');
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON storage.objects TO anon, authenticated, service_role;
    CREATE POLICY broad_legacy_access ON storage.objects FOR ALL USING(true) WITH CHECK(true);`)
  const cutover = await readFile(new URL('../deploy/private-media-cutover.sql', import.meta.url), 'utf8')
  await sql(cutover); await sql(cutover)
  assert.equal(await sql("SELECT public FROM storage.buckets WHERE id='sutra-assets';"), 'f'); checks++
  assert.equal(await sql("SELECT public FROM storage.buckets WHERE id='other-app';"), 't'); checks++
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await sql(`SET ROLE ${role}; SELECT id FROM storage.objects ORDER BY id;`), 'other-object'); checks++
    assert.equal(await sql(`SET ROLE ${role}; DELETE FROM storage.objects WHERE bucket_id='sutra-assets' RETURNING id;`), ''); checks++
    await assert.rejects(sql(`SET ROLE ${role}; INSERT INTO storage.objects VALUES('forged','sutra-assets');`), error => /row-level security/.test(error.stderr)); checks++
    await assert.rejects(sql(`SET ROLE ${role}; UPDATE storage.objects SET bucket_id='sutra-assets' WHERE id='other-object';`), error => /row-level security/.test(error.stderr)); checks++
  }
  assert.equal(await sql('SET ROLE service_role; SELECT count(*) FROM storage.objects;'), '2'); checks++
  process.stdout.write(`RLS_LOCAL_PASS ${checks} assertions; baseline escalation reproduced; migration replayed; no remote DB\n`)
} finally {
  if (started) await exec(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'])
  process.stdout.write(`Local-only fixture retained: ${directory}\n`)
}
