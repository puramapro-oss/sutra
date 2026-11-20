// Starts/stops ONLY its own new disposable local cluster, never an existing service.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
const root=resolve(import.meta.dirname,'../..'), bin=process.env.SUTRA_TEST_PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
const directory=mkdtempSync(join(tmpdir(),'sutra-salad-pg-')), data=join(directory,'data')
const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r))
const port=server.address().port; await new Promise(r=>server.close(r))
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:tmpdir(),LC_ALL:'C',SUTRA_DISPOSABLE_DB:'1',PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'fixture',NODE_OPTIONS:`--require=${join(root,'qa/t08/offline.cjs')}`}
function run(command,args,name) {
 const result=spawnSync(command,args,{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:8000000})
 if(name) writeFileSync(join(import.meta.dirname,name+'.log'),(result.stdout||'')+(result.stderr||''))
 if(result.status!==0) throw new Error('SALAD_PRIVATE_PG_CHECK_FAILED: '+(name||command))
}
let started=false
writeFileSync(join(import.meta.dirname,'postgres-result.json'),JSON.stringify({status:'RUNNING',command:'node qa/salad-integration-20261014/run-postgres.mjs'})+'\n')
try {
 run(join(bin,'initdb'),['-D',data,'--auth=trust','--username=fixture','--no-locale','--encoding=UTF8'])
 run(join(bin,'pg_ctl'),['-D',data,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -k ${directory} -p ${port}`,'-w','start']); started=true
 run(process.execPath,['--import','tsx','--test','scripts/test-salad-persistence.mts'],'postgres')
 writeFileSync(join(import.meta.dirname,'postgres-result.json'),JSON.stringify({status:'PASS',command:'node qa/salad-integration-20261014/run-postgres.mjs',database:'private-loopback-only',clusterPreserved:directory},null,2)+'\n')
 process.stdout.write('PASS Salad PostgreSQL concurrency, fencing and immutable external artifacts\n')
} catch(error) {
 writeFileSync(join(import.meta.dirname,'postgres-result.json'),JSON.stringify({status:'FAIL',command:'node qa/salad-integration-20261014/run-postgres.mjs'})+'\n')
 throw error
} finally { if(started) run(join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop']); process.stdout.write('Own disposable cluster stopped and preserved\n') }
