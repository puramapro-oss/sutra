// Real PostgreSQL concurrency on a unique, local-only database; no remote URL accepted.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { userInfo } from 'node:os'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const database = `sutra_t03_${process.pid}_${Date.now()}`
const host = process.env.PGHOST
const port = Number(process.env.PGPORT)
if (!['127.0.0.1', '::1', 'localhost'].includes(host ?? '') || !Number.isInteger(port) || port < 1 || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('Explicit disposable loopback PostgreSQL required')
const options = { host, port, user: process.env.PGUSER || userInfo().username, password: process.env.PGPASSWORD, database }
let pool: pg.Pool
const query = (sql: string, params?: unknown[]) => pool.query(sql, params)
before(async () => {
  const admin = new pg.Client({ ...options, database: 'postgres' }); await admin.connect()
  await admin.query(`CREATE DATABASE ${database}`); await admin.end()
  pool = new pg.Pool({ ...options, max: 12, options: '-c search_path=sutra,public' })
  await query(`CREATE SCHEMA sutra;
    CREATE TABLE sutra.videos(id uuid PRIMARY KEY, user_id uuid, status text, created_at timestamptz DEFAULT now(), video_url text, title text);
    CREATE TABLE sutra.sutra_auto_videos(id uuid PRIMARY KEY, user_id uuid, status text, video_final_url text, video_raw_url text, title text, theme_id uuid, ai_reasoning text);
    CREATE TABLE sutra.sutra_auto_themes(id uuid PRIMARY KEY,user_id uuid,times_used int DEFAULT 0,last_used_at timestamptz);
    CREATE TABLE sutra.sutra_auto_memory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,memory_type text,content text,importance numeric,related_video_id uuid);
    CREATE TABLE sutra.user_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,type text,title text,message text);`)
  await query(readFileSync(new URL('../migrations/v10_durable_jobs_quota.sql', import.meta.url), 'utf8'))
  await query(readFileSync(new URL('../migrations/v11_pipeline_checkpoints.sql', import.meta.url), 'utf8'))
  await query(readFileSync(new URL('../migrations/20261014_durable_checkpoint_integrity.sql', import.meta.url), 'utf8'))
})
after(async () => { await pool?.end(); process.stdout.write(`LOCAL_TEST_DATABASE=${database}\n`) })
const proof = (url = 'https://final.invalid/final.mp4') => ({ url, outputVerified: true, duration: 6, outputSize: { width: 720,height:1280 },
  verification: { url, sha256: 'a'.repeat(64), duration: 6, width: 720, height: 1280, fps: 30, hasAudio: true } })
const stages = () => ({
  'stage:script': {status:'complete',value:{narration:'voice',music_style:'cinematic'}},
  'stage:scenes': {status:'complete',value:[{url:'https://raw.invalid/raw.mp4'}]},
  'stage:images': {status:'skipped',value:[]}, 'stage:voice': {status:'complete',value:'voice.mp3'},
  'stage:music': {status:'complete',value:'music.mp3'},'stage:subtitles':{status:'complete',value:[]},
  'stage:composition':{status:'complete',value:{id:'render'}},'stage:export':{status:'complete',value:proof()},
  'stage:publication':{status:'pending',value:{}},
})
async function job(kind = 'production', worker: string | null = 'w', config: Record<string, unknown> = {}) {
  const id=randomUUID(), user=randomUUID(), video=randomUUID()
  await query('SELECT reserve_video_quota($1,0)',[user])
  const input={userId:user,videoRowId:video,musicStyle:'cinematic',config}
  await query(`INSERT INTO video_jobs(id,user_id,kind,video_id,payload,idempotency_key,status,locked_by,lease_until,attempts)
    VALUES($1::uuid,$2,$3,$4,$5,$1::text,$6,$7,now()+interval '5 minutes',$8)`,[id,user,kind,kind==='export'||kind==='create'?video:null,{input},worker?'processing':'queued',worker,worker?1:0])
  return {id,user,video}
}
const checkpoint = (id:string, worker:string, steps:unknown) => query('SELECT checkpoint_video_job_v2($1,$2,$3,\'{}\')',[id,worker,{steps}])
const persist = (id:string, video:string, values:unknown, table='videos', worker='w', insert=false) => query('SELECT persist_video_job_video($1,$2,$3,$4,$5,$6)',[id,worker,table,video,values,insert])

test('12 concurrent claims obtain one owner; 24 independent checkpoints survive parallel writes',async()=>{
 const j=await job('production',null)
 const claims=await Promise.all(Array.from({length:12},(_,i)=>query('SELECT * FROM claim_video_job_by_key($1,$2,600)',[j.id,`w${i}`])))
 const owners=claims.flatMap(r=>r.rows); assert.equal(owners.length,1)
 await Promise.all(Array.from({length:24},(_,i)=>checkpoint(j.id,owners[0].locked_by,{[`scene:${i}`]:{url:`clip${i}`}})))
 const {rows}=await query('SELECT progress FROM video_jobs WHERE id=$1',[j.id]); assert.equal(Object.keys(rows[0].progress.steps).length,24)
})

test('expired/replaced/cancelled owner cannot heartbeat, checkpoint, finish or write business output',async()=>{
 const j=await job('create'); await query('INSERT INTO videos(id,user_id,status) VALUES($1,$2,\'generating\')',[j.video,j.user])
 await query("UPDATE video_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[j.id])
 const operations=()=>[
  ()=>query('SELECT heartbeat_video_job_v2($1,\'w\',600)',[j.id]),()=>checkpoint(j.id,'w',{paid:true}),
  ()=>query("SELECT finish_video_job($1,'w','queued')",[j.id]),()=>persist(j.id,j.video,{title:'stale'}),
  ()=>query("SELECT record_video_job_event($1,'w','user_notifications','ready',$2)",[j.id,{user_id:j.user,type:'success',title:'stale'}])]
 for(const operation of operations()) await assert.rejects(operation,/LEASE_LOST/)
 await query("SELECT * FROM claim_video_job_by_key($1,'new',600)",[j.id])
 for(const operation of operations()) await assert.rejects(operation,/LEASE_LOST/)
 await query('SELECT cancel_video_job($1)',[j.id])
 await assert.rejects(()=>checkpoint(j.id,'new',{late:true}),/LEASE_LOST/)
 assert.equal((await query('SELECT title FROM videos WHERE id=$1',[j.video])).rows[0].title,null)
})

test('ready refuses raw URL, missing proof, missing stage and mandatory audio; verified export persists',async()=>{
 const j=await job(); const write=()=>persist(j.id,j.id,{user_id:j.user,status:'ready',video_url:proof().url},'videos','w',true)
 await assert.rejects(write,/PROOF_REQUIRED/)
 const s=stages()
 for (const [delta,url,error] of [
  [{'stage:export':{status:'complete',value:proof('https://raw.invalid/raw.mp4')}},'https://raw.invalid/raw.mp4',/RAW_MEDIA/],
  [{'stage:voice':{status:'skipped',value:null}},proof().url,/TRACK_MISSING/],
  [{'stage:export':{status:'complete',value:{...proof(),verification:{...proof().verification,hasAudio:false}}}},proof().url,/TRACK_MISSING/],
 ] as [Record<string,unknown>,string,RegExp][]) {
  const invalid=await job(); await checkpoint(invalid.id,'w',{...stages(),...delta})
  await assert.rejects(()=>persist(invalid.id,invalid.id,{user_id:invalid.user,status:'ready',video_url:url},'videos','w',true),error)
 }
 const missing=await job(); const incomplete:Record<string,unknown>=stages(); delete incomplete['stage:subtitles']
 await checkpoint(missing.id,'w',incomplete)
 await assert.rejects(()=>persist(missing.id,missing.id,{user_id:missing.user,status:'ready',video_url:proof().url},'videos','w',true),/STAGE_CHECKPOINT/)
 await checkpoint(j.id,'w',s); await write(); await write()
 assert.equal((await query('SELECT count(*)::int n FROM videos WHERE id=$1',[j.id])).rows[0].n,1)
 await query("UPDATE videos SET status='published' WHERE id=$1",[j.id]); await write()
 assert.equal((await query('SELECT status FROM videos WHERE id=$1',[j.id])).rows[0].status,'published')
})

test('AUTO ready effects are atomic and once-only across concurrent replays',async()=>{
 const j=await job('auto','w',{default_voice_enabled:true,default_music_genre:'cinematic'}); const theme=randomUUID()
 await query('INSERT INTO sutra_auto_themes(id,user_id) VALUES($1,$2)',[theme,j.user])
 await query("INSERT INTO sutra_auto_videos(id,user_id,status) VALUES($1,$2,'planning')",[j.video,j.user])
 await checkpoint(j.id,'w',stages())
 const values={status:'ready',video_final_url:proof().url,video_raw_url:'https://raw.invalid/raw.mp4',theme_id:theme,title:'film',ai_reasoning:'test'}
 await Promise.all(Array.from({length:8},()=>persist(j.id,j.video,values,'sutra_auto_videos')))
 assert.equal((await query('SELECT times_used FROM sutra_auto_themes WHERE id=$1',[theme])).rows[0].times_used,1)
 assert.equal((await query('SELECT count(*)::int n FROM sutra_auto_memory WHERE related_video_id=$1',[j.video])).rows[0].n,1)
 await query("UPDATE sutra_auto_videos SET status='published' WHERE id=$1",[j.video]); await persist(j.id,j.video,values,'sutra_auto_videos')
 assert.equal((await query('SELECT status FROM sutra_auto_videos WHERE id=$1',[j.video])).rows[0].status,'published')
})

test('finish requires result, settles once; missing quota rolls back status; exhausted jobs quarantine',async()=>{
 const j=await job()
 await assert.rejects(()=>query("SELECT finish_video_job($1,'w','done')",[j.id]),/RESULT_CHECKPOINT/)
 await query("UPDATE video_jobs SET progress=progress||'{\"result\":{\"ok\":true}}' WHERE id=$1",[j.id])
 const outcomes=await Promise.allSettled([query("SELECT finish_video_job($1,'w','done')",[j.id]),query("SELECT finish_video_job($1,'w','done')",[j.id])])
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1)
 assert.equal((await query('SELECT completed FROM video_quota_counters WHERE user_id=$1',[j.user])).rows[0].completed,1)
 const missing=await job(); await query('DELETE FROM video_quota_counters WHERE user_id=$1',[missing.user])
 await assert.rejects(()=>query("SELECT finish_video_job($1,'w','failed')",[missing.id]),/QUOTA_RECONCILIATION/)
 assert.equal((await query('SELECT status FROM video_jobs WHERE id=$1',[missing.id])).rows[0].status,'processing')
 await query("UPDATE video_jobs SET attempts=max_attempts,lease_until=now()-interval '1 second' WHERE id=$1",[missing.id])
 await query("SELECT * FROM claim_video_jobs('next',10,600)")
 assert.equal((await query('SELECT status FROM video_jobs WHERE id=$1',[missing.id])).rows[0].status,'reconciliation_required')
})

test('notification writes deduplicate atomically; owner mismatch and missing row refuse success',async()=>{
 const j=await job('create'); const event={user_id:j.user,type:'success',title:'ready',message:'done'}
 await Promise.all(Array.from({length:10},()=>query("SELECT record_video_job_event($1,'w','user_notifications','ready',$2)",[j.id,event])))
 assert.equal((await query('SELECT count(*)::int n FROM user_notifications WHERE user_id=$1',[j.user])).rows[0].n,1)
 await assert.rejects(()=>persist(j.id,j.video,{title:'missing'}),/PERSISTENCE_FAILED/)
 await query('INSERT INTO videos(id,user_id,status) VALUES($1,$2,\'generating\')',[j.video,randomUUID()])
 await assert.rejects(()=>persist(j.id,j.video,{title:'foreign'}),/OWNER_MISMATCH/)
})

const submit = (user:string,key:string,hash='a'.repeat(64),video=randomUUID(),initial:object={}) => query(
 'SELECT * FROM submit_video_job($1,\'create\',$2,$3,$4,$5,1,$6)', [user,video,{input:{userId:user,videoId:video}},key,hash,initial])
test('12 same-intent submissions atomically create one job, one video and one quota reservation',async()=>{
 const user=randomUUID(),key=randomUUID()
 const results=await Promise.all(Array.from({length:12},()=>submit(user,key)))
 assert.equal(new Set(results.map(r=>r.rows[0].id)).size,1)
 assert.equal(new Set(results.map(r=>r.rows[0].video_id)).size,1)
 assert.equal((await query('SELECT count(*)::int n FROM videos WHERE user_id=$1',[user])).rows[0].n,1)
 assert.equal((await query('SELECT reserved FROM video_quota_counters WHERE user_id=$1',[user])).rows[0].reserved,1)
 await assert.rejects(()=>submit(user,key,'b'.repeat(64)),/IDEMPOTENCY_CONFLICT/)
 await assert.rejects(()=>submit(randomUUID(),key),/IDEMPOTENCY_CONFLICT/)
 await assert.rejects(()=>submit(user,randomUUID()),/QUOTA_EXHAUSTED/)
 assert.equal((await query('SELECT count(*)::int n FROM video_jobs WHERE user_id=$1',[user])).rows[0].n,1)
})
test('failed initial video insert rolls back quota and task; retry after lost response reuses committed task',async()=>{
 const user=randomUUID(),key=randomUUID(),video=randomUUID()
 await query("INSERT INTO videos(id,user_id,status) VALUES($1,$2,'ready')",[video,randomUUID()])
 await assert.rejects(()=>submit(user,key,'a'.repeat(64),video),/duplicate key/)
 assert.equal((await query('SELECT count(*)::int n FROM video_quota_counters WHERE user_id=$1',[user])).rows[0].n,0)
 assert.equal((await query('SELECT count(*)::int n FROM video_jobs WHERE user_id=$1',[user])).rows[0].n,0)
 await submit(user,key) // Committed response deliberately discarded.
 const retry=await submit(user,key)
 assert.equal(retry.rows[0].status,'queued')
 assert.equal((await query('SELECT reserved FROM video_quota_counters WHERE user_id=$1',[user])).rows[0].reserved,1)
})
test('cancellation settles original month once and never consumes a new month reservation',async()=>{
 const j=await job()
 await query("UPDATE video_jobs SET created_at=date_trunc('month',now())-interval '1 day' WHERE id=$1",[j.id])
 await query("UPDATE video_quota_counters SET period_start=(date_trunc('month',now())-interval '1 month')::date WHERE user_id=$1",[j.user])
 await query('SELECT reserve_video_quota($1,0)',[j.user])
 assert.equal((await query('SELECT cancel_video_job($1) ok',[j.id])).rows[0].ok,true)
 assert.equal((await query('SELECT cancel_video_job($1) ok',[j.id])).rows[0].ok,false)
 const rows=(await query('SELECT reserved,released FROM video_quota_counters WHERE user_id=$1 ORDER BY period_start',[j.user])).rows
 assert.deepEqual(rows,[{reserved:0,released:1},{reserved:1,released:0}])
})

test('NULL lease or owner cannot authorize any mutation, even with a matching worker', async () => {
  for (const absent of ['lease_until', 'locked_by']) {
    const j = await job('create')
    await query("INSERT INTO videos(id,user_id,status) VALUES($1,$2,'generating')", [j.video,j.user])
    await query(`UPDATE video_jobs SET ${absent}=NULL WHERE id=$1`, [j.id])
    const worker = absent === 'locked_by' ? null : 'w'
    for (const [sql, params] of [
      ['SELECT heartbeat_video_job_v2($1,$2,600)', [j.id,worker]],
      ["SELECT checkpoint_video_job_v2($1,$2,'{}','{}')", [j.id,worker]],
      ["SELECT finish_video_job($1,$2,'failed')", [j.id,worker]],
      ["SELECT persist_video_job_video($1,$2,'videos',$3,$4,false)", [j.id,worker,j.video,{title:'invalid'}]],
      ["SELECT record_video_job_event($1,$2,'user_notifications','ready',$3)", [j.id,worker,{user_id:j.user,type:'success',title:'invalid'}]],
    ] as [string,unknown[]][]) await assert.rejects(() => query(sql,params), /LEASE_LOST/)
    assert.equal((await query('SELECT status FROM video_jobs WHERE id=$1',[j.id])).rows[0].status, 'processing')
    assert.equal((await query('SELECT title FROM videos WHERE id=$1',[j.video])).rows[0].title, null)
    assert.equal((await query('SELECT reserved FROM video_quota_counters WHERE user_id=$1',[j.user])).rows[0].reserved, 1)
  }
})

test('ready refuses unfinished checkpoints, invalid track values and zero-size export', async () => {
  const rejectInvalid = async (delta:Record<string,unknown>, error:RegExp, url=proof().url) => {
    const j=await job()
    await checkpoint(j.id,'w',{...stages(),...delta})
    await assert.rejects(()=>persist(j.id,j.id,{user_id:j.user,status:'ready',video_url:url},'videos','w',true),error)
    assert.equal((await query('SELECT count(*)::int n FROM videos WHERE id=$1',[j.id])).rows[0].n,0)
  }
  for (const stage of ['scenes','composition','export','voice','music']) {
    for (const status of ['pending','skipped',null]) {
      await rejectInvalid({[`stage:${stage}`]:{ ...stages()[`stage:${stage}` as keyof ReturnType<typeof stages>], status }},/STAGE_CHECKPOINT|TRACK_MISSING/)
    }
  }
  for (const value of ['   ', '\t\n', 'null', {}, [], false, 42]) {
    await rejectInvalid({'stage:voice':{status:'complete',value}},/TRACK_MISSING/)
  }
  const zero = { ...proof(), outputSize: {width:0,height:0}, verification: {...proof().verification,width:0,height:0} }
  await rejectInvalid({'stage:export':{status:'complete',value:zero}},/PROOF_REQUIRED/)
  for (const invalid of [
    {...proof(),url:' ',verification:{...proof().verification,url:' '}},
    {...proof(),duration:0,verification:{...proof().verification,duration:0.05}},
    {...proof(),verification:{...proof().verification,fps:'Infinity'}},
    {...proof(),verification:{...proof().verification,duration:'1'}},
    {...proof(),outputSize:{width:'720',height:'1280'}},
  ]) {
    await rejectInvalid({'stage:export':{status:'complete',value:invalid}},/PROOF_REQUIRED/,invalid.url)
  }
})

test('silent export can skip optional tracks, but cannot skip scenes or use string validation flags', async () => {
  const j = await job()
  await query("UPDATE video_jobs SET payload=jsonb_set(payload,'{input,musicStyle}','\"none\"') WHERE id=$1", [j.id])
  const s = { ...stages(),
    'stage:script': {status:'complete',value:{narration:'',music_style:'none'}},
    'stage:voice': {status:'skipped',value:null}, 'stage:music': {status:'skipped',value:null},
    'stage:export': {status:'complete',value:{...proof(),verification:{...proof().verification,hasAudio:false}}},
  }
  const write = () => persist(j.id,j.id,{user_id:j.user,status:'ready',video_url:proof().url},'videos','w',true)
  for (const value of [null, [], 'raw']) {
    const invalid=await job()
    await query("UPDATE video_jobs SET payload=jsonb_set(payload,'{input,musicStyle}','\"none\"') WHERE id=$1",[invalid.id])
    await checkpoint(invalid.id,'w',{...s,'stage:scenes':{status:'complete',value}})
    await assert.rejects(()=>persist(invalid.id,invalid.id,{user_id:invalid.user,status:'ready',video_url:proof().url},'videos','w',true),/STAGE_CHECKPOINT/)
  }
  const invalid=await job()
  await query("UPDATE video_jobs SET payload=jsonb_set(payload,'{input,musicStyle}','\"none\"') WHERE id=$1",[invalid.id])
  await checkpoint(invalid.id,'w',{...s,'stage:export':{status:'complete',value:{...s['stage:export'].value,outputVerified:'true'}}})
  await assert.rejects(()=>persist(invalid.id,invalid.id,{user_id:invalid.user,status:'ready',video_url:proof().url},'videos','w',true),/PROOF_REQUIRED/)
  await checkpoint(j.id,'w',s)
  await write()
  assert.equal((await query('SELECT status FROM videos WHERE id=$1',[j.id])).rows[0].status,'ready')
})

test('remote journal preserves acquired legacy identity while allowing status updates', async () => {
 const j=await job(); const key='scene:0:ltx'
 const first={endpoint:'/text-to-video',fingerprint:'a'.repeat(64),started:true,id:'remote-a',status:'pending'}
 await checkpoint(j.id,'w',{[key]:first})
 for(const patch of [{id:'remote-b'},{id:null},{endpoint:'/other'},{fingerprint:'b'.repeat(64)},{started:false},{v2:{version:2}}]) {
  await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...first,...patch}}),/CHECKPOINT_CONFLICT/)
 }
 const next={...first,status:'completed'}
 await checkpoint(j.id,'w',{[key]:next});await checkpoint(j.id,'w',{[key]:next})
 assert.deepEqual((await query('SELECT progress FROM video_jobs WHERE id=$1',[j.id])).rows[0].progress.steps[key],next)
})

test('LTX v2 permits first ID and sequential revisions, rejects identity replacement and revision rollback', async () => {
 const j=await job(); const key='asset:video:ltx'
 const nested={version:2,provider:'ltx',key:'operation',endpoint:'text-to-video',fingerprint:'a'.repeat(64),model:'ltx',id:null as string|null,revision:0,state:'submitting'}
 const first={endpoint:'/text-to-video',fingerprint:nested.fingerprint,started:true,v2:nested}
 await checkpoint(j.id,'w',{[key]:first})
 const accepted={...first,id:'remote-a',v2:{...nested,id:'remote-a',revision:1,state:'accepted'}}
 await checkpoint(j.id,'w',{[key]:accepted});await checkpoint(j.id,'w',{[key]:accepted})
 for(const field of ['version','provider','key','endpoint','fingerprint','model','id']) {
  await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...accepted,v2:{...accepted.v2,revision:2,[field]:'replacement'}}}),/CHECKPOINT_CONFLICT/)
 }
 for(const revision of [0,1,3,'2',null]) {
  await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...accepted,v2:{...accepted.v2,revision,state:'completed'}}}),/CHECKPOINT_CONFLICT/)
 }
 await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...accepted,id:'different',v2:{...accepted.v2,revision:2}}}),/CHECKPOINT_CONFLICT/)
 const complete={...accepted,v2:{...accepted.v2,revision:2,state:'completed',output:{url:'https://fixture.invalid/final.mp4'}}}
 await checkpoint(j.id,'w',{[key]:complete})
 assert.deepEqual((await query('SELECT progress FROM video_jobs WHERE id=$1',[j.id])).rows[0].progress.steps[key],complete)
})

test('Salad journal preserves scope, qualification and budget while allowing recovery and artifact result', async () => {
 const j=await job(); const key='scene:2:ltx'
 const salad={protocol:'sutra-salad-v1',provider:'salad',model:'model',id:'a'.repeat(64),scope:'b'.repeat(64),fingerprint:'c'.repeat(64),qualificationId:'qualified',quoteEvidenceSha256:'d'.repeat(64),timeoutMs:600000,estimatedComputeUsd:0.02,revision:0,status:'submitting',artifact:null as null|object}
 const first={endpoint:'/salad/jobs',fingerprint:salad.fingerprint,started:true,id:salad.id,salad}
 await checkpoint(j.id,'w',{[key]:first})
 for(const field of ['protocol','provider','model','id','scope','fingerprint','qualificationId','quoteEvidenceSha256','timeoutMs','estimatedComputeUsd']) {
  await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...first,salad:{...salad,revision:1,[field]:'replacement'}}}),/CHECKPOINT_CONFLICT/)
 }
 await assert.rejects(()=>checkpoint(j.id,'w',{[key]:{...first,salad:null}}),/CHECKPOINT_CONFLICT/)
 const unknown={...first,salad:{...salad,revision:1,status:'unknown'}}
 await checkpoint(j.id,'w',{[key]:unknown})
 const completed={...first,salad:{...salad,revision:2,status:'succeeded',artifact:{key:salad.id,sha256:'e'.repeat(64),bytes:128}}}
 await checkpoint(j.id,'w',{[key]:completed});await checkpoint(j.id,'w',{[key]:completed})
 assert.deepEqual((await query('SELECT progress FROM video_jobs WHERE id=$1',[j.id])).rows[0].progress.steps[key],completed)
})

test('provider ID map is append-only; malformed JSON and overwrites leave original receipt intact', async () => {
 const j=await job()
 await query("SELECT checkpoint_video_job_v2($1,'w','{}',$2)",[j.id,{render:'remote-a'}])
 for(const ids of [{render:'remote-b'},{render:null},[],true,'bad']) {
  await assert.rejects(()=>query("SELECT checkpoint_video_job_v2($1,'w','{}',$2)",[j.id,JSON.stringify(ids)]),/CHECKPOINT_CONFLICT|INVALID_CHECKPOINT/)
 }
 await query("SELECT checkpoint_video_job_v2($1,'w','{}',$2)",[j.id,{render:'remote-a',voice:'voice-a'}])
 assert.deepEqual((await query('SELECT provider_job_ids FROM video_jobs WHERE id=$1',[j.id])).rows[0].provider_job_ids,{render:'remote-a',voice:'voice-a'})
})
