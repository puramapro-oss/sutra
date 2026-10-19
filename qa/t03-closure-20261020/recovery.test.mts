/** Real route + canonical PostgreSQL; only transport/session/providers are mocked. */
import assert from 'node:assert/strict'
import { test, before, after, afterEach, mock } from 'node:test'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import pg from 'pg'
import { setupSchema } from '../../src/data/setup-schema'
assert.equal(process.env.SUTRA_DISPOSABLE_DB, '1'); assert.equal(process.env.PGHOST,'127.0.0.1')
const options = { host:'127.0.0.1',port:Number(process.env.PGPORT),user:'fixture',database:'t03_scheduler',options:'-c search_path=sutra,public' }
const source = (name: string) => readFileSync(name,'utf8')
const migration = 'migrations/20261020_t03_auto_scheduler.sql', rollback = 'migrations/20261020_t03_auto_scheduler.rollback.sql'
const table = (text: string, name: string) => { const a=text.indexOf(`CREATE TABLE IF NOT EXISTS sutra.${name} (`), b=text.indexOf('\n);',a); assert.ok(a>=0&&b>a); return text.slice(a,b+3) }
let pool: pg.Pool
const sql = (text: string,args: unknown[] = []) => pool.query(text,args)
let fault = '', submissions = 0, publications = 0
let lastParams: Record<string, unknown>
const wire = {
  rpc: async (name: string, p: Record<string,unknown>) => {
    assert.equal(name,'schedule_auto_video_jobs'); submissions++; lastParams=structuredClone(p)
    if(fault==='throw') throw new Error('PRIVATE_TRANSPORT_DIAGNOSTIC')
    try {
      if(fault==='before') throw new Error('PRIVATE_DATABASE_DIAGNOSTIC')
      if(fault==='pause') await sql('UPDATE sutra_auto_config SET is_active=false WHERE user_id=$1',[p.p_user_id])
      const data=(await sql('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6) AS result',
        [p.p_user_id,p.p_from,p.p_through,p.p_updated_at,JSON.stringify(p.p_jobs),fault==='quota'?1:p.p_limit])).rows[0].result
      if(fault==='lost') throw new Error('PRIVATE_LOST_ACK')
      if(fault==='invalid') return {data:{cursor:'invalid',jobs:[]},error:null}
      if(fault==='status') data.jobs[0].status='unknown-state'
      if(fault==='reconciliation') data.jobs[0].status='reconciliation_required'
      return {data,error:null}
    } catch(error) { return {data:null,error} }
  },
  from: (name: string) => {
    assert.ok(['sutra_auto_config','sutra_auto_videos','profiles'].includes(name))
    const filters: Array<[string,unknown,string]> = []
    const execute=async(single=false) => {
      try {
        if(fault==='read') throw new Error('PRIVATE_READ_DIAGNOSTIC')
        const values:unknown[]=[]
        const where=filters.map(([key,value,op]) => { assert.ok(['id','user_id','status','scheduled_for'].includes(key)); values.push(value); return Array.isArray(value)?`${key}=ANY($${values.length}::text[])`:`${key}${op}$${values.length}` })
        let rows=(await sql(`SELECT to_jsonb(t) AS record FROM ${name} t${where.length?' WHERE '+where.join(' AND '):''}`,values)).rows.map(row=>row.record)
        if(name==='profiles') rows=rows.map(row=>({...row,email:'t03@fixture.invalid',plan:'creator'}))
        return {data:single?rows[0]??null:rows,error:null}
      } catch(error) { return {data:null,error} }
    }
    const builder={ select:()=>builder,eq:(k:string,v:unknown)=>{filters.push([k,v,'=']);return builder},
      in:(k:string,v:unknown)=>{filters.push([k,v,'=']);return builder},lte:(k:string,v:unknown)=>{filters.push([k,v,'<=']);return builder},
      order:()=>builder,limit:()=>builder,single:()=>execute(true),then:(yes: (v:unknown)=>unknown,no:(e:unknown)=>unknown)=>execute().then(yes,no) }
    return builder
  },
}
mock.module('../../src/lib/supabase.ts',{namedExports:{createServiceClient:()=>wire}})
mock.module('../../src/lib/sutra-auto.ts',{namedExports:{publishAutoVideoRecord:async()=>{publications++;throw new Error('FORBIDDEN_PUBLICATION')}}})
const {GET}=await import('../../src/app/api/cron/sutra-auto/route')
const {scheduleAutoWindow}=await import('../../src/lib/auto-scheduler')
const at=(time:string)=>mock.timers.setTime(new Date(time).getTime())
const tick=async()=>{ const response=await GET(new Request('http://localhost/api/cron/sutra-auto',{headers:{authorization:'Bearer synthetic-local-cron-only'}})); return {code:response.status,...await response.json()} }
const daily=(id='noon',time='12:00')=>({id,name:id,is_active:true,frequency:'daily',time,timezone:'UTC',days:[]})
const configure=async(start='2026-11-06T00:00:00Z',schedules=[daily()])=>{
  const user=randomUUID();await sql('INSERT INTO auth.users VALUES($1)',[user]);await sql('INSERT INTO profiles VALUES($1)',[user])
  await sql('INSERT INTO sutra_auto_config(user_id,is_active,auto_publish,schedules) VALUES($1,true,false,$2)',[user,JSON.stringify(schedules)])
  await sql('UPDATE sutra_auto_config SET scheduler_cursor=$2 WHERE user_id=$1',[user,start]);return user
}
const jobs=async(user:string)=>(await sql('SELECT * FROM video_jobs WHERE user_id=$1 ORDER BY created_at,id',[user])).rows
const cursor=async(user:string)=>(await sql('SELECT scheduler_cursor FROM sutra_auto_config WHERE user_id=$1',[user])).rows[0].scheduler_cursor.toISOString()
const reserved=async(user:string)=>(await sql('SELECT coalesce(sum(reserved),0)::int AS n FROM video_quota_counters WHERE user_id=$1',[user])).rows[0].n
before(async()=>{
  const admin=new pg.Client({...options,database:'postgres'});await admin.connect()
  for(const role of ['anon','authenticated','service_role']) await admin.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role}; END IF; END $$`)
  await admin.query('CREATE DATABASE t03_scheduler');await admin.query('CREATE DATABASE t03_scheduler_restore');await admin.end()
  pool=new pg.Pool({...options,max:16})
  await sql(`CREATE SCHEMA sutra; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY);
    CREATE TABLE sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);`)
  for(const name of ['videos','activity_logs']) await sql(table(setupSchema,name))
  for(const name of ['sutra_auto_config','sutra_auto_videos']) await sql(table(source('migrations/sutra_auto.sql'),name))
  await sql(`CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    CREATE TRIGGER trg_auto_config_touch BEFORE UPDATE ON sutra_auto_config FOR EACH ROW EXECUTE FUNCTION touch_updated_at();`)
  for(const name of ['20261006_auto_occurrence_integrity.sql','v10_durable_jobs_quota.sql','v11_pipeline_checkpoints.sql','20261015_final_durable_integrity.sql','20261020_t03_auto_scheduler.sql']) await sql(source('migrations/'+name))
  await sql(`CREATE TABLE fixture_faults(kind text PRIMARY KEY);
    CREATE FUNCTION fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF TG_TABLE_NAME='sutra_auto_config' AND EXISTS(SELECT 1 FROM fixture_faults WHERE kind='skip_cursor') THEN RETURN NULL; END IF;
      IF EXISTS(SELECT 1 FROM fixture_faults WHERE kind=TG_TABLE_NAME) THEN RAISE EXCEPTION 'PRIVATE_SQL_FAILURE'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_cursor_failure BEFORE UPDATE OF scheduler_cursor ON sutra_auto_config FOR EACH ROW EXECUTE FUNCTION fixture_failure();
    CREATE TRIGGER fixture_job_failure BEFORE INSERT ON video_jobs FOR EACH ROW EXECUTE FUNCTION fixture_failure();
    GRANT USAGE ON SCHEMA sutra TO anon,authenticated,service_role; GRANT ALL ON ALL TABLES IN SCHEMA sutra TO service_role;
    GRANT SELECT,INSERT,UPDATE ON sutra_auto_config TO authenticated; GRANT SELECT ON fixture_faults TO authenticated;`)
  mock.timers.enable({apis:['Date'],now:new Date('2026-11-06T00:00:00Z')})
})
afterEach(async()=>{
  fault='';await sql('DELETE FROM fixture_faults')
  for(const row of (await sql("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows) assert.equal((await sql('SELECT cancel_video_job($1) AS ok',[row.idempotency_key])).rows[0].ok,true)
  await sql('UPDATE sutra_auto_config SET is_active=false WHERE is_active')
  assert.equal((await sql('SELECT coalesce(sum(reserved),0)::int AS n FROM video_quota_counters')).rows[0].n,0)
})
after(async()=>{
  mock.timers.reset()
  const budget=(await sql('SELECT coalesce(sum(reserved),0)::int AS reserved,coalesce(sum(completed),0)::int AS consumed,coalesce(sum(released),0)::int AS released FROM video_quota_counters')).rows[0]
  assert.equal(budget.reserved,0);assert.equal(publications,0)
  writeFileSync(join(process.env.T03_PROOF_DIR!,'recovery-settlement.json'),JSON.stringify({budget,submissions,providerCalls:0,publications},null,2)+'\n')
  await pool.end()
})

test('R107: the actual cron recovers noon after a 20-hour interruption',async()=>{
  const user=await configure();at('2026-11-06T00:00:00Z');assert.equal((await tick()).status,'ok')
  assert.equal((await jobs(user)).length,0);at('2026-11-06T20:00:00Z');assert.equal((await tick()).status,'ok')
  assert.equal((await jobs(user)).length,1);assert.equal(await reserved(user),1)
  assert.equal((await sql('SELECT scheduled_for FROM sutra_auto_videos WHERE user_id=$1',[user])).rows[0].scheduled_for.toISOString(),'2026-11-06T12:00:00.000Z')
})
test('12 concurrent cron deliveries reserve once; cancelled occurrences never resurrect',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z')
  const results=await Promise.all(Array.from({length:12},tick));assert.ok(results.some(r=>r.status==='ok'))
  const list=await jobs(user);assert.equal(list.length,1);assert.equal(await reserved(user),1)
  await sql('SELECT cancel_video_job($1)',[list[0].idempotency_key]);assert.equal(await reserved(user),0)
  await tick();assert.equal((await jobs(user)).length,1);assert.equal((await jobs(user))[0].status,'cancelled')
})
test('lost commit response reconciles from durable cursor without a second job or quota',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='lost'
  const first=await tick();assert.equal(first.status,'partial_failure');assert.ok(!JSON.stringify(first).includes('PRIVATE'))
  assert.equal((await jobs(user)).length,1);fault='';assert.equal((await tick()).status,'ok')
  assert.equal((await jobs(user)).length,1);assert.equal(await reserved(user),1)
})
test('invalid receipt never claims success; subsequent read reconciles its committed jobs',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='invalid';assert.equal((await tick()).status,'partial_failure')
  fault='';assert.equal((await tick()).status,'ok');assert.equal((await jobs(user)).length,1)
})
test('SQL job, cursor and quota errors roll back the entire window before retry',async()=>{
  for(const failure of ['video_jobs','sutra_auto_config','quota','before']) {
    const user=await configure('2026-11-06T00:00:00Z',[daily(),daily('second','13:00')]);at('2026-11-06T20:00:00Z')
    if(['quota','before'].includes(failure)) fault=failure;else await sql('INSERT INTO fixture_faults VALUES($1)',[failure])
    assert.equal((await tick()).status,'partial_failure');assert.equal((await jobs(user)).length,0);assert.equal(await reserved(user),0)
    assert.equal(await cursor(user),'2026-11-06T00:00:00.000Z');fault='';await sql('DELETE FROM fixture_faults')
    assert.equal((await tick()).status,'ok');assert.equal((await jobs(user)).length,2)
    await sql('UPDATE sutra_auto_config SET is_active=false WHERE user_id=$1',[user])
  }
})
test('read outage gives 503 and an inactive/edit race cannot submit a stale schedule',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='read';assert.equal((await tick()).code,503)
  fault='pause';assert.equal((await tick()).status,'partial_failure');assert.equal((await jobs(user)).length,0)
  fault='';const old=await cursor(user);await sql('UPDATE sutra_auto_config SET is_active=true,schedules=$2 WHERE user_id=$1',[user,JSON.stringify([daily('changed')])])
  assert.notEqual(await cursor(user),old)
})
test('bounded multi-day catch-up drains without missing a day and survives PostgreSQL restart',async()=>{
  const user=await configure('2026-11-01T00:00:00Z');at('2026-11-06T20:00:00Z')
  assert.equal((await tick()).status,'partial_failure');assert.equal((await jobs(user)).length,1)
  const saved=await cursor(user);await pool.end()
  const r=spawnSync(join(process.env.T03_PG_BIN!,'pg_ctl'),['-D',process.env.T03_PGDATA!,'-l',join(dirname(process.env.T03_PGDATA!),'restart.log'),'-m','fast','-w','restart'],{encoding:'utf8',timeout:30000})
  assert.equal(r.status,0);pool=new pg.Pool({...options,max:16});assert.equal(await cursor(user),saved)
  for(let i=0;i<5;i++) await tick()
  assert.equal((await jobs(user)).length,6);assert.equal((await tick()).status,'ok');assert.equal((await jobs(user)).length,6)
})
test('service-only RPC and owner cursor protection; wrong window, isolation and stale CAS fail closed',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');await tick()
  const p=lastParams!; const args=[user,p.p_from,p.p_through,p.p_updated_at,JSON.stringify(p.p_jobs),p.p_limit]
  const client=await pool.connect()
  try {
    await client.query('BEGIN; SET LOCAL ROLE authenticated')
    await assert.rejects(client.query('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6)',args),/permission denied/);await client.query('ROLLBACK')
    await client.query('BEGIN; SET LOCAL ROLE authenticated')
    await assert.rejects(client.query("UPDATE sutra_auto_config SET scheduler_cursor=now()-interval '1 year' WHERE user_id=$1",[user]),/CURSOR_FORBIDDEN/);await client.query('ROLLBACK')
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
    await assert.rejects(client.query('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6)',args),/SCHEDULER_ISOLATION/);await client.query('ROLLBACK')
    await assert.rejects(client.query('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6)',args),/SCHEDULE_CONFLICT/)
    await assert.rejects(client.query("SELECT schedule_auto_video_jobs($1,now(),now()+interval '25 hours',now(),'[]',1)",[user]),/INVALID_SCHEDULING_WINDOW/)
  } finally {await client.query('ROLLBACK');client.release()}
})
test('missing migration fails closed without falling back to the old lossy window',async()=>{
  const calls=submissions
  await assert.rejects(scheduleAutoWindow(wire as never, {user_id:randomUUID()} as never,{} as never,new Date()),/MIGRATION_REQUIRED/)
  assert.equal(submissions,calls)
})
test('migration replay, synthetic backup/restore, drift guard and rollback preserve all durable rows',async()=>{
  await configure();at('2026-11-06T20:00:00Z');await tick()
  const snapshot=async()=>JSON.stringify((await sql("SELECT (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM sutra_auto_config c) AS configs,(SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM video_jobs j) AS jobs,(SELECT jsonb_agg(to_jsonb(q) ORDER BY user_id) FROM video_quota_counters q) AS quota")).rows)
  const saved=await snapshot();await sql(source(migration));await sql(source(migration));assert.equal(await snapshot(),saved)
  const dump=join(process.env.T03_PROOF_DIR!,'synthetic-scheduler.dump')
  execFileSync(join(process.env.T03_PG_BIN!,'pg_dump'),['-Fc','-f',dump,'t03_scheduler'],{timeout:30000})
  execFileSync(join(process.env.T03_PG_BIN!,'pg_restore'),['--exit-on-error','-d','t03_scheduler_restore',dump],{timeout:30000})
  const restored=new pg.Client({...options,database:'t03_scheduler_restore'});await restored.connect()
  try {assert.deepEqual((await restored.query('SELECT id,status,progress FROM video_jobs ORDER BY id')).rows,(await sql('SELECT id,status,progress FROM video_jobs ORDER BY id')).rows)
    for(const row of (await restored.query("SELECT idempotency_key FROM video_jobs WHERE status IN ('queued','processing','reconciliation_required')")).rows) await restored.query('SELECT cancel_video_job($1)',[row.idempotency_key])
    assert.equal((await restored.query('SELECT coalesce(sum(reserved),0)::int n FROM video_quota_counters')).rows[0].n,0)
  }finally{await restored.end()}
  await sql(source(rollback));await sql(source(rollback));assert.equal(await snapshot(),saved)
  assert.equal((await sql("SELECT to_regprocedure('sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int)') AS f")).rows[0].f,null)
  await sql(source(migration));assert.equal(await snapshot(),saved)
  const client=await pool.connect()
  try {await client.query('BEGIN');await client.query("COMMENT ON FUNCTION schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int) IS 'foreign drift'")
    await assert.rejects(client.query(source(rollback)),/DEFINITION_DRIFT/)
  }finally{await client.query('ROLLBACK');client.release()}
  assert.equal(await snapshot(),saved)
})

test('suppressed SQL cursor update cannot return success or retain partial jobs',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');await sql("INSERT INTO fixture_faults VALUES('skip_cursor')")
  assert.equal((await tick()).status,'partial_failure');assert.equal((await jobs(user)).length,0);assert.equal(await reserved(user),0)
})
test('malformed legacy schedules cannot silently advance a calendar',async()=>{
  const user=await configure('2026-11-06T00:00:00Z',[daily('bad','99:00')]);at('2026-11-06T20:00:00Z')
  assert.equal((await tick()).status,'partial_failure');assert.equal(await cursor(user),'2026-11-06T00:00:00.000Z')
})
test('thrown transport exception is redacted and leaves the cursor retryable',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='throw';const result=await tick()
  assert.equal(result.status,'partial_failure');assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.equal((await jobs(user)).length,0)
})

test('service role runs the real scheduler RPC and partner migration/rollback leaves durable functions intact',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='before';await tick();fault=''
  const p=lastParams!,client=await pool.connect()
  try {await client.query('BEGIN; SET LOCAL ROLE service_role')
    const result=await client.query('SELECT schedule_auto_video_jobs($1,$2,$3,$4,$5,$6) AS r',[user,p.p_from,p.p_through,p.p_updated_at,JSON.stringify(p.p_jobs),p.p_limit])
    assert.equal(result.rows[0].r.jobs.length,1);await client.query('COMMIT')
  }finally{await client.query('ROLLBACK');client.release()}
  const definitions=async()=>(await sql("SELECT proname,pg_get_functiondef(oid) AS definition,proacl::text AS acl FROM pg_proc WHERE pronamespace='sutra'::regnamespace AND proname <> 'record_partner_scan' ORDER BY oid")).rows
  const before=await definitions(),list=await jobs(user)
  for(const name of ['partners','partner_scans']) await sql(table(source('migrations/audit_completion.sql'),name))
  await sql(source('migrations/20261019_partner_scan_atomic.sql'));await sql(source('migrations/20261019_partner_scan_atomic.sql'))
  await sql(source('migrations/20261019_partner_scan_atomic.rollback.sql'))
  assert.deepEqual(await definitions(),before);assert.deepEqual(await jobs(user),list)
})

test('corrupt job receipt status is not accepted as scheduling success',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');fault='status';assert.equal((await tick()).status,'partial_failure')
  fault='';await tick();assert.equal((await jobs(user)).length,1)
})

test('known reconciliation-required receipt is not an overall success',async()=>{
  await configure();at('2026-11-06T20:00:00Z');fault='reconciliation'
  assert.equal((await tick()).status,'partial_failure')
})


test('DST fold and adjoining catch-up windows produce one logical occurrence',async()=>{
  const user=await configure('2026-10-24T23:00:00Z',[{...daily('fold','02:30'),timezone:'Europe/Paris'}])
  at('2026-10-25T03:00:00Z');assert.equal((await tick()).status,'ok')
  const list=await jobs(user);assert.equal(list.length,1)
  assert.equal((await sql('SELECT scheduled_for FROM sutra_auto_videos WHERE user_id=$1',[user])).rows[0].scheduled_for.toISOString(),'2026-10-25T01:30:00.000Z')
  at('2026-10-25T05:00:00Z');await tick();assert.equal((await jobs(user)).length,1)
})
test('schedule edit and reactivation preserve materialised work and reset only the new calendar',async()=>{
  const user=await configure();at('2026-11-06T20:00:00Z');await tick()
  const previous=await jobs(user),oldCursor=await cursor(user)
  await sql('UPDATE sutra_auto_config SET schedules=$2 WHERE user_id=$1',[user,JSON.stringify([daily('replacement','17:00')])])
  assert.notEqual(await cursor(user),oldCursor);assert.deepEqual(await jobs(user),previous)
  await sql('UPDATE sutra_auto_config SET is_active=false WHERE user_id=$1',[user])
  const paused=(await sql('SELECT to_jsonb(scheduler_cursor) AS v FROM sutra_auto_config WHERE user_id=$1',[user])).rows[0].v
  await sql('UPDATE sutra_auto_config SET is_active=true WHERE user_id=$1',[user])
  assert.notEqual((await sql('SELECT to_jsonb(scheduler_cursor) AS v FROM sutra_auto_config WHERE user_id=$1',[user])).rows[0].v,paused);assert.deepEqual(await jobs(user),previous);assert.equal(await reserved(user),1)
})

test('owner RLS INSERT and DELETE/reinsert cannot choose past or future cursors',async()=>{
  const user=randomUUID();await sql('INSERT INTO auth.users VALUES($1)',[user]);await sql('INSERT INTO profiles VALUES($1)',[user])
  await sql(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated; GRANT DELETE ON sutra_auto_config TO authenticated;
    ALTER TABLE sutra_auto_config ENABLE ROW LEVEL SECURITY;
    CREATE POLICY auto_config_owner ON sutra_auto_config FOR ALL TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);`)
  const client=await pool.connect()
  try {
    for(const supplied of ['2000-01-01','2100-01-01']) {
      const lower=(await sql('SELECT clock_timestamp() AS t')).rows[0].t.getTime()
      await client.query('BEGIN; SET LOCAL ROLE authenticated')
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user])
      await client.query('DELETE FROM sutra_auto_config WHERE user_id=$1',[user])
      const result=await client.query('INSERT INTO sutra_auto_config(user_id,is_active,schedules,scheduler_cursor) VALUES($1,true,$2,$3) RETURNING scheduler_cursor',[user,JSON.stringify([daily()]),supplied])
      await client.query('COMMIT')
      const upper=(await sql('SELECT clock_timestamp() AS t')).rows[0].t.getTime()
      assert.ok(result.rows[0].scheduler_cursor.getTime()>=lower && result.rows[0].scheduler_cursor.getTime()<=upper)
    }
    await client.query('BEGIN; SET LOCAL ROLE authenticated')
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[randomUUID()])
    assert.equal((await client.query('DELETE FROM sutra_auto_config WHERE user_id=$1',[user])).rowCount,0)
    await assert.rejects(client.query('INSERT INTO sutra_auto_config(user_id) VALUES($1)',[user]),/row-level security/)
  }finally{await client.query('ROLLBACK');client.release()}
})
