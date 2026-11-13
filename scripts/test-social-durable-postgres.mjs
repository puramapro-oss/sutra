// Native PostgreSQL only: this recipe creates and stops its own private cluster.
// Every publication is synthetic. No inherited database credentials, external
// account connection, provider request, production target or remote mutation.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { allocatePrivatePostgresEndpoint } from '../tooling/private-postgres-endpoint.mjs'

const exec = promisify(execFile)
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory = await mkdtemp('/tmp/sutra-social-durable-pg-')
const data = join(directory, 'data')
const { host, port, postgresOptions } = await allocatePrivatePostgresEndpoint()
assert.equal(host, '127.0.0.1')
const owner = 'sutra_social_durable_fixture'
const environment = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL: 'C', TMPDIR: directory,
  ...(process.env.LD_LIBRARY_PATH ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH } : {}) }
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK_IN_SOCIAL_DURABLE_TEST') }
const migrationUrl = new URL('../migrations/20261110_social_durable_dispatch.sql', import.meta.url)
const migration = await readFile(migrationUrl, 'utf8')
const base = await readFile(new URL('../migrations/20261012_social_publication_journals.sql', import.meta.url), 'utf8')
const receiptUrl = new URL('../test-results/ci/social-durable-postgres.json', import.meta.url)
const hash = value => createHash('sha256').update(value).digest('hex')
const evidence = { status: 'RUNNING', checks: [], assertions: 0, failures: 0, skips: 0, sql_commands: 0,
  remote: false, provider_calls: 0, command: 'node scripts/test-social-durable-postgres.mjs', node: process.version,
  cluster: directory, host, migration_sha256: hash(migration), base_migration_sha256: hash(base),
  started_at: new Date().toISOString(), stopped: false, restarts: 0 }
const expect = Object.fromEntries(['equal', 'deepEqual', 'ok', 'match'].map(method => [method, (...args) => {
  evidence.assertions++
  return assert[method](...args)
}]))
const run = async (command, args, log) => {
  try {
    const result = await exec(command, args, { env: environment, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 })
    if (log) await writeFile(join(directory, log), result.stdout + result.stderr)
    return result
  } catch (error) {
    if (log) await writeFile(join(directory, log), String(error.stdout || '') + String(error.stderr || error.message))
    throw error
  }
}
const sql = async statement => {
  evidence.sql_commands++
  try {
    return (await run(join(bin, 'psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', host,
      '-p', String(port), '-U', owner, '-d', 'postgres', '-c', statement])).stdout.trim()
  } catch (error) {
    const failure = new Error(String(error.stderr || error.message).slice(0, 1600))
    failure.stderr = String(error.stderr || '')
    throw failure
  }
}
const literal = value => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
const json = value => `${literal(JSON.stringify(value))}::jsonb`
const integer = value => value === null ? 'NULL' : String(value)
const service = statement => sql(`SET ROLE service_role; ${statement}`)
const scalar = async statement => JSON.parse(await service(statement))
const alice = '11000000-0000-4000-8000-000000000001'
const bob = '11000000-0000-4000-8000-000000000002'
const absent = '11000000-0000-4000-8000-000000000003'
const table = 'sutra.social_publication_journals'
const marker = 'SUTRA durable publication evidence. Never delete to retry a production; server role only.'
const functions = [
  'sutra.save_social_publication_journal(text,uuid,uuid,integer,jsonb,uuid,timestamptz)',
  'sutra.claim_social_publication_journals(uuid,integer,integer)',
  'sutra.release_social_publication_journal(text,uuid,uuid,uuid,timestamptz,text)',
]
const operation = (index = 0) => ({ id: randomUUID(), phase: 'queued', createdAt: '2026-11-10T00:00:00.000Z',
  dispatchRequested: true, request: { platforms: ['youtube'], accountIds: { youtube: `fixture-provider-${index}` },
    idempotencyKey: randomUUID(), videoUrl: 'https://media.invalid/fixture.mp4', caption: `Synthetic ${index}` },
  accountRows: { youtube: randomUUID() } })
const operations = count => Array.from({ length: count }, (_, index) => operation(index))
const clone = value => structuredClone(value)
const row = async (id, kind = 'video') => JSON.parse(await sql(`SELECT to_jsonb(j) FROM ${table} j
  WHERE kind=${literal(kind)} AND production_id=${literal(id)};`))
const insert = async (user = alice, kind = 'video', ops = []) => {
  const id = randomUUID()
  await service(`INSERT INTO ${table}(kind,production_id,user_id,operations)
    VALUES(${literal(kind)},${literal(id)},${literal(user)},${json(ops)});`)
  return id
}
const saveStatement = (id, revision, ops, token = null, next = 'NULL', user = alice, kind = 'video') =>
  `SELECT COALESCE(to_jsonb(sutra.save_social_publication_journal(${literal(kind)},${literal(id)},
    ${literal(user)},${integer(revision)},${json(ops)},${literal(token)},${next})),'null'::jsonb);`
const save = (...args) => scalar(saveStatement(...args))
const claim = (token, limit = 1, seconds = 240) => scalar(`SELECT COALESCE(jsonb_agg(to_jsonb(j)),'[]'::jsonb)
  FROM sutra.claim_social_publication_journals(${literal(token)},${integer(limit)},${integer(seconds)}) j;`)
const release = (id, token, next = 'NULL', error = null, user = alice, kind = 'video') => scalar(
  `SELECT to_jsonb(sutra.release_social_publication_journal(${literal(kind)},${literal(id)},${literal(user)},
    ${literal(token)},${next},${literal(error)}));`)
const denied = async (statement, pattern = /permission denied|row-level security/) => {
  let failure
  try { await sql(statement) } catch (error) { failure = error }
  expect.ok(failure, 'The database must refuse this statement')
  expect.match(failure.stderr || failure.message, pattern)
}
const refusedSave = async (id, revision, ops, token = null, next = 'NULL', user = alice) => {
  const before = await row(id)
  let result, failure
  try { result = await save(id, revision, ops, token, next, user) } catch (error) { failure = error }
  if (failure) expect.match(failure.message, /SUTRA_PUBLICATION_[A-Z_]+/)
  else expect.equal(result, null, 'Refused mutation must not return a committed revision')
  expect.deepEqual(await row(id), before, 'Refused mutation must leave the whole journal unchanged')
}
const isolateDispatch = () => sql(`UPDATE ${table} SET next_run_at=NULL;`)
const expire = id => sql(`UPDATE ${table} SET lease_until=clock_timestamp()-interval '1 second'
  WHERE kind='video' AND production_id=${literal(id)};`)
const createClaimed = async (ops = [operation()]) => {
  await isolateDispatch()
  const id = await insert()
  expect.equal(await save(id, 0, ops, null, 'clock_timestamp()'), 1)
  const token = randomUUID(), claimed = await claim(token)
  expect.equal(claimed.length, 1)
  expect.equal(claimed[0].production_id, id)
  return { id, token, current: claimed[0] }
}
const check = async (name, fn) => {
  const start = performance.now(), assertionStart = evidence.assertions
  try {
    await fn()
    evidence.checks.push({ name, status: 'PASS', assertions: evidence.assertions - assertionStart,
      duration_ms: Math.round(performance.now() - start) })
    console.log(`PASS ${name}`)
  } catch (error) {
    evidence.failures++
    evidence.checks.push({ name, status: 'FAIL', assertions: evidence.assertions - assertionStart,
      duration_ms: Math.round(performance.now() - start), error: String(error.message).slice(0, 1200) })
    console.error(`FAIL ${name}: ${String(error.message).slice(0, 500)}`)
  }
}
const metadata = () => sql(`SELECT jsonb_build_object(
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::regtype::text,a.attnotnull,
    pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d
    ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='${table}'::regclass AND a.attnum>0 AND NOT a.attisdropped),
  'table',(SELECT jsonb_build_object('rls',relrowsecurity,'acl',relacl::text) FROM pg_class WHERE oid='${table}'::regclass),
  'indexes',(SELECT jsonb_agg(indexdef ORDER BY indexname) FROM pg_indexes WHERE schemaname='sutra' AND tablename='social_publication_journals'),
  'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'acl',p.proacl::text,
    'definer',p.prosecdef,'config',p.proconfig,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sutra' AND p.proname IN
    ('save_social_publication_journal','claim_social_publication_journals','release_social_publication_journal')));`)
let started = false
const start = async label => {
  await run(join(bin, 'pg_ctl'), ['-D', data, '-l', join(directory, 'server.log'), '-o', postgresOptions, '-w', 'start'], label)
  started = true
}
const stop = async (mode, label) => {
  await run(join(bin, 'pg_ctl'), ['-D', data, '-m', mode, '-w', 'stop'], label)
  started = false
}

try {
  await run(join(bin, 'initdb'), ['-D', data, '--auth=trust', '--username', owner, '--no-locale', '--encoding=UTF8'], 'initdb.log')
  await start('start.log')
  evidence.postgresql = await sql('SHOW server_version;')
  await sql(`CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE ROLE service_role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA auth,sutra TO anon,authenticated,service_role;
    INSERT INTO auth.users VALUES(${literal(alice)}),(${literal(bob)});`)
  await sql(base)
  const legacyOps = [{ ...operation(), phase: 'submitting', firstAttemptAt: '2026-10-01T00:00:00.000Z' }]
  const legacy = await insert(alice, 'video', legacyOps), legacyAuto = await insert(bob, 'auto', legacyOps)
  const originals = () => sql(`SELECT jsonb_agg(jsonb_build_array(kind,production_id,user_id,revision,operations,updated_at)
    ORDER BY kind,production_id) FROM ${table};`)
  const beforeRows = await originals()
  const protection = () => sql(`SELECT jsonb_build_array(relrowsecurity,relacl::text) FROM pg_class WHERE oid='${table}'::regclass;`)
  const beforeProtection = await protection()
  await check('unrelated schema marker refuses migration before any additive column', async () => {
    await sql(`COMMENT ON TABLE ${table} IS 'Unrelated application';`)
    await denied(migration, /SUTRA_PUBLICATION_SCHEMA_REVIEW_REQUIRED/)
    expect.equal(await sql(`SELECT count(*) FROM pg_attribute WHERE attrelid='${table}'::regclass AND attname='dispatch_enabled';`), '0')
    expect.equal(await originals(), beforeRows)
    await sql(`COMMENT ON TABLE ${table} IS ${literal(marker)};`)
  })
  await sql(migration)
  await check('additive migration preserves existing evidence ACL RLS and inactive legacy journals', async () => {
    expect.equal(await originals(), beforeRows)
    expect.equal(await protection(), beforeProtection)
    for (const [id, kind] of [[legacy, 'video'], [legacyAuto, 'auto']]) {
      const current = await row(id, kind)
      expect.equal(current.dispatch_enabled, false)
      expect.equal(current.next_run_at, null)
      expect.equal(current.lease_token, null)
      expect.equal(current.dispatch_attempts, 0)
    }
    expect.deepEqual(await claim(randomUUID()), [])
  })
  await check('reapplying migration preserves exact schema privileges functions and rows', async () => {
    const before = await metadata(), rows = await originals()
    await sql(migration)
    expect.equal(await metadata(), before)
    expect.equal(await originals(), rows)
  })
  await check('all three RPCs are security definer with an empty search path', async () => {
    const details = JSON.parse(await metadata())
    expect.equal(details.functions.length, 3)
    expect.ok(details.functions.every(fn => fn.definer && fn.config?.includes('search_path=""')))
    expect.equal(details.table.rls, true)
  })
  for (const role of ['anon', 'authenticated']) {
    await check(`${role} cannot read or write the journal`, async () => {
      await denied(`SET ROLE ${role}; SELECT * FROM ${table};`)
      await denied(`SET ROLE ${role}; UPDATE ${table} SET revision=revision+1;`)
      await denied(`SET ROLE ${role}; INSERT INTO ${table}(kind,production_id,user_id) VALUES('video',${literal(randomUUID())},${literal(alice)});`)
    })
    for (const [index, statement] of [
      saveStatement(legacy, 0, legacyOps),
      `SELECT * FROM sutra.claim_social_publication_journals(${literal(randomUUID())},1,240);`,
      `SELECT sutra.release_social_publication_journal('video',${literal(legacy)},${literal(alice)},${literal(randomUUID())});`,
    ].entries()) {
      await check(`${role} cannot execute ${functions[index].split('(')[0]}`, async () => {
        expect.equal(await sql(`SELECT has_function_privilege(${literal(role)},${literal(functions[index])},'EXECUTE');`), 'f')
        await denied(`SET ROLE ${role}; ${statement}`)
      })
    }
  }
  await check('service role alone retains required table access and RPC execution without delete', async () => {
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) expect.equal(await sql(`SELECT has_table_privilege('service_role','${table}',${literal(privilege)});`), 't')
    expect.equal(await sql(`SELECT has_table_privilege('service_role','${table}','DELETE');`), 'f')
    for (const signature of functions) expect.equal(await sql(`SELECT has_function_privilege('service_role',${literal(signature)},'EXECUTE');`), 't')
  })
  await check('eight concurrent CAS admissions commit one complete batch of fifty operations', async () => {
    const id = await insert(), candidates = Array.from({ length: 8 }, () => operations(50))
    const results = await Promise.all(candidates.map(candidate => save(id, 0, candidate, null, 'clock_timestamp()')))
    const winners = results.flatMap((revision, index) => revision === null ? [] : [index])
    expect.equal(winners.length, 1)
    expect.equal(results[winners[0]], 1)
    const current = await row(id)
    expect.deepEqual(current.operations, candidates[winners[0]])
    expect.equal(current.operations.length, 50)
    expect.equal(current.revision, 1)
    expect.equal(current.dispatch_enabled, true)
    expect.equal(current.lease_token, null)
  })
  await check('a later invalid admission rolls back the whole transaction atomically', async () => {
    const first = await insert(), second = await insert(), before = [await row(first), await row(second)]
    const duplicate = operation()
    await denied(`SET ROLE service_role; BEGIN; ${saveStatement(first, 0, operations(50))}
      ${saveStatement(second, 0, [duplicate, duplicate])} COMMIT;`, /SUTRA_PUBLICATION_JOURNAL_INVALID/)
    expect.deepEqual([await row(first), await row(second)], before)
  })
  await check('duplicate operation identities cannot be admitted', async () => {
    const id = await insert(), duplicate = operation()
    await refusedSave(id, 0, [duplicate, duplicate])
  })
  for (const [field, mutate] of [
    ['request', op => { op.request.caption = 'Changed accepted intent' }],
    ['accountRows', op => { op.accountRows.youtube = randomUUID() }],
    ['createdAt', op => { op.createdAt = '2026-11-09T00:00:00.000Z' }],
    ['operation removal', () => {}],
  ]) {
    await check(`a live consumer cannot mutate immutable ${field}`, async () => {
      const { id, token, current } = await createClaimed(), changed = clone(current.operations)
      if (field === 'operation removal') changed.length = 0
      else mutate(changed[0])
      await refusedSave(id, current.revision, changed, token)
    })
  }
  for (const [field, mutate] of [
    ['phase', op => { op.phase = 'submitting' }],
    ['results', op => { op.results = [{ platform: 'youtube', status: 'published', success: true }] }],
    ['firstAttemptAt', op => { op.firstAttemptAt = '2026-11-10T01:00:00.000Z' }],
  ]) {
    await check(`admission without a lease cannot execute or mutate ${field}`, async () => {
      const id = await insert(), original = [operation()]
      expect.equal(await save(id, 0, original), 1)
      const changed = clone(original); mutate(changed[0])
      await refusedSave(id, 1, changed)
    })
  }
  await check('explicit admission flags can change while accepted execution evidence remains identical', async () => {
    const original = { ...operation(), phase: 'recorded', firstAttemptAt: '2026-11-10T01:00:00.000Z',
      dispatchRequested: false, blockedReason: 'SUTRA_FIXTURE_BLOCKED', results: [{ platform: 'youtube', status: 'unknown', success: false }] }
    const id = await insert(alice, 'video', [original])
    const admitted = { ...original, dispatchRequested: true, retryRequested: true, nextAttemptAt: '2026-11-10T01:05:00.000Z' }
    delete admitted.blockedReason
    expect.equal(await save(id, 0, [admitted], null, 'clock_timestamp()'), 1)
    expect.deepEqual((await row(id)).operations, [admitted])
    await refusedSave(id, 1, [{ ...admitted, phase: 'queued' }])
  })
  for (const [name, op] of [
    ['started operation', { ...operation(), firstAttemptAt: '2026-11-10T01:00:00.000Z' }],
    ['nonqueued operation', { ...operation(), phase: 'submitting' }],
    ['consumer claim', { ...operation(), claimedAt: '2026-11-10T01:00:00.000Z' }],
    ['fabricated publication', { ...operation(), results: [{ platform: 'youtube', status: 'published', success: true }] }],
    ['unrequested destination', { ...operation(), dispatchRequested: false }],
  ]) {
    await check(`admission cannot append a ${name}`, async () => {
      const id = await insert()
      await refusedSave(id, 0, [op])
    })
  }
  await check('a requested new queued destination may have an explicitly empty results array', async () => {
    const id = await insert(), queued = { ...operation(), results: [] }
    expect.equal(await save(id, 0, [queued]), 1)
    expect.deepEqual((await row(id)).operations, [queued])
  })
  await check('a consumer cannot append a new destination even with a valid live lease', async () => {
    const { id, token, current } = await createClaimed()
    await refusedSave(id, current.revision, [...current.operations, operation(2)], token)
  })
  for (const [name, results] of [['null', null], ['object', {}]]) {
    await check(`a consumer cannot poison later JSON processing with ${name} results`, async () => {
      const { id, token, current } = await createClaimed()
      await refusedSave(id, current.revision, [{ ...current.operations[0], results }], token)
    })
  }
  await check('cross-owner and nonexistent save identities never match a journal', async () => {
    const id = await insert()
    await refusedSave(id, 0, [operation()], null, 'NULL', bob)
    await refusedSave(id, 0, [operation()], null, 'NULL', absent)
    expect.equal(await save(randomUUID(), 0, [operation()]), null)
  })
  await check('eight concurrent claimers obtain one live lease with one fencing token', async () => {
    await isolateDispatch()
    const id = await insert(), accepted = operations(50)
    expect.equal(await save(id, 0, accepted, null, 'clock_timestamp()'), 1)
    const tokens = Array.from({ length: 8 }, () => randomUUID())
    const claims = await Promise.all(tokens.map(token => claim(token)))
    const winners = claims.flatMap((rows, index) => rows.length ? [{ rows, index }] : [])
    expect.equal(winners.length, 1)
    expect.equal(winners[0].rows.length, 1)
    expect.equal(winners[0].rows[0].lease_token, tokens[winners[0].index])
    expect.equal(winners[0].rows[0].revision, 2)
    expect.equal(winners[0].rows[0].dispatch_attempts, 1)
    expect.deepEqual(winners[0].rows[0].operations, accepted)
    expect.deepEqual((await row(id)).operations, accepted)
  })
  await check('a live lease rejects tokenless admission and a wrong consumer token', async () => {
    const { id, current } = await createClaimed()
    await refusedSave(id, current.revision, [...current.operations, operation(2)])
    await refusedSave(id, current.revision, current.operations, randomUUID())
  })
  await check('expired fencing tokens cannot save or release before and after a replacement claim', async () => {
    const { id, token, current } = await createClaimed()
    await expire(id)
    await refusedSave(id, current.revision, current.operations, token)
    expect.equal(await release(id, token), false)
    const nextToken = randomUUID(), [reclaimed] = await claim(nextToken)
    expect.equal(reclaimed.production_id, id)
    expect.equal(reclaimed.revision, current.revision + 1)
    expect.equal(reclaimed.dispatch_attempts, 2)
    await refusedSave(id, reclaimed.revision, reclaimed.operations, token)
    await refusedSave(id, current.revision, reclaimed.operations, nextToken)
    expect.equal(await release(id, token), false)
    const next = clone(reclaimed.operations)
    next[0].phase = 'submitting'; next[0].firstAttemptAt = '2026-11-10T02:00:00.000Z'
    expect.equal(await save(id, reclaimed.revision, next, nextToken), reclaimed.revision + 1)
  })
  await check('first provider attempt timestamp cannot be changed or removed by a live consumer', async () => {
    const { id, token, current } = await createClaimed()
    const attempted = clone(current.operations)
    attempted[0].phase = 'submitting'; attempted[0].firstAttemptAt = '2026-11-10T02:00:00.000Z'
    const revision = await save(id, current.revision, attempted, token)
    for (const replacement of ['2026-11-10T03:00:00.000Z', undefined]) {
      const changed = clone(attempted)
      if (replacement === undefined) delete changed[0].firstAttemptAt
      else changed[0].firstAttemptAt = replacement
      await refusedSave(id, revision, changed, token)
    }
    await refusedSave(id, revision, [{ ...attempted[0], phase: 'queued' }], token)
  })
  for (const [name, results] of [
    ['unknown', [{ platform: 'youtube', status: 'unknown', success: false }]],
    ['false success', [{ platform: 'youtube', status: 'published', success: false }]],
    ['missing success', []],
  ]) {
    await check(`confirmed publication cannot regress to ${name}`, async () => {
      const { id, token, current } = await createClaimed()
      const published = clone(current.operations)
      published[0].phase = 'recorded'; published[0].firstAttemptAt = '2026-11-10T02:00:00.000Z'
      published[0].results = [{ platform: 'youtube', status: 'published', success: true,
        accountId: published[0].request.accountIds.youtube, postId: 'fixture-confirmed-post' }]
      const revision = await save(id, current.revision, published, token)
      await refusedSave(id, revision, [{ ...published[0], results }], token)
    })
  }
  for (const field of ['accountId', 'postId', 'externalPostId']) {
    await check(`confirmed publication cannot replace its recorded ${field}`, async () => {
      const { id, token, current } = await createClaimed()
      const published = clone(current.operations)
      published[0].phase = 'recorded'; published[0].firstAttemptAt = '2026-11-10T02:00:00.000Z'
      published[0].results = [{ platform: 'youtube', status: 'published', success: true,
        accountId: published[0].request.accountIds.youtube, postId: 'fixture-confirmed-post', externalPostId: 'fixture-external-post' }]
      const revision = await save(id, current.revision, published, token)
      const changed = clone(published)
      changed[0].results[0][field] = 'fixture-replacement-identity'
      await refusedSave(id, revision, changed, token)
    })
  }
  await check('confirmed publication may gain new metadata while every known fact is retained', async () => {
    const { id, token, current } = await createClaimed()
    const published = clone(current.operations)
    published[0].phase = 'recorded'
    published[0].results = [{ platform: 'youtube', status: 'published', success: true, postId: 'fixture-confirmed-post' }]
    const revision = await save(id, current.revision, published, token)
    const enriched = clone(published)
    enriched[0].results[0].postUrl = 'https://social.invalid/fixture-confirmed-post'
    enriched[0].results[0].localAccountId = enriched[0].accountRows.youtube
    expect.equal(await save(id, revision, enriched, token), revision + 1)
    expect.deepEqual((await row(id)).operations, enriched)
  })
  await check('release is fenced by token live expiry ownership and revision advancement', async () => {
    const { id, token, current } = await createClaimed(), before = await row(id)
    expect.equal(await release(id, randomUUID()), false)
    expect.equal(await release(id, token, 'NULL', null, bob), false)
    expect.deepEqual(await row(id), before)
    expect.equal(await release(id, token, "clock_timestamp()+interval '1 hour'", 'SUTRA_FIXTURE_RETRY'), true)
    const released = await row(id)
    expect.equal(released.lease_token, null)
    expect.equal(released.lease_until, null)
    expect.equal(released.revision, current.revision + 1)
    expect.equal(released.last_dispatch_error, 'SUTRA_FIXTURE_RETRY')
    expect.deepEqual(released.operations, current.operations)
    expect.equal(await release(id, token), false)
    await refusedSave(id, released.revision, released.operations, token)
  })
  await check('future or absent next_run_at cannot be claimed', async () => {
    await isolateDispatch()
    const future = await insert(), dormant = await insert()
    expect.equal(await save(future, 0, [operation()], null, "clock_timestamp()+interval '1 hour'"), 1)
    expect.equal(await save(dormant, 0, [operation()]), 1)
    expect.deepEqual(await claim(randomUUID(), 4), [])
    expect.equal((await row(future)).lease_token, null)
    expect.equal((await row(dormant)).lease_token, null)
  })
  await check('fifty queued intents survive native crash restart and recover under a new lease', async () => {
    await isolateDispatch()
    const id = await insert(), accepted = operations(50)
    expect.equal(await save(id, 0, accepted, null, 'clock_timestamp()'), 1)
    const committed = await row(id)
    await stop('immediate', 'crash-stop.log')
    await start('restart.log'); evidence.restarts++
    expect.match(await readFile(join(directory, 'server.log'), 'utf8'), /automatic recovery in progress/)
    evidence.native_wal_recovery_verified = true
    expect.deepEqual(await row(id), committed)
    const oldToken = randomUUID(), [first] = await claim(oldToken)
    expect.equal(first.production_id, id)
    expect.deepEqual(first.operations, accepted)
    await expire(id)
    const freshToken = randomUUID(), [recovered] = await claim(freshToken)
    expect.equal(recovered.production_id, id)
    expect.equal(recovered.lease_token, freshToken)
    expect.equal(recovered.operations.length, 50)
    expect.deepEqual(recovered.operations, accepted)
    expect.equal(recovered.dispatch_attempts, 2)
    await refusedSave(id, recovered.revision, accepted, oldToken)
    expect.equal(await release(id, freshToken), true)
  })
  for (const [name, token, limit, seconds] of [
    ['null token', null, 1, 240], ['zero limit', randomUUID(), 0, 240], ['excess limit', randomUUID(), 5, 240],
    ['null limit', randomUUID(), null, 240], ['short lease', randomUUID(), 1, 119],
    ['long lease', randomUUID(), 1, 301], ['null lease', randomUUID(), 1, null],
  ]) {
    await check(`claim parameter bound rejects ${name}`, async () => {
      await denied(`SET ROLE service_role; SELECT * FROM sutra.claim_social_publication_journals(
        ${literal(token)},${integer(limit)},${integer(seconds)});`, /SUTRA_PUBLICATION_CLAIM_INVALID/)
    })
  }
  for (const [limit, seconds] of [[1, 120], [4, 300]]) {
    await check(`claim accepts inclusive limit ${limit} and lease ${seconds} seconds`, async () => {
      await isolateDispatch()
      const ids = []
      for (let index = 0; index < limit + 1; index++) {
        const id = await insert(); ids.push(id)
        expect.equal(await save(id, 0, [operation(index)], null, 'clock_timestamp()'), 1)
      }
      const token = randomUUID(), claimed = await claim(token, limit, seconds)
      expect.equal(claimed.length, limit)
      expect.ok(claimed.every(current => ids.includes(current.production_id) && current.lease_token === token))
      expect.equal(await sql(`SELECT bool_and(lease_until>clock_timestamp() AND lease_until<=clock_timestamp()+interval '${seconds} seconds')
        FROM ${table} WHERE lease_token=${literal(token)};`), 't')
    })
  }
  for (const [name, revision, payload, kind] of [
    ['negative revision', -1, [], 'video'], ['null revision', null, [], 'video'],
    ['object payload', 0, {}, 'video'], ['null payload', 0, null, 'video'], ['auto kind', 0, [], 'auto'],
  ]) {
    await check(`save parameter validation rejects ${name}`, async () => {
      const id = await insert()
      await denied(`SET ROLE service_role; ${saveStatement(id, revision, payload, null, 'NULL', alice, kind)}`,
        /SUTRA_PUBLICATION_JOURNAL_INVALID/)
      expect.equal((await row(id)).revision, 0)
    })
  }
  for (const code of ['provider raw text', 'SUTRA_' + 'A'.repeat(91)]) {
    await check(`release rejects ${code.includes(' ') ? 'unsafe' : 'overlong'} persisted error code`, async () => {
      const { id, token } = await createClaimed(), before = await row(id)
      await denied(`SET ROLE service_role; SELECT sutra.release_social_publication_journal('video',${literal(id)},
        ${literal(alice)},${literal(token)},NULL,${literal(code)});`, /SUTRA_PUBLICATION_ERROR_CODE_INVALID/)
      expect.deepEqual(await row(id), before)
    })
  }
  await check('legacy video and auto journals remain inactive after all dispatch activity', async () => {
    for (const [id, kind] of [[legacy, 'video'], [legacyAuto, 'auto']]) {
      const current = await row(id, kind)
      expect.equal(current.dispatch_enabled, false)
      expect.equal(current.dispatch_attempts, 0)
      expect.deepEqual(current.operations, legacyOps)
    }
  })
  await check('the migration source remains identical throughout qualification', async () => {
    evidence.migration_sha256_at_end = hash(await readFile(migrationUrl, 'utf8'))
    expect.equal(evidence.migration_sha256_at_end, evidence.migration_sha256)
  })
  evidence.status = evidence.failures ? 'FAIL' : 'PASS'
} catch (error) {
  evidence.status = 'FAIL'; evidence.failures++
  evidence.setup_or_runner_error = String(error.message).slice(0, 1600)
  console.error(evidence.setup_or_runner_error)
} finally {
  if (started) {
    try { await stop('fast', 'stop.log'); evidence.stopped = true } catch (error) {
      evidence.status = 'FAIL'; evidence.failures++
      evidence.cleanup_error = String(error.message).slice(0, 1000)
    }
  }
  evidence.check_count = evidence.checks.length
  evidence.passed_checks = evidence.checks.filter(check => check.status === 'PASS').length
  evidence.ended_at = new Date().toISOString()
  await mkdir(new URL('../test-results/ci/', import.meta.url), { recursive: true })
  await writeFile(receiptUrl, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ status: evidence.status, checks: evidence.check_count, assertions: evidence.assertions,
    failures: evidence.failures, skips: evidence.skips, migration_sha256: evidence.migration_sha256,
    ownClusterStopped: evidence.stopped, remote: false }))
  if (evidence.status !== 'PASS' || !evidence.stopped) process.exitCode = 1
}
