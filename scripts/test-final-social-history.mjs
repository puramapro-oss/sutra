// Real PostgreSQL, private Unix socket, synthetic accounts only. No remote target,
// inherited credentials, provider transport, account connection or publication.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'

const exec = promisify(execFile)
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = await mkdtemp('/tmp/sutra-social-history-pg-')
const owner = 'sutra_social_history_fixture'
const childEnvironment = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL: 'C', TMPDIR: directory }
const run = (command, args) => exec(command, args, { env: childEnvironment, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 })
const sql = async text => {
  try {
    return (await run(join(bin, 'psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
      '-h', directory, '-p', '55432', '-U', owner, '-d', 'postgres', '-c', text])).stdout.trim()
  } catch (error) {
    const failure = new Error((error.stderr || 'Local PostgreSQL command failed').slice(0, 1200))
    failure.stderr = error.stderr
    throw failure
  }
}
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const service = text => sql(`SET ROLE service_role; ${text}`)
const client = (user, text, role = 'authenticated') => sql(`SET ROLE ${role}; SET request.jwt.claim.sub=${literal(user)}; ${text}`)
const alice = '11000000-0000-4000-8000-000000000001'
const bob = '11000000-0000-4000-8000-000000000002'
const absent = '11000000-0000-4000-8000-000000000003'
const profile = '111111111111111111111111'
const external = '222222222222222222222222'
const oldAccount = randomUUID(), oldRevision = randomUUID(), foreign = randomUUID(), legacy = randomUUID()
const fresh = randomUUID(), firstRevision = randomUUID()
const meta = (revision, pending) => ({ credential_owner: 'zernio', zernio_profile_id: profile,
  sutra_oauth_revision: revision, ...(pending === undefined ? {} : { sutra_revocation_pending: pending }) })
const insert = (id, user, platform, metadata, status = 'connected') =>
  `INSERT INTO public.social_accounts(id,user_id,platform,external_id,status,metadata,access_token,refresh_token)
   VALUES(${literal(id)},${literal(user)},${literal(platform)},${literal(external)},${literal(status)},${json(metadata)},
     'fixture-access-not-a-secret','fixture-refresh-not-a-secret');`
const update = (id, metadata, status = 'connected', extra = '') =>
  `UPDATE public.social_accounts SET metadata=${json(metadata)},status=${literal(status)}${extra} WHERE id=${literal(id)};`
const count = async id => Number(await sql(`SELECT count(*) FROM sutra.social_authorization_history${id ? ` WHERE account_id=${literal(id)}` : ''};`))
const rows = async id => JSON.parse(await sql(`SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY recorded_at,id),'[]') FROM
  sutra.social_authorization_history h WHERE account_id=${literal(id)};`))
const evidence = { status: 'RUNNING', checks: [], failures: 0, skips: 0, remote: false,
  command: `${process.execPath} scripts/test-final-social-history.mjs`, node: process.version, cluster: directory, stopped: false }
const check = async (name, fn) => { await fn(); evidence.checks.push(name); console.log(`PASS ${name}`) }
const denied = (statement, pattern = /permission denied|row-level security/) =>
  assert.rejects(sql(statement), error => pattern.test(error.stderr || ''))
const migration = await readFile(new URL('../migrations/20261015_social_authorization_history.sql', import.meta.url), 'utf8')
const rollback = await readFile(new URL('../qa/t01-final-20261015/social-history-rollback.sql', import.meta.url), 'utf8')
const metadataSql = await readFile(new URL('../qa/t01-final-20261015/social-history-metadata.sql', import.meta.url), 'utf8')
let started = false
try {
  await run(join(bin, 'initdb'), ['-D', join(directory, 'data'), '--auth=trust', '--username', owner, '--no-locale', '--encoding=UTF8'])
  await run(join(bin, 'pg_ctl'), ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'),
    '-o', `-h '' -k ${directory} -p 55432`, '-w', 'start'])
  started = true
  const social = await readFile(new URL('../sql/social-autopilot.sql', import.meta.url), 'utf8')
  const definition = social.match(/CREATE TABLE IF NOT EXISTS social_accounts \([\s\S]*?\n\);/)?.[0]
  assert.ok(definition, 'Canonical public.social_accounts definition is required')
  await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,sutra TO anon,authenticated,service_role;
    CREATE TABLE sutra.profiles(id uuid PRIMARY KEY,subscription_status text,access_revoked_at timestamptz);
    CREATE FUNCTION sutra.account_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
      $$SELECT EXISTS(SELECT 1 FROM sutra.profiles WHERE id=auth.uid() AND access_revoked_at IS NULL
        AND subscription_status IS DISTINCT FROM 'banned')$$;
    INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${absent}');
    INSERT INTO sutra.profiles VALUES('${alice}','active',NULL),('${bob}','active',NULL);
    SET search_path=public; ${definition}
    COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';
    ${insert(oldAccount, alice, 'youtube', meta(oldRevision))}
    ${insert(foreign, bob, 'tiktok', { credential_owner: 'other-app', sutra_oauth_revision: 'foreign-opaque-value' })}
    ${insert(legacy, bob, 'youtube', { credential_owner: 'zernio', foreign_app: true })}
    GRANT ALL ON public.social_accounts TO service_role;
    ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
    GRANT SELECT(id,user_id,status) ON public.social_accounts TO authenticated;
    CREATE POLICY fixture_public_social_read ON public.social_accounts FOR SELECT TO authenticated USING(user_id=auth.uid());`)
  const parentMetadata = () => sql(`SELECT jsonb_build_object('acl',c.relacl,'rls',c.relrowsecurity,
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p
      WHERE schemaname='public' AND tablename='social_accounts'))
    FROM pg_class c WHERE oid='public.social_accounts'::regclass;`)
  const beforeParent = await parentMetadata()

  await check('baseline metadata distinguishes absent history without query failure', async () => {
    const baseline = JSON.parse(await sql(metadataSql))
    assert.equal(baseline.table, null)
    for (const property of ['columns','constraints','indexes','policies','triggers','functions']) assert.deepEqual(baseline[property], [])
    assert.ok(baseline.role_privileges.every(role => role.select === null && role.insert === null))
    await writeFile(new URL('../qa/t01-final-20261015/social-history-baseline-metadata.json', import.meta.url), JSON.stringify(baseline, null, 2) + '\n')
  })

  await check('schema guard refuses an unrelated shared table atomically', async () => {
    await sql("COMMENT ON TABLE public.social_accounts IS 'another app';")
    await denied(migration, /SUTRA_SOCIAL_HISTORY_SCHEMA_REVIEW_REQUIRED/)
    assert.equal(await sql("SELECT to_regclass('sutra.social_authorization_history') IS NULL;"), 't')
    await sql("COMMENT ON TABLE public.social_accounts IS 'OAuth-connected social media accounts via Zernio';")
  })
  await check('migration applies without changing public table ACL or RLS', async () => {
    await sql(migration)
    assert.equal(await parentMetadata(), beforeParent)
    assert.equal(await count(), 0, 'No invented historical consent during migration')
  })
  await check('stable metadata verifies definer, strict search path, enabled triggers and restricted ACL', async () => {
    const metadata = JSON.parse(await sql(metadataSql))
    assert.equal(metadata.table.rls, true)
    assert.equal(metadata.policies.length, 2)
    assert.equal(metadata.columns.length, 15)
    assert.ok(metadata.constraints.length >= 8)
    assert.equal(metadata.indexes.length, 3)
    assert.equal(metadata.triggers.length, 2)
    assert.ok(metadata.triggers.every(trigger => trigger.enabled === 'O'))
    assert.ok(metadata.functions.every(fn => fn.security_definer && fn.config.includes('search_path=""')))
    assert.ok(metadata.role_privileges.every(role => !role.insert && !role.update && !role.delete && !role.truncate))
    await writeFile(new URL('../qa/t01-final-20261015/social-history-metadata.json', import.meta.url), JSON.stringify(metadata, null, 2) + '\n')
  })
  await check('foreign app and legacy rows remain writable and unaudited', async () => {
    await service(update(foreign, { application: 'foreign', arbitrary: true }, 'revoked'))
    await service(update(legacy, { credential_owner: 'zernio', foreign_app: true }, 'revoked'))
    assert.equal(await count(), 0)
  })
  await check('fresh connection produces one posting request with unknown actual grants', async () => {
    await service(insert(fresh, alice, 'instagram', { ...meta(firstRevision),
      state: 'fixture-raw-state', session_id: 'fixture-session', error: 'fixture-provider-error', token: 'fixture-token' }))
    const [event] = await rows(fresh)
    assert.equal(event.event_type, 'connection')
    assert.equal(event.user_id, alice)
    assert.deepEqual(event.requested_scopes, ['posting'])
    assert.equal(event.granted_scopes, null)
    assert.equal(event.grant_evidence, 'unknown')
    assert.equal(event.remote_outcome, 'unknown')
    assert.equal(event.revision_id, firstRevision)
    assert.ok(Date.now() - Date.parse(event.recorded_at) < 60_000)
    assert.doesNotMatch(JSON.stringify(event), /fixture-|session|raw-state|access_token|refresh_token/)
  })
  await check('pre-migration authorization is preserved as observation on reconnect', async () => {
    await service(update(oldAccount, meta(randomUUID())))
    const events = await rows(oldAccount)
    assert.deepEqual(events.map(event => event.event_type), ['authorization_observed', 'reconnection'])
    assert.equal(events[0].revision_id, oldRevision)
    assert.equal(events[0].requested_scopes, null)
    assert.equal(events[0].granted_scopes, null)
  })
  let revokeRevision
  await check('revoke request is unknown; confirmation retains the same operation revision', async () => {
    revokeRevision = randomUUID()
    await service(update(fresh, meta(revokeRevision, true), 'revoked'))
    let events = await rows(fresh)
    assert.equal(events.at(-1).event_type, 'revocation_requested')
    assert.equal(events.at(-1).remote_outcome, 'unknown')
    assert.equal(events.at(-1).requested_scopes, null)
    await service(update(fresh, meta(revokeRevision, false), 'revoked'))
    events = await rows(fresh)
    assert.equal(events.at(-1).event_type, 'revocation_confirmed')
    assert.equal(events.at(-1).revision_id, revokeRevision)
    assert.equal(events.at(-1).remote_outcome, 'confirmed_revoked')
  })
  await check('idempotent cleanup does not duplicate confirmation or erase history', async () => {
    const previous = await rows(fresh)
    await service(update(fresh, meta(revokeRevision, false), 'revoked', ',access_token=NULL,refresh_token=NULL'))
    assert.deepEqual(await rows(fresh), previous)
  })
  await check('reconnect retains the first authorization and revocation facts', async () => {
    await service(update(fresh, meta(randomUUID())))
    assert.deepEqual((await rows(fresh)).map(event => event.event_type),
      ['connection', 'revocation_requested', 'revocation_confirmed', 'reconnection'])
    assert.equal((await rows(fresh))[0].revision_id, firstRevision)
  })
  await check('eight concurrent real CAS writers produce one new account revision and fact', async () => {
    const oldMetadata = await sql(`SELECT metadata FROM public.social_accounts WHERE id=${literal(fresh)};`)
    const previous = await count(fresh)
    const candidates = Array.from({ length: 8 }, () => randomUUID())
    const results = await Promise.all(candidates.map(revision => service(`UPDATE public.social_accounts
      SET metadata=${json(meta(revision))} WHERE id=${literal(fresh)} AND metadata=${literal(oldMetadata)}::jsonb RETURNING id;`)))
    assert.equal(results.filter(Boolean).length, 1)
    assert.equal(await count(fresh), previous + 1)
  })
  await check('audit insertion failure rolls back the account mutation', async () => {
    const before = await sql(`SELECT to_jsonb(a) FROM public.social_accounts a WHERE id=${literal(fresh)};`)
    const previous = await count(fresh)
    await sql(`CREATE FUNCTION sutra.fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS
      $$BEGIN RAISE EXCEPTION 'FIXTURE_AUDIT_UNAVAILABLE'; END$$;
      CREATE TRIGGER fixture_fail_audit BEFORE INSERT ON sutra.social_authorization_history
      FOR EACH ROW EXECUTE FUNCTION sutra.fixture_fail_audit();`)
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID()))}`, /FIXTURE_AUDIT_UNAVAILABLE/)
    assert.equal(await sql(`SELECT to_jsonb(a) FROM public.social_accounts a WHERE id=${literal(fresh)};`), before)
    assert.equal(await count(fresh), previous)
    await sql('DROP TRIGGER fixture_fail_audit ON sutra.social_authorization_history; DROP FUNCTION sutra.fixture_fail_audit();')
  })
  await check('explicit transaction rollback removes both new fact and account change', async () => {
    const before = await sql(`SELECT metadata FROM public.social_accounts WHERE id=${literal(fresh)};`)
    const previous = await count(fresh)
    await service(`BEGIN; ${update(fresh, meta(randomUUID()))} ROLLBACK;`)
    assert.equal(await count(fresh), previous)
    assert.equal(await sql(`SELECT metadata FROM public.social_accounts WHERE id=${literal(fresh)};`), before)
  })
  await check('history rejects direct insert update delete truncate by every application role', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const action of ['INSERT INTO sutra.social_authorization_history DEFAULT VALUES',
        "UPDATE sutra.social_authorization_history SET event_type='connection'",
        'DELETE FROM sutra.social_authorization_history', 'TRUNCATE sutra.social_authorization_history']) {
        await denied(`SET ROLE ${role}; ${action};`)
      }
      for (const fn of ['capture_social_authorization_history', 'reject_social_history_mutation']) {
        assert.equal(await sql(`SELECT has_function_privilege('${role}','sutra.${fn}()','EXECUTE');`), 'f')
      }
    }
    for (const action of ['UPDATE sutra.social_authorization_history SET user_id=user_id',
      'DELETE FROM sutra.social_authorization_history', 'TRUNCATE sutra.social_authorization_history']) {
      await denied(action, /SUTRA_SOCIAL_HISTORY_APPEND_ONLY/)
    }
  })
  await check('owner-only read rejects cross-user anonymous revoked and missing identities', async () => {
    assert.equal(Number(await client(alice, 'SELECT count(*) FROM sutra.social_authorization_history;')), await count())
    assert.equal(await client(bob, 'SELECT count(*) FROM sutra.social_authorization_history;'), '0')
    assert.equal(await client('', 'SELECT count(*) FROM sutra.social_authorization_history;'), '0')
    await denied('SET ROLE anon; SELECT * FROM sutra.social_authorization_history;')
    await sql(`UPDATE sutra.profiles SET access_revoked_at=now() WHERE id='${alice}';`)
    assert.equal(await client(alice, 'SELECT count(*) FROM sutra.social_authorization_history;'), '0')
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID()))}`, /SUTRA_SOCIAL_HISTORY_CONNECTION_INVALID/)
    await sql(`UPDATE sutra.profiles SET access_revoked_at=NULL,subscription_status='banned' WHERE id='${alice}';`)
    assert.equal(await client(alice, 'SELECT count(*) FROM sutra.social_authorization_history;'), '0')
    await sql(`UPDATE sutra.profiles SET subscription_status='active' WHERE id='${alice}';`)
  })
  await check('shared browser writer cannot forge SUTRA facts even if parent ACL drifts', async () => {
    await sql('GRANT UPDATE(metadata,status) ON public.social_accounts TO authenticated; CREATE POLICY fixture_browser_write ON public.social_accounts FOR UPDATE TO authenticated USING(true) WITH CHECK(true);')
    const previous = await count()
    await denied(`SET ROLE authenticated; SET request.jwt.claim.sub='${alice}'; ${update(fresh, meta(randomUUID()))}`, /SERVER_WRITER_REQUIRED/)
    await client(bob, update(foreign, { application: 'foreign', browser_write: true }, 'connected'))
    assert.equal(await count(), previous)
    await sql('REVOKE UPDATE(metadata,status) ON public.social_accounts FROM authenticated; DROP POLICY fixture_browser_write ON public.social_accounts;')
  })
  await check('other application writer cannot claim SUTRA audit authority', async () => {
    await sql('CREATE ROLE foreign_writer BYPASSRLS; GRANT SELECT,UPDATE ON public.social_accounts TO foreign_writer;')
    await denied(`SET ROLE foreign_writer; ${update(fresh, meta(randomUUID()))}`, /SERVER_WRITER_REQUIRED/)
    await sql(`SET ROLE foreign_writer; ${update(foreign, { application: 'foreign' })}`)
    await sql('REVOKE SELECT,UPDATE ON public.social_accounts FROM foreign_writer; DROP ROLE foreign_writer;')
  })
  await check('strict search path ignores shadow profiles and history; trigger scope is exact', async () => {
    const previous = await count(fresh)
    await service(`CREATE TEMP TABLE profiles(id uuid); CREATE TEMP TABLE social_authorization_history(id uuid);
      SET search_path=pg_temp,public; ${update(fresh, meta(randomUUID()))}`)
    assert.equal(await count(fresh), previous + 1)
    await sql(`CREATE TABLE public.fixture_other_accounts (LIKE public.social_accounts INCLUDING DEFAULTS);
      CREATE TRIGGER wrong_scope AFTER INSERT ON public.fixture_other_accounts
      FOR EACH ROW EXECUTE FUNCTION sutra.capture_social_authorization_history();`)
    await denied(`INSERT INTO public.fixture_other_accounts SELECT * FROM public.social_accounts WHERE id=${literal(fresh)};`, /TRIGGER_SCOPE/)
    await sql('DROP TABLE public.fixture_other_accounts;')
  })
  await check('ownership provenance and revision reuse fail closed without partial history', async () => {
    const previous = await count()
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID()), 'connected', `,user_id='${bob}'`)}`, /OWNER_IMMUTABLE/)
    await denied(`SET ROLE service_role; ${update(fresh, { foreign_app: true })}`, /SCOPE_REMOVAL/)
    await denied(`SET ROLE service_role; ${update(fresh, { ...meta(randomUUID()), zernio_profile_id: 'untrusted' })}`, /PROVENANCE_INVALID/)
    await denied(`SET ROLE service_role; ${update(fresh, meta('invalid-revision'))}`, /PROVENANCE_INVALID/)
    await denied(`SET ROLE service_role; ${update(fresh, meta(firstRevision))}`, /REVISION_REUSE/)
    await denied(`SET ROLE service_role; ${insert(randomUUID(), absent, 'instagram', meta(randomUUID()))}`, /OWNER_INVALID/)
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID(), 'true'), 'revoked')}`, /PROVENANCE_INVALID/)
    assert.equal(await count(), previous)
  })
  await check('pending revoke cannot be bypassed by reconnect or fabricated confirmation', async () => {
    const pendingRevision = randomUUID()
    await service(update(fresh, meta(pendingRevision, true), 'revoked'))
    const previous = await count(fresh)
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID()))}`, /CONNECTION_INVALID/)
    await denied(`SET ROLE service_role; ${update(fresh, meta(randomUUID(), false), 'revoked')}`, /TRANSITION_INVALID/)
    await denied(`SET ROLE service_role; ${update(fresh, { ...meta(pendingRevision, false), zernio_profile_id: '333333333333333333333333' }, 'revoked')}`, /REVOCATION_INVALID/)
    assert.equal(await count(fresh), previous)
    await service(update(fresh, meta(pendingRevision, true), 'revoked', ',access_token=NULL,refresh_token=NULL'))
    assert.equal(await count(fresh), previous, 'Unknown outcome remains unknown without duplicate requests')
    await service(update(fresh, meta(pendingRevision, false), 'revoked'))
  })
  await check('migration replay preserves events and identical privilege metadata', async () => {
    const previous = await rows(fresh)
    const before = await sql(metadataSql)
    await sql(migration)
    assert.deepEqual(await rows(fresh), previous)
    assert.equal(await sql(metadataSql), before)
    assert.equal(await parentMetadata(), beforeParent)
  })
  await check('physical account deletion cannot cascade into historical facts', async () => {
    const previous = await rows(oldAccount)
    await service(`DELETE FROM public.social_accounts WHERE id=${literal(oldAccount)};`)
    assert.deepEqual(await rows(oldAccount), previous)
  })
  await check('rollback retains history immutable ACL and RLS; reapply resumes observation safely', async () => {
    const previous = await rows(fresh)
    await sql(rollback)
    assert.deepEqual(await rows(fresh), previous)
    const metadata = JSON.parse(await sql(metadataSql))
    assert.equal(metadata.table.rls, true)
    assert.equal(metadata.policies.length, 2)
    assert.deepEqual(metadata.triggers.map(trigger => trigger.name), ['sutra_social_history_immutable'])
    assert.ok(metadata.role_privileges.every(role => !role.insert && !role.update && !role.delete && !role.truncate))
    await writeFile(new URL('../qa/t01-final-20261015/social-history-rollback-metadata.json', import.meta.url), JSON.stringify(metadata, null, 2) + '\n')
    await denied('SET ROLE service_role; DELETE FROM sutra.social_authorization_history;')
    await service(update(fresh, meta(randomUUID())))
    assert.deepEqual(await rows(fresh), previous, 'Capture suspended explicitly during rollback')
    await sql(migration)
    await service(update(fresh, meta(randomUUID())))
    assert.deepEqual((await rows(fresh)).slice(-2).map(event => event.event_type), ['authorization_observed', 'reconnection'])
    await writeFile(new URL('../qa/t01-final-20261015/social-history-metadata.json', import.meta.url),
      JSON.stringify(JSON.parse(await sql(metadataSql)), null, 2) + '\n')
  })
  evidence.status = 'PASS'
  evidence.migration_sha256 = createHash('sha256').update(migration).digest('hex')
  evidence.postgresql = await sql('SHOW server_version;')
} catch (error) {
  evidence.status = 'FAIL'
  evidence.failures = 1
  // Only synthetic fixtures are used; keep the saved failure bounded regardless.
  evidence.failure = String(error.message).slice(0, 500)
  throw error
} finally {
  if (started) {
    await run(join(bin, 'pg_ctl'), ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop'])
    evidence.stopped = true
  }
  await writeFile(new URL('../qa/t01-final-20261015/social-history-result.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ status: evidence.status, checks: evidence.checks.length, failures: evidence.failures,
    skips: 0, remote: false, ownClusterStopped: evidence.stopped }))
}
