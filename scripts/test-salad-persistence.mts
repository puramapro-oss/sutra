// Real PostgreSQL races on a private loopback-only disposable DB; no model or provider.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { userInfo } from 'node:os'
import { createSaladPersistence } from '../src/lib/salad-persistence.ts'
import { createSaladWorker } from '../src/lib/salad/worker.ts'
import { MODEL, identity, type Job } from '../src/lib/salad/contracts.ts'

const host = process.env.PGHOST, port = Number(process.env.PGPORT)
if (!['127.0.0.1', '::1'].includes(host ?? '') || !port || process.env.SUTRA_DISPOSABLE_DB !== '1') throw new Error('Disposable loopback PostgreSQL required')
const database = `sutra_ci_salad_${process.pid}_${Date.now()}`
const options = { host, port, user: process.env.PGUSER || userInfo().username, password: process.env.PGPASSWORD, database }
let pool: pg.Pool
let counter = 0
const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
const job = (): Job => ({ protocol: 'sutra-salad-worker/1', id: digest(`id${++counter}`), scope: digest('owner'), fingerprint: digest(`input${counter}`),
 revision: 0, status: 'running', submittedAt: 1000, reconcileAfter: 1001, provider: 'salad', model: 'ltxv-13b-0.9.8-distilled-fp8',
 qualificationId: 'synthetic', estimatedComputeUsd: 0.001, actualUsd: null,
 costBasis: 'approved-hourly-quote-times-timeout-excludes-idle-storage-network', quoteEvidenceSha256: digest('quote'), quotaRemaining: null,
 timeoutMs: 1000, lastHttpStatus: null, artifact: null as null | {key: string; sha256: string; bytes: number} })
const rpc = async (fn: string, args: unknown[]) => (await pool.query(`SELECT salad_worker.${fn}(${args.map((_,i)=>`$${i+1}`).join(',')}) value`, args)).rows[0].value
before(async () => {
 const admin = new pg.Client({ ...options, database: 'postgres' }); await admin.connect()
 await admin.query(`CREATE DATABASE ${database}`); await admin.end()
 pool = new pg.Pool({ ...options, max: 24 })
 await pool.query('CREATE ROLE sutra_salad_worker NOLOGIN')
 const migration = readFileSync(new URL('../migrations/20261014_salad_worker_journal.sql', import.meta.url),'utf8')
 await pool.query(migration); await pool.query(migration) // Idempotent local preparation.
})
after(async () => { await pool?.end(); process.stdout.write(`PRIVATE_DATABASE_PRESERVED=${database}\n`) })
async function reset() { await pool.query('TRUNCATE salad_worker.artifacts,salad_worker.jobs') }

test('24 independent sessions reserve one execution; replay and foreign input fail closed', async () => {
 await reset(); const j = job()
 const receipts = await Promise.all(Array.from({length:24},()=>rpc('reserve_job',[j])))
 assert.equal(receipts.filter(x=>x==='created').length,1); assert.equal(receipts.filter(x=>x==='existing').length,23)
 await assert.rejects(()=>rpc('reserve_job',[{...j,fingerprint:digest('foreign')}]),/IDEMPOTENCY_CONFLICT/)
 assert.equal(await rpc('reserve_job',[job()]),'busy')
})
test('distinct jobs race for one global slot, including UNKNOWN after deadline', async () => {
 await reset(); const jobs = Array.from({length:24},job)
 const receipts = await Promise.all(jobs.map(j=>rpc('reserve_job',[j])))
 assert.equal(receipts.filter(x=>x==='created').length,1)
 const winner = jobs[receipts.indexOf('created')], unknown = {...winner, status:'unknown',revision:1}
 assert.equal(await rpc('compare_job',[winner,unknown]),true)
 await pool.end(); pool = new pg.Pool({...options,max:24}) // new process connection state, DB survives.
 assert.deepEqual(await rpc('load_job',[winner.id]),unknown)
 assert.deepEqual(await rpc('load_job',[null]),unknown, 'health must observe the permanent slot after restart')
 assert.equal(await rpc('reserve_job',[job()]),'busy')
 assert.equal(await rpc('reserve_job',[winner]),'existing')
})
test('lost acknowledgment and stale complete-record CAS cannot erase a committed checkpoint', async () => {
 await reset(); const j=job(); await rpc('reserve_job',[j]) // deliberately discard reserve acknowledgment
 assert.equal(await rpc('reserve_job',[j]),'existing')
 const n={...j,status:'unknown',revision:1}
 const results=await Promise.all(Array.from({length:12},()=>rpc('compare_job',[j,n])))
 assert.equal(results.filter(Boolean).length,1)
 assert.equal(await rpc('compare_job',[j,n]),false)
 await assert.rejects(()=>rpc('compare_job',[n,{...n,scope:digest('foreign'),revision:2}]),/INVALID_TRANSITION/)
 await assert.rejects(()=>rpc('compare_job',[n,{...n,status:'rejected',revision:2}]),/INVALID_TRANSITION/)
})
test('only an immutable hash-verified external artifact releases the slot', async () => {
 await reset(); const j=job(), bytes=Buffer.from('CPU-only synthetic artifact'), hash=digest(bytes)
 await rpc('reserve_job',[j])
 const n={...j,status:'succeeded',revision:1,artifact:{key:j.id,sha256:hash,bytes:bytes.length}}
 await assert.rejects(()=>rpc('compare_job',[j,n]),/DURABLE_ARTIFACT_REQUIRED/)
 await assert.rejects(()=>rpc('put_artifact',[j.id,bytes,digest('wrong')]),/INVALID_ARTIFACT/)
 assert.equal(await rpc('put_artifact',[j.id,bytes,hash]),true)
 assert.equal(await rpc('put_artifact',[j.id,bytes,hash]),true)
 const different=Buffer.from('other'); await assert.rejects(()=>rpc('put_artifact',[j.id,different,digest(different)]),/ARTIFACT_CONFLICT/)
 assert.equal(await rpc('compare_job',[j,n]),true)
 assert.equal(await rpc('load_job',[null]),null, 'verified persisted completion is the only automatic release')
 assert.deepEqual(await rpc('get_artifact',[j.id]),bytes)
 assert.equal(await rpc('reserve_job',[job()]),'created')
 assert.equal(await rpc('reserve_job',[j]),'existing') // completed job never executes twice
})
test('restricted role has only five functions, no table mutation or other application access', async () => {
 const client=await pool.connect()
 try {
  await client.query('CREATE SCHEMA IF NOT EXISTS app_private; CREATE TABLE IF NOT EXISTS app_private.fixture(id int)')
  await client.query('SET ROLE sutra_salad_worker')
  assert.equal((await client.query('SELECT salad_worker.load_job($1) value',[digest('absent')])).rows[0].value,null)
  for(const sql of ['SELECT * FROM salad_worker.jobs','DELETE FROM salad_worker.jobs','SELECT * FROM salad_worker.artifacts','SELECT * FROM app_private.fixture']) await assert.rejects(()=>client.query(sql),/permission denied/)
 } finally { await client.query('RESET ROLE'); client.release() }
 const publicGrants=await pool.query(`SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='salad_worker' AND a.grantee=0 AND a.privilege_type='EXECUTE'`)
 assert.equal(publicGrants.rows[0].n,0)
})

test('actual PostgreSQL adapter survives reconnect and expunges persistence failure details', async () => {
 await reset()
 const store=createSaladPersistence(pool), j=job()
 assert.equal(await store.journal.readActive(),null)
 assert.equal(await store.journal.load(j.id),null)
 assert.equal(await store.journal.reserve(j),'created')
 assert.equal(await store.journal.reserve(j),'existing')
 const unknown: Job={...j,status:'unknown',revision:1}
 assert.equal(await store.journal.compareAndSet(j,unknown),true)
 await pool.end(); pool=new pg.Pool({...options,max:24})
 assert.deepEqual(await createSaladPersistence(pool).journal.load(j.id),unknown)
 assert.deepEqual(await createSaladPersistence(pool).journal.readActive(),unknown)
 const failing=createSaladPersistence({query:async()=>{throw new Error('PRIVATE_CONNECTION_DETAILS')}})
 await assert.rejects(()=>failing.journal.load(j.id),{message:'SALAD_PERSISTENCE_UNCERTAIN'})
})

test('actual worker with external PostgreSQL executes once, survives restart and downloads immutable bytes', async () => {
 await reset(); const now=Date.now(), hash=digest('fixture'), bytes=Buffer.from('CPU fixture: persistence proof, not real video')
 const input={prompt:'synthetic',profile:{width:256,height:256,num_frames:9,fps:16}}
 const qualification={id:'fixture',evidenceSha256:hash,verifiedAt:now-1,
  image:`fixture/worker@sha256:${hash}`,architecture:'linux/amd64',cuda:'12.4',gpu:'FIXTURE',vramMiB:24576,requiredFreeVramMiB:1,
  model:MODEL,modelSha256:hash,encoderSha256:hash,vaeSha256:hash,profiles:[input.profile]}
 const config={enabled:true,gatewayUrl:'https://fixture.salad.cloud',gatewayApiKey:'fixture-gateway-'.repeat(3),workerToken:'fixture-worker-'.repeat(3),
  requestTimeoutMs:1000,generationTimeoutMs:1000,qualification,
  quote:{currency:'USD',hourlyRate:1,observedAt:now-1,expiresAt:now+60000,source:'salad-approved-quote',evidenceSha256:hash}}
 const row={...identity('owner:org','operation',input,'fixture'),input,qualificationId:'fixture',maxEstimatedComputeUsd:1}
 let computes=0
 const ports=()=>({...createSaladPersistence(pool),
  inspect:async()=>({platform:'linux',architecture:'x64',image:qualification.image,cuda:'12.4',gpu:'FIXTURE',vramMiB:24576,freeVramMiB:24576,
    modelSha256:hash,encoderSha256:hash,vaeSha256:hash,state:'idle' as const}),
  bridge:{health:async()=>true,generate:async()=>{computes++;return {bytes,sha256:digest(bytes)}}}})
 const request=(path:string,body?:unknown)=>new Request(`https://fixture.salad.cloud${path}`,{
  method:body?'POST':'GET',headers:{Authorization:`Bearer ${config.workerToken}`,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})})
 let worker=createSaladWorker(config,ports())
 const responses=await Promise.all(Array.from({length:12},()=>worker.handle(request('/v1/jobs',row))))
 assert.ok(responses.every(r=>[200,202,503].includes(r.status)))
 await worker.drain(); assert.equal(computes,1)
 await pool.end();pool=new pg.Pool({...options,max:24});worker=createSaladWorker(config,ports())
 assert.equal((await worker.handle(request('/v1/jobs',row))).status,200)
 const media=await worker.handle(request(`/v1/jobs/${row.id}/media`))
 assert.equal(media.status,200);assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes)
 assert.equal(computes,1)
 assert.equal((await worker.handle(request('/v1/jobs',{...row,scope:digest('other-owner')}))).status,409)
 await worker.drain()
 // A new worker process must observe an unresolved durable claim even when the GPU is idle.
 const interrupted=job(), unknown: Job={...interrupted,status:'unknown',revision:1}
 const persistence=createSaladPersistence(pool)
 assert.equal(await persistence.journal.reserve(interrupted),'created')
 assert.equal(await persistence.journal.compareAndSet(interrupted,unknown),true)
 await pool.end();pool=new pg.Pool({...options,max:24});worker=createSaladWorker(config,ports())
 const caps=await worker.handle(request('/v1/capabilities'))
 assert.equal((await caps.json()).state,'interrupted')
 assert.equal((await worker.handle(request('/health'))).status,503)
 const second={...row,...identity('owner:org','second-operation',input,'fixture')}
 assert.equal((await worker.handle(request('/v1/jobs',second))).status,503)
 assert.equal(computes,1,'restart cannot release an unresolved execution or generate again')
 assert.deepEqual(await createSaladPersistence(pool).journal.readActive(),unknown)
 await worker.drain()
})
