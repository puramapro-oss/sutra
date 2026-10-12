import test from 'node:test'
import assert from 'node:assert/strict'
import { pipelineSteps, checkpointStage, assertFinalMedia, type PipelineStage } from '../src/lib/pipeline-state.ts'

// No network is allowed, including accidental real provider calls.
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const stages: PipelineStage[] = ['script','scenes','images','voice','music','subtitles','composition','export','publication']
for (const boundary of stages) {
  test(`restart after durable ${boundary} checkpoint preserves all nine independent outputs`, async () => {
    const database: Record<string, unknown> = {}, calls: Record<string, number> = {}
    let interrupted = false
    const run = async () => {
      const snapshot = structuredClone(database)
      const hooks = { onStepResolved: async (key: string, value: unknown) => {
        database[key] = structuredClone(value)
        if (key === `stage:${boundary}` && !interrupted) { interrupted = true; throw new Error('PROCESS_STOPPED_AFTER_COMMIT') }
      } }
      const step = pipelineSteps(snapshot, hooks)
      for (const stage of stages) {
        const value = await step(stage, async () => { calls[stage] = (calls[stage] ?? 0) + 1; return { url: `${stage}.asset` } }, true)
        await checkpointStage(snapshot, hooks, stage, value)
      }
    }
    await assert.rejects(run, /PROCESS_STOPPED/)
    await run()
    for (const stage of stages) {
      assert.equal(calls[stage], 1)
      assert.deepEqual(database[`stage:${stage}`], { status: 'complete', value: { url: `${stage}.asset` } })
    }
  })
}
for (const boundary of ['intent-not-written','intent-ack-lost','result-not-written','result-ack-lost']) {
  test(`paid call safety with ${boundary}`, async () => {
    const database: Record<string, unknown> = {}; let calls = 0, fail = true
    const run = () => pipelineSteps(structuredClone(database), { onStepResolved: async (key, value) => {
      if (fail && ((boundary==='intent-not-written' && key==='paid:started') || (boundary==='result-not-written' && key==='paid'))) { fail=false; throw new Error('DB_WRITE_FAILED') }
      database[key] = value
      if (fail && ((boundary==='intent-ack-lost' && key==='paid:started') || (boundary==='result-ack-lost' && key==='paid'))) { fail=false; throw new Error('DB_ACK_LOST') }
    } })('paid', async () => { calls++; return 'paid-output' }, true)
    await assert.rejects(run, /DB_/)
    if (boundary==='intent-ack-lost' || boundary==='result-not-written') await assert.rejects(run,/RECONCILIATION_REQUIRED/)
    else assert.equal(await run(),'paid-output')
    assert.equal(calls,boundary==='intent-ack-lost'?0:1)
  })
}
test('30 simultaneous requests in one executor share one provider operation', async () => {
  let calls=0; const done: Record<string, unknown> = {}; const step=pipelineSteps(done,{})
  const values=await Promise.all(Array.from({length:30},()=>step('voice',async()=>{calls++; await new Promise(resolve=>setTimeout(resolve,5)); return 'voice' },true)))
  assert.equal(calls,1); assert.ok(values.every(v=>v==='voice'))
})
test('a durable remote id allows polling, never another submission', async () => {
  let submissions=0,polls=0; const durable: Record<string,unknown>={}
  const run=()=>{
    const state=structuredClone(durable), step=pipelineSteps(state,{onStepResolved:async(k,v)=>{durable[k]=v}})
    return step('render',async()=>{
      if (!state.remote) { submissions++; durable.remote='existing-provider-id'; throw new Error('INTERRUPTED_POLL') }
      polls++; return 'final'
    },true,typeof state.remote==='string')
  }
  await assert.rejects(run,/INTERRUPTED/); assert.equal(await run(),'final'); assert.equal(submissions,1); assert.equal(polls,1)
})
test('forged or non-finite final media proof cannot authorize ready',()=>{
  const media={url:'final',duration:6,outputVerified:true,outputQuality:'hd',outputSize:{width:720,height:1280},verification:{url:'final',sha256:'a'.repeat(64),duration:6,width:720,height:1280,fps:30,hasAudio:true}}
  assert.doesNotThrow(()=>assertFinalMedia(media as never,['raw'],true))
  for(const invalid of [ {...media,verification:{...media.verification,duration:NaN}}, {...media,verification:{...media.verification,fps:Infinity}}, {...media,verification:{...media.verification,hasAudio:false}}, {...media,url:'raw'} ]) assert.throws(()=>assertFinalMedia(invalid as never,['raw'],true),/RECONCILIATION/)
})

test('final proof requires literal validation flags and positive finite integer dimensions', () => {
  const media = { url: 'final', duration: 6, outputVerified: true, outputQuality: 'hd', outputSize: { width: 720, height: 1280 },
    verification: { url: 'final', sha256: 'a'.repeat(64), duration: 6, width: 720, height: 1280, fps: 30, hasAudio: true } }
  for (const width of [Infinity, NaN, 0, -1, 0.5, '720']) {
    const invalid = { ...media, outputSize: { ...media.outputSize, width }, verification: { ...media.verification, width } }
    assert.throws(() => assertFinalMedia(invalid as never, ['raw'], true), /RECONCILIATION/)
  }
  for (const invalid of [ { ...media, outputVerified: 'true' }, { ...media, verification: { ...media.verification, hasAudio: 'false' } },
    { ...media, duration: 0.05, verification: { ...media.verification, duration: 0 } },
    { ...media, duration: 0.05, verification: { ...media.verification, duration: -0.01 } } ]) {
    assert.throws(() => assertFinalMedia(invalid as never, ['raw'], true), /RECONCILIATION/)
  }
})
