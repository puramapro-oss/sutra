import test, {before, after, beforeEach, afterEach, mock} from 'node:test'
import assert from 'node:assert/strict'
import {writeFile, readFile, readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import dns from 'node:dns/promises'
import {closeNetwork} from '../qa/t05-salad-media-20261014/fixtures.mts'
import {proof, output, fixtures, transport, twoScenes, tempState, job, keys, root, ffmpeg, mime, measuredFile, sleep} from '../qa/t05-final-media-20261015/helpers.mts'
import {frame,measureAudio,measurePixels} from '../qa/t05-real-export-20261014/helpers.mts'
closeNetwork()
const {composeVideoWithFallback}=await import('../src/lib/video-compositor.ts')
const {composeVideo}=await import('../src/lib/ffmpeg-compositor.ts')
const {acquireFfmpegSlot,getFfmpegConcurrencyState}=await import('../src/lib/ffmpeg-concurrency.ts')
const {probeMedia,mediaCommand}=await import('../src/lib/media-inspection.ts')
const {assertFinalMedia}=await import('../src/lib/media-validation.ts')
const {runFfmpeg}=await import('../src/lib/ffmpeg-io.ts')
const evidence: {exports:unknown[]; checks:unknown[]}={exports:[],checks:[]}
before(fixtures)
beforeEach(transport)
afterEach(()=>{mock.restoreAll()})
after(async()=>writeFile(join(proof,`${process.env.T05_FINAL_GROUP}-${process.env.T05_FINAL_STAMP}.json`),JSON.stringify(evidence,null,2)+'\n'))

for(const format of ['16:9','9:16','1:1'] as const) for(const quality of ['720p','1080p','4k'] as const) {
 test(`media: multi-scene ${format} ${quality} all required`,async()=>{
  const before=await tempState(), contract=twoScenes(format,quality), name=`${format.replace(':','-')}-${quality}-multi`
  let fallback=0, stored=''
  const result=await composeVideoWithFallback(contract,{
   assemble:async()=>{fallback++;throw new Error('NO_LIVE_RENDER')},
   upload:async(_name,buffer,mime)=>{assert.equal(mime,'video/mp4'); assert.ok(Buffer.isBuffer(buffer)); stored=(await measuredFile(name,buffer)).path;return `https://exports.invalid/${name}.mp4`},
  })
  assert.equal(fallback,0); assert.equal(result.engine,'ffmpeg'); assert.ok(result.validation)
  const actual=await probeMedia(stored); assert.deepEqual(actual,result.validation.final); assertFinalMedia(actual,contract)
  assert.equal(actual.video?.sar,'1:1'); assert.equal(actual.video?.fps,30);assert.equal(actual.video?.rotation,0)
  assert.equal(actual.video?.frames,48); assert.ok(actual.bitrate>0); assert.equal(actual.audio[0].codec,'aac')
  assert.equal(result.validation.resolutionOrigin,'upscaled'); assert.equal(result.validation.sources.length,2)
  const {width,height}=actual.video!
  const black=await frame(stored,0.4,width,height), green=await frame(stored,1.0,width,height)
  assert.ok(black.center.every(c=>c<10)); assert.ok(green.center[1]>100 && green.center[0]<10)
  assert.ok(black.subtitleWhitePixels>50); assert.equal(green.subtitleWhitePixels,0)
  assert.ok(black.logo.every(c=>c>160)); assert.ok(green.logo.every(c=>c>160))
  const intro=await frame(stored,0.1,width,height), outro=await frame(stored,1.5,width,height)
  assert.ok(intro.center[0]>220); assert.ok(outro.center[2]>220)
  const audio=await measureAudio(stored,keys)
  assert.deepEqual(await tempState(),before)
  if(quality==='1080p') await ffmpeg(['-ss','0.4','-i',stored,'-frames:v','1',join(proof,`preview-${format.replace(':','-')}.png`)])
  evidence.exports.push({name,file:stored.replace(proof+'/',''),validation:result.validation,audio,pixels:{black,green,intro,outro},cleanup:'PASS'})
 })
}

test('media: MIME false, allowed wrong MIME, octet-stream signature and incorrect duration',async()=>{
 for(const contentType of ['text/html','image/png']) {
  transport();mime(contentType);let uploads=0,fallbacks=0
  await assert.rejects(composeVideoWithFallback(job('16:9'),{upload:async()=>{uploads++;return 'unexpected'},assemble:async()=>{fallbacks++;throw new Error('unexpected')}}),/Telechargement/)
  assert.equal(uploads,0);assert.equal(fallbacks,0);mock.restoreAll()
  evidence.checks.push({case:'false-mime',contentType,rejected:true})
 }
 transport(); mime('application/octet-stream')
 const rendered=await composeVideo(job('1:1'))
 assert.equal(rendered.validation?.final.fullDecode,true)
 const source=join(output,'16-9-720p-multi.mp4'), truncatedDuration=join(proof,'wrong-duration.mp4')
 await ffmpeg(['-i',source,'-t','0.4','-c','copy',truncatedDuration])
 const actual=await probeMedia(truncatedDuration)
 assert.throws(()=>assertFinalMedia(actual,twoScenes('16:9','720p')),/duree|duration/)
 evidence.checks.push({case:'wrong-final-duration',actual,rejected:true},{case:'octet-stream-valid-signature',accepted:true})
})

test('media: invalid, truncated, corrupt and missing required assets release temporary storage',async()=>{
 const initial=await tempState();let uploads=0, fallback=0
 for(const name of ['invalid.mp4','truncated.mp4','corrupt-tail.mp4','expired.mp4']) {
  const contract=job('16:9');contract.clips=[{url:root+name,type:'stock',durationSeconds:1.2}]
  await assert.rejects(composeVideoWithFallback(contract,{upload:async()=>{uploads++;return 'unexpected'},assemble:async()=>{fallback++;throw new Error('unexpected')}}))
  assert.deepEqual(await tempState(),initial)
 }
 for(const key of keys) { const contract=job('16:9');contract.requirements={[key]:'required'};await assert.rejects(composeVideo(contract));assert.deepEqual(await tempState(),initial) }
 assert.equal(uploads,0);assert.equal(fallback,0)
 evidence.checks.push({case:'invalid-inputs-and-required-assets',checks:10,uploads,fallback,cleanup:'PASS'})
})

test('resource: release must reserve a queued slot before a newcomer',async()=>{
 process.env.FFMPEG_MAX_CONCURRENT_JOBS='1'
 const first=await acquireFfmpegSlot();let secondRelease:(()=>void)|undefined, thirdRelease:(()=>void)|undefined
 const second=acquireFfmpegSlot().then(r=>{secondRelease=r})
 first()
 const third=acquireFfmpegSlot().then(r=>{thirdRelease=r})
 await sleep(10)
 const observed=getFfmpegConcurrencyState()
 secondRelease?.();await second;await third;thirdRelease?.()
 evidence.checks.push({case:'slot-transfer-race',observed})
 assert.equal(observed.active,1);assert.equal(observed.waiting,1)
})

test('resource: timeout applies while queued and releases waiter',async()=>{
 process.env.FFMPEG_MAX_CONCURRENT_JOBS='1'
 const release=await acquireFfmpegSlot();const controller=new AbortController();let settled=false
 const start=performance.now(), task=composeVideo({...job('16:9'),timeoutMs:40,signal:controller.signal}).then(()=>new Error('unexpected success'),e=>e).finally(()=>{settled=true})
 await sleep(120); const beforeRelease={settled,state:getFfmpegConcurrencyState()}
 controller.abort();release();await task
 evidence.checks.push({case:'queue-timeout',beforeRelease,elapsedMs:performance.now()-start})
 assert.equal(beforeRelease.settled,true);assert.equal(beforeRelease.state.waiting,0)
})

test('resource: total deadline cancels stalled download and cleans temp',async()=>{
 mock.method(dns,'lookup',()=>new Promise(()=>{}))
 const before=await tempState(), controller=new AbortController(), start=performance.now()
 const emergency=setTimeout(()=>controller.abort(),250)
 let reason=''
 try {await assert.rejects(composeVideo({...job('16:9'),timeoutMs:40,signal:controller.signal}),e=>{reason=(e as Error).message;return true})} finally {clearTimeout(emergency)}
 const elapsedMs=performance.now()-start
 assert.deepEqual(await tempState(),before);assert.equal(getFfmpegConcurrencyState().active,0)
 evidence.checks.push({case:'stalled-download-deadline',elapsedMs,reason,cleanup:'PASS'})
 assert.ok(elapsedMs<180,`deadline ignored: ${elapsedMs}ms`)
})

test('resource: fractional concurrency cannot create zero slots',()=>{
 process.env.FFMPEG_MAX_CONCURRENT_JOBS='0.5'
 try {assert.ok(getFfmpegConcurrencyState().max>=1)} finally {process.env.FFMPEG_MAX_CONCURRENT_JOBS='1'}
})

test('resource: real FFmpeg and probe timeout kill children',async()=>{
 const start=performance.now()
 await assert.rejects(runFfmpeg(['-f','lavfi','-i','testsrc=size=32x32:rate=30','-f','null','-'],40,'timeout-fixture'),/timeout/)
 await assert.rejects(mediaCommand('ffmpeg',['-v','error','-f','lavfi','-i','color=s=32x32:r=30','-f','null','-'],40),/delai/)
 evidence.checks.push({case:'actual-child-timeouts',elapsedMs:performance.now()-start,active:getFfmpegConcurrencyState().active})
})

test('resource: resumable failure preserves owned checkpoints, successful retry removes them',async()=>{
 const before=await tempState(), contract={...job('1:1'),jobId:'t05-final-media-owned-resume'}
 mime('text/html')
 await assert.rejects(composeVideo(contract))
 mock.restoreAll();transport()
 const afterFailure=await tempState(), created=afterFailure.filter(n=>!before.includes(n))
 assert.equal(created.length,1)
 assert.deepEqual(await readdir(join(tmpdir(),created[0])),[])
 const rendered=await composeVideo(contract)
 assert.equal(rendered.validation?.final.fullDecode,true);assert.deepEqual(await tempState(),before)
 evidence.checks.push({case:'resumable-retention-and-success-cleanup',created,retainedOnFailure:true,removedOnSuccess:true})
})

 test('resource: encoder discovery respects the total deadline',async()=>{
 const {resetEncoderCacheForTests}=await import('../src/lib/ffmpeg-encoder.ts')
 resetEncoderCacheForTests();process.env.T05_ENCODER_DELAY_MS='250'
 const start=performance.now()
 try {await assert.rejects(composeVideo({...job('16:9'),timeoutMs:40}))}
 finally {delete process.env.T05_ENCODER_DELAY_MS;resetEncoderCacheForTests()}
 const elapsedMs=performance.now()-start;evidence.checks.push({case:'encoder-discovery-timeout',elapsedMs})
 assert.ok(elapsedMs<180,`encoder discovery ignored deadline: ${elapsedMs}ms`)
 })

for(const [name,features] of [
 ['video-only',[]],['music-only',['music']],['voice-only',['voice']],['voice-music',['voice','music']],
 ['subtitles',['subtitles']],['brand',['logo','intro','outro']],['all-optional',keys],['optional-absent',[]],
] as const) test(`variants: 1080p ${name}`,async()=>{
 const contract=job('16:9',features,name.startsWith('optional') || name==='all-optional');contract.quality='1080p'
 const before=await tempState();let path='',fallback=0
 const result=await composeVideoWithFallback(contract,{
 assemble:async()=>{fallback++;throw new Error('NO_LIVE_RENDER')},
 upload:async(_name,buffer)=>{assert.ok(Buffer.isBuffer(buffer));path=(await measuredFile(`1080p-${name}`,buffer)).path;return `https://exports.invalid/${name}.mp4`}
 })
 assert.equal(fallback,0);assert.ok(result.validation);assert.equal(result.engine,'ffmpeg')
 const audio=await measureAudio(path,features),pixels=await measurePixels(path,1920,1080,features)
 assert.deepEqual(await tempState(),before)
 evidence.exports.push({name,file:path.replace(proof+'/',''),validation:result.validation,audio,pixels,cleanup:'PASS'})
})

test('limits: invalid budgets and excessive duration are refused before download',async()=>{
 let requests=0;mock.method(dns,'lookup',()=>{requests++;throw new Error('UNEXPECTED_DOWNLOAD')})
 for(const timeoutMs of [0,-1,NaN,Infinity,0.5,2147483648]) await assert.rejects(composeVideo({...job('16:9'),timeoutMs}),/Budget temps/)
 for(const [quality,duration] of [['720p',1501],['1080p',601],['4k',181]] as const) {
  const contract=job('16:9');contract.quality=quality;contract.clips[0].durationSeconds=duration
  await assert.rejects(composeVideo(contract),/plafond/)
 }
 assert.equal(requests,0);evidence.checks.push({case:'invalid-budgets-and-duration-caps',checks:9,requests})
})

test('limits: queued cancellation does not consume or strand a slot',async()=>{
 const initial=await tempState(),release=await acquireFfmpegSlot(),controller=new AbortController()
 const waiter=acquireFfmpegSlot(controller.signal);controller.abort()
 await assert.rejects(waiter,/annulee/)
 assert.deepEqual(getFfmpegConcurrencyState(),{active:1,waiting:0,max:1});release()
 assert.deepEqual(await tempState(),initial);assert.equal(getFfmpegConcurrencyState().active,0)
 evidence.checks.push({case:'cancelled-waiter-removal',waiting:0,active:0})
})

test('failures: both engines failing never return or upload raw video',async()=>{
 let uploads=0, fallback=0
 await assert.rejects(composeVideoWithFallback(job('16:9'),{
  compose:async()=>{throw new Error('SYNTHETIC_LOCAL_FAILURE')},
  assemble:async()=>{fallback++;throw new Error('SYNTHETIC_REMOTE_FAILURE')},
  upload:async()=>{uploads++;return 'unexpected'},
 }),/SYNTHETIC_REMOTE_FAILURE/)
 assert.equal(fallback,1);assert.equal(uploads,0)
 evidence.checks.push({case:'both-engines-failed',result:'rejected',uploads,fallbackMockOnly:fallback})
})

test('failures: even a validated fallback cannot return the raw source URL',async()=>{
 const contract=job('16:9'), rendered=await composeVideo(contract)
 await assert.rejects(composeVideoWithFallback(contract,{
  compose:async()=>{throw new Error('SYNTHETIC_LOCAL_FAILURE')},
  assemble:async()=>({url:contract.clips[0].url,timeline:{},validation:rendered.validation,duration:1.2,outputQuality:'hd',outputSize:{width:1280,height:720},outputVerified:true}),
 }),/brute refusee/)
 evidence.checks.push({case:'fallback-source-url',result:'rejected'})
})

test('failures: required audio missing from a real rendered file is rejected',async()=>{
 const contract=job('16:9',['voice']), rendered=await composeVideo(contract)
 const source=join(proof,'audio-required-before.mp4'), silent=join(proof,'audio-required-missing.mp4')
 await writeFile(source,rendered.buffer)
 await ffmpeg(['-i',source,'-an','-c:v','copy',silent])
 let uploads=0,fallback=0
 await assert.rejects(composeVideoWithFallback(contract,{
  compose:async()=>({buffer:await readFile(silent),durationSeconds:1.2,resolution:'1280x720'}),
  assemble:async()=>{fallback++;throw new Error('unexpected')},
  upload:async()=>{uploads++;return 'unexpected'},
 }),/audio/)
 assert.equal(uploads,0);assert.equal(fallback,0)
 evidence.checks.push({case:'required-audio-missing',measurement:await probeMedia(silent),result:'rejected',uploads,fallback})
})

test('failures: total composition timeout cannot trigger fallback or upload',async()=>{
 mock.method(dns,'lookup',()=>new Promise(()=>{}))
 let uploads=0,fallback=0
 await assert.rejects(composeVideoWithFallback(job('16:9'),{
  compose:params=>composeVideo({...params,timeoutMs:40}),
  assemble:async()=>{fallback++;throw new Error('unexpected')},
  upload:async()=>{uploads++;return 'unexpected'},
 }))
 assert.equal(uploads,0);assert.equal(fallback,0);assert.equal(getFfmpegConcurrencyState().active,0)
 evidence.checks.push({case:'budget-no-fallback',result:'rejected',uploads,fallback})
})
