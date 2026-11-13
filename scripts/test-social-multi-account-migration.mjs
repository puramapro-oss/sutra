// The same migration/RLS/history assertions run against either native PostgreSQL
// or an isolated, in-memory PGlite runtime. Neither mode downloads dependencies.
// Native: SUTRA_DISPOSABLE_DB=1 DATABASE_URL_LOCAL=postgres://fixture:fixture@127.0.0.1:5432/sutra_ci_actions
// PGlite: SUTRA_TEST_PGLITE_ENTRY=/absolute/path/to/a/verified/runtime/dist/index.js
// This recipe is sequential; the separate native OAuth fixture tests races.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertDisposableDatabase } from '../tooling/disposable-database.mjs'

const entry = process.env.SUTRA_TEST_PGLITE_ENTRY
const postgresUrl = process.env.DATABASE_URL_LOCAL
if (entry && postgresUrl) throw new Error('Choose exactly one migration test backend: DATABASE_URL_LOCAL or SUTRA_TEST_PGLITE_ENTRY')
if (entry) {
  if (!isAbsolute(entry)) throw new Error('Set SUTRA_TEST_PGLITE_ENTRY to a verified local PGlite entry point')
} else {
  // Validate before importing pg, constructing a client or attempting a connection.
  assertDisposableDatabase(postgresUrl, process.env.SUTRA_DISPOSABLE_DB)
}
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK_IN_MIGRATION_TEST') }
const migration = await readFile(new URL('../migrations/20261110_social_multi_accounts.sql', import.meta.url), 'utf8')
const historyMigration = await readFile(new URL('../migrations/20261015_social_authorization_history.sql', import.meta.url), 'utf8')
const engine = entry ? 'PGlite in-memory' : 'PostgreSQL native (pg)'
let rolesCreated = false
async function openDatabase() {
  if (entry) {
    const { PGlite } = await import(pathToFileURL(entry).href)
    return new PGlite()
  }
  const { default: pg } = await import('pg')
  const options = connectionString => ({ connectionString, ssl: false, connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000, application_name: 'sutra-social-multi-account-migration-test' })
  const admin = new pg.Client(options(postgresUrl))
  const name = `sutra_ci_social_multi_${randomUUID().replaceAll('-', '')}`
  const isolatedUrl = new URL(postgresUrl)
  isolatedUrl.pathname = `/${name}`
  assertDisposableDatabase(isolatedUrl.href, process.env.SUTRA_DISPOSABLE_DB)
  const client = new pg.Client(options(isolatedUrl.href))
  let databaseCreated = false
  const close = async () => {
    try {
      await client.end()
      if (databaseCreated) await admin.query(`DROP DATABASE "${name}"`)
      // Only drop roles whose creation committed successfully in this recipe.
      // Never adopt, alter or remove a cluster's pre-existing authorization roles.
      if (rolesCreated) await admin.query('DROP ROLE anon, authenticated, service_role;')
    } finally { await admin.end() }
  }
  try {
    await admin.connect()
    const existing = await admin.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')")
    assert.equal(existing.rows.length, 0, 'Use a disposable PostgreSQL cluster without existing authorization roles')
    await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`)
    databaseCreated = true
    await client.connect()
    return { query: text => client.query(text), exec: text => client.query(text), close }
  } catch (error) {
    try { await close() } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Native migration fixture setup and cleanup failed')
    }
    throw error
  }
}
const db = await openDatabase()
let closed = false
const close = async () => {
  if (closed) return
  closed = true
  await db.close()
}
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const query = async text => (await db.query(text)).rows
const scalar = async text => Object.values((await query(text))[0])[0]
const exec = text => db.exec(text)
const service = async text => {
  await exec('SET ROLE service_role;')
  try { return await query(text) } finally { await exec('RESET ROLE;') }
}
const denied = async (text, pattern = /./) => {
  let failure
  try { await exec(text) } catch (error) { failure = error }
  // A migration has its own transaction; clear a rejected transaction and role.
  await exec('ROLLBACK; RESET ROLE;')
  assert.ok(failure, 'Expected the database to refuse this statement')
  assert.match(String(failure.message), pattern)
}
const checks = []
const check = async (name, run) => { await run(); checks.push(name); console.log(`PASS ${name}`) }
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const oldId = '33333333-3333-4333-8333-333333333333'
const legacyId = '44444444-4444-4444-8444-444444444444'
const external = 'a'.repeat(24), anotherExternal = 'b'.repeat(24), profile = 'c'.repeat(24)
const metadata = (revision = randomUUID()) => ({ credential_owner: 'zernio', zernio_profile_id: profile, sutra_oauth_revision: revision })
const insertAccount = (id, user, platform, providerId, meta = metadata()) =>
  `INSERT INTO public.social_accounts(id,user_id,platform,external_id,username,status,metadata)
   VALUES(${literal(id)},${literal(user)},${literal(platform)},${providerId === null ? 'NULL' : literal(providerId)},'fixture','connected',${json(meta)}) RETURNING id;`
const accountRows = () => query('SELECT to_jsonb(a) AS row FROM public.social_accounts a ORDER BY id;')
const historyRows = () => query('SELECT to_jsonb(h) AS row FROM sutra.social_authorization_history h ORDER BY id;')
const protectionMetadata = () => query(`SELECT c.oid::regclass::text AS relation,c.relacl::text AS acl,c.relrowsecurity,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.policyname) FROM pg_policies p
    WHERE p.schemaname=n.nspname AND p.tablename=c.relname) AS policies,
  (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t
    WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.oid IN ('public.social_accounts'::regclass,'public.social_autopilot_config'::regclass,
    'sutra.sutra_auto_config'::regclass,'sutra.social_authorization_history'::regclass) ORDER BY relation;`)
const structureMetadata = () => query(`SELECT c.conrelid::regclass::text AS relation,c.conname,pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c WHERE c.conrelid IN ('public.social_accounts'::regclass,
    'public.social_autopilot_config'::regclass,'sutra.sutra_auto_config'::regclass)
  UNION ALL SELECT i.indrelid::regclass::text,i.indexrelid::regclass::text,pg_get_indexdef(i.indexrelid)
    FROM pg_index i WHERE i.indrelid IN ('public.social_accounts'::regclass,
      'public.social_autopilot_config'::regclass,'sutra.sutra_auto_config'::regclass)
  ORDER BY 1,2;`)
let version = 'unavailable'
try {
  version = await scalar('SHOW server_version;')
  await exec(`BEGIN;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
    COMMIT;`)
  rolesCreated = true
  await exec(`CREATE SCHEMA auth; CREATE SCHEMA sutra;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    CREATE TABLE sutra.profiles(id uuid PRIMARY KEY,subscription_status text,access_revoked_at timestamptz);
    CREATE FUNCTION sutra.account_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
      $$SELECT EXISTS(SELECT 1 FROM sutra.profiles WHERE id=auth.uid() AND access_revoked_at IS NULL
        AND subscription_status IS DISTINCT FROM 'banned')$$;
    GRANT USAGE ON SCHEMA auth,sutra TO anon,authenticated,service_role;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}');
    INSERT INTO sutra.profiles VALUES('${alice}','active',NULL),('${bob}','active',NULL);
    CREATE TABLE public.social_accounts(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
      platform text NOT NULL,external_id text,username text,display_name text,avatar_url text,
      access_token text,refresh_token text,token_expires_at timestamptz,
      status text DEFAULT 'connected',metadata jsonb DEFAULT '{}',
      connected_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
      CONSTRAINT social_accounts_user_id_platform_key UNIQUE(user_id,platform));
    COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';
    CREATE UNIQUE INDEX fixture_singleton_index ON public.social_accounts(user_id,platform);
    CREATE TABLE public.social_posts(id uuid PRIMARY KEY,account_id uuid REFERENCES public.social_accounts(id));
    CREATE TABLE public.social_autopilot_config(user_id uuid PRIMARY KEY,enabled boolean,default_platforms text[]);
    CREATE TABLE sutra.sutra_auto_config(user_id uuid PRIMARY KEY,is_active boolean,publish_platforms text[]);
    INSERT INTO public.social_autopilot_config VALUES('${alice}',true,ARRAY['youtube']);
    INSERT INTO sutra.sutra_auto_config VALUES('${alice}',true,ARRAY['youtube']);
    ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.social_autopilot_config ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.sutra_auto_config ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON public.social_accounts,public.social_autopilot_config,sutra.sutra_auto_config TO service_role;
    GRANT SELECT ON public.social_accounts,public.social_autopilot_config,sutra.sutra_auto_config TO authenticated;
    CREATE POLICY fixture_accounts_owner ON public.social_accounts FOR SELECT TO authenticated USING(user_id=auth.uid());
    CREATE POLICY fixture_autopilot_owner ON public.social_autopilot_config FOR SELECT TO authenticated USING(user_id=auth.uid());
    CREATE POLICY fixture_auto_owner ON sutra.sutra_auto_config FOR SELECT TO authenticated USING(user_id=auth.uid());`)
  await exec(historyMigration)
  await service(insertAccount(oldId, alice, 'youtube', external))
  await service(insertAccount(legacyId, alice, 'instagram', null, {}))
  await exec(`INSERT INTO public.social_posts VALUES('${randomUUID()}','${oldId}');`)
  const beforeAccounts = await accountRows(), beforeHistory = await historyRows()
  const beforeProtections = await protectionMetadata()

  await check('foreign shared-table marker refuses the migration atomically', async () => {
    await exec("COMMENT ON TABLE public.social_accounts IS 'unrelated application';")
    await denied(migration, /SUTRA_SOCIAL_MULTI_ACCOUNT_SCHEMA_REVIEW_REQUIRED/)
    assert.equal(await scalar("SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.social_autopilot_config'::regclass AND attname='publish_account_ids';"), 0)
    assert.deepEqual(await accountRows(), beforeAccounts)
    await exec("COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';")
  })
  await check('legacy singleton upgrades without rewriting accounts, history, ACL, RLS or triggers', async () => {
    await exec(migration)
    assert.deepEqual(await accountRows(), beforeAccounts)
    assert.deepEqual(await historyRows(), beforeHistory)
    assert.deepEqual(await protectionMetadata(), beforeProtections)
    assert.equal(await scalar("SELECT to_regclass('public.fixture_singleton_index') IS NULL;"), true)
    assert.equal(await scalar('SELECT account_id::text FROM public.social_posts;'), oldId)
  })
  await check('both previously enabled autopilots have empty explicit destinations', async () => {
    assert.deepEqual(await query('SELECT enabled,default_platforms,publish_account_ids FROM public.social_autopilot_config;'),
      [{ enabled: true, default_platforms: ['youtube'], publish_account_ids: [] }])
    assert.deepEqual(await query('SELECT is_active,publish_platforms,publish_account_ids FROM sutra.sutra_auto_config;'),
      [{ is_active: true, publish_platforms: ['youtube'], publish_account_ids: [] }])
  })
  const secondId = randomUUID()
  await check('two accounts of one network coexist and audit events retain separate local identities', async () => {
    await service(insertAccount(secondId, alice, 'youtube', anotherExternal))
    assert.equal(await scalar(`SELECT count(*)::int FROM public.social_accounts WHERE user_id='${alice}' AND platform='youtube';`), 2)
    assert.deepEqual(await query(`SELECT account_id::text,event_type FROM sutra.social_authorization_history
      WHERE account_id='${secondId}';`), [{ account_id: secondId, event_type: 'connection' }])
    assert.equal(await scalar('SELECT account_id::text FROM public.social_posts;'), oldId)
  })
  await check('duplicate external and NULL legacy identities are rejected without partial history', async () => {
    const before = await historyRows()
    await denied(`SET ROLE service_role; ${insertAccount(randomUUID(), alice, 'youtube', external)}`, /duplicate key/i)
    await denied(`SET ROLE service_role; ${insertAccount(randomUUID(), alice, 'instagram', null, {})}`, /duplicate key/i)
    assert.deepEqual(await historyRows(), before)
    assert.equal(await scalar(`SELECT count(*)::int FROM public.social_accounts WHERE id='${legacyId}' AND external_id IS NULL;`), 1)
  })
  await check('uniqueness includes owner and network, while owner-read RLS still isolates accounts', async () => {
    await service(insertAccount(randomUUID(), bob, 'youtube', external))
    await service(insertAccount(randomUUID(), alice, 'facebook', external))
    await exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${bob}';`)
    assert.deepEqual(await query('SELECT DISTINCT user_id::text FROM public.social_accounts;'), [{ user_id: bob }])
    await denied(`UPDATE public.social_accounts SET user_id='${bob}' WHERE id='${oldId}';`, /permission denied/i)
    assert.deepEqual(await protectionMetadata(), beforeProtections)
  })
  await check('existing authorization-history transition rules remain active after upgrade', async () => {
    await service(`UPDATE public.social_accounts SET metadata=${json(metadata())} WHERE id='${oldId}' RETURNING id;`)
    assert.equal(await scalar(`SELECT count(*)::int FROM sutra.social_authorization_history WHERE account_id='${oldId}' AND event_type='reconnection';`), 1)
    await denied(`SET ROLE service_role; UPDATE public.social_accounts SET user_id='${bob}' WHERE id='${secondId}';`, /OWNER_IMMUTABLE/)
    await denied('SET ROLE service_role; DELETE FROM sutra.social_authorization_history;', /permission denied/i)
  })
  await check('destination arrays have a 50-item bound, reject NULLs and preserve empty defaults', async () => {
    const ids = Array.from({ length: 50 }, () => randomUUID())
    for (const table of ['public.social_autopilot_config', 'sutra.sutra_auto_config']) {
      await exec(`UPDATE ${table} SET publish_account_ids=ARRAY[${ids.map(literal).join(',')}]::uuid[] WHERE user_id='${alice}';`)
      assert.equal(await scalar(`SELECT cardinality(publish_account_ids) FROM ${table} WHERE user_id='${alice}';`), 50)
      await denied(`UPDATE ${table} SET publish_account_ids=publish_account_ids||ARRAY['${randomUUID()}']::uuid[];`, /check constraint/i)
      await denied(`UPDATE ${table} SET publish_account_ids=ARRAY[NULL]::uuid[];`, /check constraint/i)
      await denied(`UPDATE ${table} SET publish_account_ids=NULL;`, /null value/i)
      await exec(`UPDATE ${table} SET publish_account_ids='{}'::uuid[];
        INSERT INTO ${table}(user_id) VALUES('${bob}');`)
      assert.equal(await scalar(`SELECT cardinality(publish_account_ids) FROM ${table} WHERE user_id='${bob}';`), 0)
    }
  })
  await check('a second application changes neither rows, history nor constraints and indexes', async () => {
    const rows = await accountRows(), events = await historyRows(), structure = await structureMetadata()
    const configRows = () => query(`SELECT * FROM (
      SELECT 'social' AS kind,to_jsonb(c) AS row FROM public.social_autopilot_config c
      UNION ALL SELECT 'auto',to_jsonb(c) FROM sutra.sutra_auto_config c) snapshots ORDER BY kind,row::text;`)
    const configs = await configRows()
    await exec(migration)
    assert.deepEqual(await accountRows(), rows)
    assert.deepEqual(await historyRows(), events)
    assert.deepEqual(await structureMetadata(), structure)
    assert.deepEqual(await protectionMetadata(), beforeProtections)
    assert.deepEqual(await configRows(), configs)
  })
  await close()
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, failures: 0, skips: 0,
    postgresql: version, engine, nativeConcurrency: 'NOT_TESTED', remote: false,
    migrationSha256: createHash('sha256').update(migration).digest('hex') }))
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', checks: checks.length, failures: 1, remote: false,
    postgresql: version, engine, error: String(error.message).slice(0, 800) }))
  throw error
} finally {
  await close()
}
