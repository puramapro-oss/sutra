import test from 'node:test'
import assert from 'node:assert/strict'
import { editorScenes, editorExportScenes, editorVolume } from '../src/lib/editor-export'
import { compositionPlan } from '../src/lib/composition-contract'
import { compositionHash } from '../src/lib/media-validation'
import { buildAudioArgs } from '../src/lib/ffmpeg-filters'
import { buildTracks } from '../src/lib/shotstack-timeline'

const scenes = [{ visual_prompt: 'A', duration_seconds: 3, use_stock: false }, { visual_prompt: 'B', duration_seconds: 4, use_stock: true }]
const sources: import('../src/lib/shotstack').AssembleClip[] = [{ url: 'https://media.invalid/a.mp4', duration: 3, type: 'ia', kind: 'video' }, { url: 'https://media.invalid/b.jpg', duration: 4, type: 'stock', kind: 'photo' }]
test('editor retains original media identity when scenes are reordered', () => {
  const recovered = editorScenes(scenes, { sutraEditorClips: sources })
  assert.deepEqual(editorExportScenes(recovered.toReversed()), sources.toReversed())
  assert.equal(editorVolume(80), .8); assert.equal(editorVolume(0), 0)
  assert.throws(() => editorVolume(101)); assert.throws(() => editorVolume(NaN))
})
test('legacy track recovery fails closed on missing, ambiguous or different scene sources', () => {
  const track = { clips: sources.map((s,i) => ({ asset: { src: s.url, type: i ? 'image' : 'video' }, length: s.duration, start: i * 3 })) }
  assert.equal(editorExportScenes(editorScenes(scenes, { timeline: { tracks: [track] } }))[1].kind, 'photo')
  for (const timeline of [null, { engine: 'ffmpeg' }, { sutraEditorClips: [sources[0]] }, { timeline: { tracks: [track, track] } }]) {
    assert.throws(() => editorExportScenes(editorScenes(scenes, timeline)), /sources/)
  }
})
test('voice gain reaches both renderers and changes the durable render identity', () => {
  const job = { clips: sources, voiceUrl: 'https://media.invalid/voice.mp3', musicUrl: '', musicVolume: 0, voiceVolume: .8, format: '16:9', quality: '720p', subtitles: [], transitions: 'none' }
  const track = buildTracks(job).flatMap(t => t.clips).find(c => (c.asset as {type:string}).type === 'audio')
  assert.equal((track?.asset as {volume:number}).volume, .8)
  assert.match(buildAudioArgs({ voicePath: '/voice.wav', musicPath: null, voiceVolume: .8, musicVolume: 0, totalDurationSeconds: 7, outputPath: '/out.m4a' }).join(' '), /volume=0.8/)
  assert.notEqual(compositionHash(job), compositionHash({ ...job, voiceVolume: .4 }))
  assert.equal(compositionHash({ ...job, voiceVolume: undefined }), compositionHash({ ...job, voiceVolume: 1 }))
  assert.equal(compositionPlan({ ...job, voiceVolume: 0 }).audioRequired, false)
  assert.throws(() => compositionPlan({ ...job, voiceVolume: 2 }), /Volume voix/)
})
