import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
let preflight = false, submits = 0
const failure = 'SALAD_DISABLED'
const job = { id:'33333333-3333-4333-8333-333333333333', status:'queued', payload:{input:{videoId:'44444444-4444-4444-8444-444444444444'}} }
mock.module('../../src/lib/supabase-server.ts', {namedExports:{createServerClient:async () => ({auth:{getUser:async () => ({data:{user:{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'}},error:null})}})}})
mock.module('../../src/lib/supabase.ts', {namedExports:{createServiceClient:() => {const query={select:() => query,eq:() => query,single:async () => ({data:{id:'11111111-1111-4111-8111-111111111111',plan:'creator'},error:null})};return {from:() => query}}}})
mock.module('../../src/lib/local-engine.ts',{namedExports:{shouldUseLocalEngine:() => true}})
mock.module('../../src/lib/salad/application.ts',{namedExports:{saladApplicationConfig:() => ({config:{}})}})
mock.module('../../src/lib/salad/config.ts',{namedExports:{requireActive:() => {if(preflight) throw new Error(failure)}}})
mock.module('../../src/lib/pipeline-submit.ts',{namedExports:{submissionIdentity:() => ({key:'fixture',fingerprint:'a'.repeat(64)}),submitVideoJob:async () => {submits++;return job},submissionErrorStatus:() => 503}})
mock.module('../../src/lib/video-worker.ts',{namedExports:{runVideoJob:async () => {throw new Error(failure)}}})
mock.module('../../src/lib/video-queue.ts',{namedExports:{claimJobByKey:async () => job,finishJob:async () => {},completeQuotaForFinishedJob:async () => assert.fail('no completion')}})
const {POST} = await import('../../src/app/api/create/route.ts')
test('only a pre-submission mode refusal releases the client receipt', async () => {
  for(const before of [true,false]) {
    preflight=before;submits=0
    const response=await POST(new Request('https://sutra.example.invalid/api/create',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'fixture'},body:JSON.stringify({topic:'Fixture',format:'16:9',quality:'720p',engine:'wan-classic',mode:'auto',mediaMode:'ai'})}))
    assert.equal(response.status,503)
    const body=await response.json();assert.equal(body.code,failure)
    assert.equal(body.submissionState,before?'not_submitted':undefined)
    assert.equal(submits,before?0:1)
  }
})
