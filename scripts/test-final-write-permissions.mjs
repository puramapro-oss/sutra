// Synthetic PostgreSQL on a private socket; no credentials, remote DB or providers.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const exec = promisify(execFile)
const bin = process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const dir = await mkdtemp('/tmp/sutra-t01-write-pg-')
const owner = 'sutra_permission_test_owner'
const alice = '11000000-0000-4000-8000-000000000001'
const bob = '11000000-0000-4000-8000-000000000002'
const sql = async text => (await exec(join(bin, 'psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
  '-h', dir, '-p', '55432', '-U', owner, '-d', 'postgres', '-c', text])).stdout.trim()
const client = text => sql(`SET ROLE authenticated; SET request.jwt.claim.sub='${alice}'; ${text}`)
let checks = 0, started = false
const denied = async text => {
  await assert.rejects(client(text), error => /permission denied|row-level security/.test(error.stderr)); checks++
}
try {
  await exec(join(bin, 'initdb'), ['-D', join(dir, 'data'), '--auth=trust', '--username', owner, '--no-locale', '--encoding=UTF8'])
  await exec(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), '-l', join(dir, 'server.log'), '-o', `-h '' -k ${dir} -p 55432`, '-w', 'start'])
  started = true
  const schema = await readFile(new URL('../src/data/setup-schema.ts', import.meta.url), 'utf8')
  const definition = table => {
    const text = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS sutra\\.${table} \\([\\s\\S]*?\\n\\);`))?.[0]
    assert.ok(text, `Canonical table missing: ${table}`)
    return text
  }
  await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA sutra; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    GRANT USAGE ON SCHEMA auth,sutra TO anon,authenticated,service_role;
    ${definition('profiles')} ${definition('referrals')} ${definition('referral_commissions')} ${definition('contest_submissions')}
    ALTER TABLE sutra.contest_submissions ADD COLUMN title text, ADD COLUMN description text, ADD COLUMN content_data jsonb DEFAULT '{}';
    ALTER TABLE sutra.referrals ADD COLUMN level integer NOT NULL DEFAULT 1, ADD COLUMN first_payment_processed boolean DEFAULT false;
    CREATE TABLE sutra.permission_scope_control(id integer);
    GRANT ALL ON ALL TABLES IN SCHEMA sutra TO anon,authenticated,service_role;
    CREATE FUNCTION sutra.account_is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
      $$SELECT EXISTS(SELECT 1 FROM sutra.profiles WHERE id=auth.uid() AND subscription_status IS DISTINCT FROM 'banned')$$;
    INSERT INTO auth.users VALUES ('${alice}'),('${bob}');
    INSERT INTO sutra.profiles(id,email,subscription_status) VALUES ('${alice}','a@test.invalid','active'),('${bob}','b@test.invalid','active');
    ALTER TABLE sutra.referrals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.referral_commissions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sutra.contest_submissions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_referrals ON sutra.referrals USING(auth.uid()=referrer_id OR auth.uid()=referred_id);
    CREATE POLICY own_commissions ON sutra.referral_commissions USING(auth.uid()=referrer_id OR auth.uid()=referred_id);
    CREATE POLICY own_contests ON sutra.contest_submissions USING(auth.uid()=user_id);
    INSERT INTO sutra.referrals(referrer_id,referred_id) VALUES ('${alice}','${bob}');
    INSERT INTO sutra.referral_commissions(referrer_id,referred_id,amount) VALUES ('${alice}','${bob}',1);
    INSERT INTO sutra.contest_submissions(user_id,contest_id) VALUES ('${alice}','fixture'),('${bob}','fixture');`)
  // This baseline matches the actual OVH metadata and the independently
  // reproduced three writes on the private restored database.
  assert.equal(await client('UPDATE sutra.referral_commissions SET amount=999 RETURNING amount;'), '999.00'); checks++
  assert.equal(await client('UPDATE sutra.referrals SET level=3 RETURNING level;'), '3'); checks++
  assert.equal(await client('UPDATE sutra.contest_submissions SET ai_score=100 RETURNING ai_score;'), '100'); checks++
  await sql('GRANT UPDATE(amount) ON sutra.referral_commissions TO PUBLIC; GRANT INSERT(ai_score) ON sutra.contest_submissions TO PUBLIC;')
  const scopeBefore = await sql("SELECT relacl::text FROM pg_class WHERE oid='sutra.permission_scope_control'::regclass;")
  const migration = await readFile(new URL('../migrations/20261015_client_write_permissions.sql', import.meta.url), 'utf8')
  await sql(migration)
  const aclQuery = `SELECT c.relname,c.relacl::text,a.attname,a.attacl::text FROM pg_class c
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE c.oid IN ('sutra.referrals'::regclass,'sutra.referral_commissions'::regclass,'sutra.contest_submissions'::regclass)
    ORDER BY c.relname,a.attnum;`
  const firstAcl = await sql(aclQuery)
  await sql(migration)
  assert.equal(await sql(aclQuery), firstAcl); checks++
  assert.equal(await sql("SELECT relacl::text FROM pg_class WHERE oid='sutra.permission_scope_control'::regclass;"), scopeBefore); checks++
  for (const table of ['referrals', 'referral_commissions']) {
    await denied(`DELETE FROM sutra.${table};`)
    await denied(`UPDATE sutra.${table} SET status='paid';`)
    await denied(`INSERT INTO sutra.${table}(referrer_id,referred_id) VALUES('${alice}','${bob}');`)
    assert.equal(await client(`SELECT count(*) FROM sutra.${table};`), '1'); checks++
    await assert.rejects(sql(`SET ROLE anon; SELECT * FROM sutra.${table};`), /permission denied/); checks++
  }
  await denied('UPDATE sutra.referral_commissions SET amount=10000;')
  await denied('UPDATE sutra.referrals SET level=4,first_payment_processed=true;')
  await denied('UPDATE sutra.contest_submissions SET ai_score=100,community_votes=999;')
  await denied('DELETE FROM sutra.contest_submissions;')
  for (const extra of [",ai_score", ",community_votes"]) {
    await denied(`INSERT INTO sutra.contest_submissions(user_id,contest_id${extra}) VALUES('${alice}','fixture',100);`)
  }
  await denied(`INSERT INTO sutra.contest_submissions(user_id,contest_id,status) VALUES('${alice}','fixture','winner');`)
  await denied(`INSERT INTO sutra.contest_submissions(user_id,contest_id,status) VALUES('${bob}','fixture','submitted');`)
  for (const columns of ["title,status", "title,description,content_data,status"]) {
    const values = columns.includes('description') ? "'Title','Description','{}','submitted'" : "'Title','submitted'"
    assert.equal(await client(`INSERT INTO sutra.contest_submissions(user_id,contest_id,${columns}) VALUES('${alice}','fixture',${values}) RETURNING status;`), 'submitted'); checks++
  }
  assert.equal(await client('SELECT count(*) FROM sutra.contest_submissions;'), '3'); checks++
  await sql(`UPDATE sutra.profiles SET subscription_status='banned' WHERE id='${alice}';`)
  await denied(`INSERT INTO sutra.contest_submissions(user_id,contest_id,status) VALUES('${alice}','fixture','submitted');`)
  assert.equal(await sql("SET ROLE service_role; UPDATE sutra.referral_commissions SET amount=2 RETURNING amount;"), '2.00'); checks++
  assert.equal(await sql("SET ROLE service_role; UPDATE sutra.referrals SET level=2 RETURNING level;"), '2'); checks++
  assert.equal(await sql("SET ROLE service_role; UPDATE sutra.contest_submissions SET ai_score=42 WHERE user_id='11000000-0000-4000-8000-000000000002' RETURNING ai_score;"), '42'); checks++
  console.log(JSON.stringify({ status: 'PASS', checks, failures: 0, skips: 0, remote: false }))
} finally {
  if (started) await exec(join(bin, 'pg_ctl'), ['-D', join(dir, 'data'), '-m', 'immediate', '-w', 'stop'])
}
