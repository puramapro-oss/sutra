import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const { submissionIdentity, submitVideoJob, submissionErrorStatus } = await import('../src/lib/pipeline-submit.ts')
const profile = { id:'user', email:'user@invalid.test', plan:'free' } as import('../src/types').Profile
const identity = submissionIdentity('create-user',{topic:'test'})
const params = { kind:'create' as const, videoId:'video', input:{userId:'user',videoId:'video'}, ...identity, initialVideo:{} }

test('request identity is stable across object key order, distinct across users and intents',()=>{
 assert.deepEqual(submissionIdentity('create-user',{b:2,a:{z:1,x:2}}),submissionIdentity('create-user',{a:{x:2,z:1},b:2}))
 assert.notEqual(identity.key,submissionIdentity('create-other',{topic:'test'}).key)
 assert.notEqual(identity.key,submissionIdentity('create-user',{topic:'test'},'new-intent').key)
 assert.notEqual(identity.fingerprint,submissionIdentity('create-user',{topic:'changed'}).fingerprint)
 for(const id of ['', ' ', 'x'.repeat(201), 42]) assert.throws(()=>submissionIdentity('x',{},id as string),/INVALID_REQUEST/)
})
test('submission uses one RPC for quota/video/job and returns original video on retry',async()=>{
 let calls=0
 globalThis.fetch=async(url,init)=>{
  calls++; assert.match(String(url),/\/rpc\/submit_video_job$/)
  const body=JSON.parse(init?.body as string)
  assert.equal(body.p_user_id,profile.id); assert.equal(body.p_kind,'create')
  assert.equal(body.p_request_hash,identity.fingerprint)
  return Response.json([{id:'job',user_id:'user',kind:'create',idempotency_key:identity.key,video_id:'original-video',payload:{input:{videoId:'original-video'}}}])
 }
 const result=await submitVideoJob(profile,params)
 assert.equal(result.video_id,'original-video'); assert.equal(calls,1)
})
test('missing/wrong receipts and RPC errors never authorize paid work',async()=>{
 for(const data of [null,[],true,{id:'wrong',user_id:'another',kind:'create',idempotency_key:identity.key}]){
  globalThis.fetch=async()=>Response.json(data)
  await assert.rejects(()=>submitVideoJob(profile,params),/SUBMISSION_UNCONFIRMED/)
 }
 globalThis.fetch=async()=>Response.json({message:'SUTRA_QUOTA_EXHAUSTED'},{status:400})
 await assert.rejects(()=>submitVideoJob(profile,params),/QUOTA_EXHAUSTED/)
 assert.equal(submissionErrorStatus('SUTRA_QUOTA_EXHAUSTED'),403)
 assert.equal(submissionErrorStatus('SUTRA_IDEMPOTENCY_CONFLICT'),409)
})
