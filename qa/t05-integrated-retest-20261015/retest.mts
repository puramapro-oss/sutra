import test, {before, beforeEach, afterEach, after, mock} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {bytes, keys, transport, twoScenes, tempState, job, root, ffmpeg} from '../t05-final-media-20261015/helpers.mts'
import {fixturesDir, frame, measureAudio} from '../t05-real-export-20261014/helpers.mts'
import {closeNetwork} from '../t05-salad-media-20261014/fixtures.mts'
closeNetwork()
const {composeVideoWithFallback} = await import('../../src/lib/video-compositor.ts')
const {probeMedia} = await import('../../src/lib/media-inspection.ts')
const {assertFinalMedia} = await import('../../src/lib/media-validation.ts')
const proof = resolve('qa/t05-integrated-retest-20261015')
const evidence: {exports: unknown[]; checks: unknown[]} = {exports: [], checks: []}
before(async () => {
  await mkdir(join(proof, 'exports'), {recursive: true})
  for (const name of ['native.mp4','source.mp4','intro.mp4','outro.mp4','voice.wav','music.wav','logo.png','invalid.mp4','truncated.mp4','corrupt-tail.mp4']) bytes[name] = await readFile(join(fixturesDir, name))
  bytes['green-native.mp4'] = await readFile(resolve('qa/t05-final-media-20261015/scene-two-native.mp4'))
  bytes['green.mp4'] = await readFile(resolve('qa/t05-final-media-20261015/scene-two-enhanced.mp4'))
})
beforeEach(transport)
afterEach(() => mock.restoreAll())
after(async () => writeFile(join(proof, 'measurements.json'), JSON.stringify(evidence, null, 2)+'\n'))

for (const [format, width, height] of [['16:9',3840,2160],['9:16',2160,3840],['1:1',2160,2160]] as const) {
  test(`integrated: ${format} 4K composition all required`, async () => {
    const initial = await tempState(), contract = twoScenes(format,'4k')
    const name = format.replace(':','-'), path = join(proof,'exports',name+'.mp4')
    let fallbacks=0, uploads=0
    const result = await composeVideoWithFallback(contract, {
      assemble: async () => {fallbacks++; throw new Error('NO_LIVE_RENDER')},
      upload: async (_name, buffer, mime) => {
        uploads++; assert.equal(mime,'video/mp4'); assert.ok(Buffer.isBuffer(buffer))
        await writeFile(path,buffer); return `https://exports.invalid/integrated-${name}.mp4`
      },
    })
    assert.equal(fallbacks,0); assert.equal(uploads,1); assert.equal(result.engine,'ffmpeg')
    assert.ok(result.validation); assert.equal(result.validation.resolutionOrigin,'upscaled')
    const actual = await probeMedia(path)
    assert.deepEqual(actual,result.validation.final); assertFinalMedia(actual,contract)
    assert.equal(actual.fullDecode,true); assert.equal(actual.video?.width,width); assert.equal(actual.video?.height,height)
    assert.equal(actual.video?.sar,'1:1'); assert.equal(actual.video?.rotation,0)
    assert.equal(actual.video?.fps,30); assert.equal(actual.video?.frames,48)
    assert.equal(actual.video?.codec,'h264'); assert.equal(actual.audio[0]?.codec,'aac')
    assert.ok(actual.bitrate>0); assert.equal(result.validation.sources.length,2)
    const black=await frame(path,0.4,width,height), green=await frame(path,1.0,width,height)
    const intro=await frame(path,0.1,width,height), outro=await frame(path,1.5,width,height)
    assert.ok(black.center.every(c=>c<10)); assert.ok(green.center[1]>100 && green.center[0]<10)
    assert.ok(black.subtitleWhitePixels>50); assert.equal(green.subtitleWhitePixels,0)
    assert.ok(black.logo.every(c=>c>160)); assert.ok(green.logo.every(c=>c>160))
    assert.ok(intro.center[0]>220); assert.ok(outro.center[2]>220)
    const audio=await measureAudio(path,keys)
    await ffmpeg(['-ss','0.4','-i',path,'-vf','scale=iw/3:ih/3','-frames:v','1',join(proof,`preview-${name}.png`)])
    assert.deepEqual(await tempState(),initial)
    evidence.exports.push({format,file:`exports/${name}.mp4`,sha256:createHash('sha256').update(await readFile(path)).digest('hex'),validation:result.validation,audio,pixels:{black,green,intro,outro},fallbacks,uploads,cleanup:'PASS'})
  })
}

test('integrated: required assets and invalid inputs cannot produce an export', async () => {
  const initial=await tempState(); let uploads=0, fallbacks=0
  const ports={upload:async()=>{uploads++;return 'unexpected'},assemble:async()=>{fallbacks++;throw new Error('unexpected')}}
  for (const key of keys) {
    const contract=job('16:9'); contract.requirements={[key]:'required'}
    await assert.rejects(composeVideoWithFallback(contract,ports))
  }
  for(const name of ['invalid.mp4','truncated.mp4','corrupt-tail.mp4','expired.mp4']) {
    const contract=job('16:9'); contract.clips=[{url:root+name,type:'stock',durationSeconds:1.2}]
    await assert.rejects(composeVideoWithFallback(contract,ports))
  }
  assert.equal(uploads,0);assert.equal(fallbacks,0);assert.deepEqual(await tempState(),initial)
  evidence.checks.push({case:'six-required-assets-four-invalid-inputs',assertions:10,uploads,fallbacks,cleanup:'PASS'})
})

test('integrated: failed composition never returns raw media', async () => {
  let uploads=0, fallbackMockCalls=0
  await assert.rejects(composeVideoWithFallback(job('16:9'),{
    compose:async()=>{throw new Error('SYNTHETIC_LOCAL_FAILURE')},
    assemble:async()=>{fallbackMockCalls++;throw new Error('SYNTHETIC_REMOTE_FAILURE')},
    upload:async()=>{uploads++;return 'unexpected'},
  }),/SYNTHETIC_REMOTE_FAILURE/)
  assert.equal(uploads,0);assert.equal(fallbackMockCalls,1)
  evidence.checks.push({case:'both-engines-fail-closed',uploads,fallbackMockCalls,returnedResult:false})
})
