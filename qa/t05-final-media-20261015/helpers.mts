import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import https from 'node:https'
import { mock } from 'node:test'
import { bytes, ffmpeg, fixturesDir, job, keys, root, transport } from '../t05-real-export-20261014/helpers.mts'
import { probeMedia } from '../../src/lib/media-inspection.ts'
export { job, keys, root, bytes, transport, ffmpeg }
export const proof = resolve('qa/t05-final-media-20261015')
export const output = join(proof, 'exports')
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r,ms))
export async function fixtures() {
 await mkdir(output,{recursive:true})
 for (const name of ['native.mp4','source.mp4','intro.mp4','outro.mp4','voice.wav','music.wav','logo.png','invalid.mp4','truncated.mp4','corrupt-tail.mp4']) bytes[name] = await readFile(join(fixturesDir,name))
 if (process.env.T05_FINAL_GROUP !== 'media') return
 const native = join(proof,'scene-two-native.mp4'), enhanced = join(proof,'scene-two-enhanced.mp4')
 await ffmpeg(['-f','lavfi','-i','color=green:s=160x90:r=30:d=0.6','-an','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p',native])
 await ffmpeg(['-i',native,'-vf','scale=320:180','-filter_threads','1','-an','-c:v','libx264','-preset','ultrafast','-threads','1','-pix_fmt','yuv420p',enhanced])
 bytes['green-native.mp4']=await readFile(native); bytes['green.mp4']=await readFile(enhanced)
}
export function twoScenes(format: '16:9'|'9:16'|'1:1', quality: '720p'|'1080p'|'4k') {
 const contract=job(format,keys); contract.quality=quality; contract.clips[0].durationSeconds=0.6
 contract.clips.push({url:root+'green.mp4',type:'stock',durationSeconds:0.6,lineage:{nativeUrl:root+'green-native.mp4',enhancedUrl:root+'green.mp4',generation:{kind:'upscaled',evidence:'synthetic-lavfi-160x90-scaled-320x180'}}})
 return contract
}
export async function tempState() { return (await readdir(tmpdir())).filter(n=>/^sutra-(compose-|t05-(probe|validate)-)/.test(n)).sort() }
export function mime(value: string) {
 const request = https.request
 mock.method(https,'request',(...args: Parameters<typeof request>) => {
  const callback = args[2]!
  return request(args[0],args[1], response=>{response.headers['content-type']=value; callback(response)})
 })
}
export async function measuredFile(name: string, buffer: Buffer) {
 const path=join(output,name+'.mp4'); await writeFile(path,buffer)
 const measurement=await probeMedia(path)
 assert.equal(measurement.fullDecode,true)
 return {path, measurement}
}
