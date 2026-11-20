import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import {
  buildCreateSubtitles,
  proofForCheckpoint,
  separateExportProofs,
  type CaptionCue,
} from '../src/lib/caption-timeline.ts'

const exec = promisify(execFile)
const narration = 'Un. Deux trois quatre cinq.\nSuite du plan.'

test('manual cues follow scene lines and keep punctuation', () => {
  const built = buildCreateSubtitles({
    mode: 'manual',
    narration,
    totalDuration: 6,
    sceneDurations: [5, 5],
  })
  assert.deepEqual(built.cues, [
    { text: 'Un. Deux trois quatre cinq.', start: 0, end: 5 },
    { text: 'Suite du plan.', start: 5, end: 10 },
  ])
  assert.equal(built.proof.sync, 'manual-scene-lines')
  assert.equal(built.proof.syncIsSpeechAligned, false)
  assert.equal(built.proof.speechMeasured, false)
  assert.equal(built.proof.audio, 'stream-only')
  assert.equal(built.proof.file, 'unchecked')
})

test('estimated cues stay equal slices and do not claim speech sync', () => {
  const built = buildCreateSubtitles({
    mode: 'estimated',
    narration,
    totalDuration: 6,
    sceneDurations: [5, 5],
  })
  assert.deepEqual(built.cues.map(cue => cue.text), ['Un', 'Deux trois quatre cinq', 'Suite du plan'])
  assert.deepEqual(built.cues.map(cue => [cue.start, cue.end]), [[0, 2], [2, 4], [4, 6]])
  assert.equal(built.proof.sync, 'estimated-equal-split')
  assert.equal(built.proof.syncIsSpeechAligned, false)
})

test('a resumed checkpoint is not relabeled with the current rule', () => {
  const current = buildCreateSubtitles({
    mode: 'manual',
    narration,
    totalDuration: 10,
    sceneDurations: [5, 5],
  })
  const previous: CaptionCue[] = [
    { text: 'Un', start: 0, end: 10 / 3 },
    { text: 'Deux trois quatre cinq', start: 10 / 3, end: 20 / 3 },
    { text: 'Suite du plan', start: 20 / 3, end: 10 },
  ]
  assert.equal(proofForCheckpoint(current, previous).sync, 'prior-checkpoint')
  assert.equal(proofForCheckpoint(current, current.cues).sync, 'manual-scene-lines')
})

test('scene and line counts must match before a cue is stored', () => {
  assert.throws(() => buildCreateSubtitles({
    mode: 'manual',
    narration,
    totalDuration: 5,
    sceneDurations: [5],
  }), /SUTRA_CAPTION_SCENE_MISMATCH/)
})

test('create pipeline no longer owns a private sentence splitter', async () => {
  const source = await readFile(new URL('../src/lib/video-pipeline.ts', import.meta.url), 'utf8')
  assert.match(source, /buildCreateSubtitles\(captionInput\)/)
  assert.match(source, /proofForCheckpoint\(buildCreateSubtitles\(captionInput\), subtitles\)/)
  assert.equal(source.includes('function generateSubtitles'), false)
  assert.equal(source.includes('split(/[.!?]+/)'), false)
})

test('a silent audio stream does not validate speech or subtitle sync', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gx04-caption-'))
  const file = join(directory, 'silence.mp4')
  try {
    await exec('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=30:d=1',
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=48000',
      '-shortest', '-t', '1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
      file,
    ])
    const probed = await exec('ffprobe', [
      '-v', 'error', '-show_streams', '-of', 'json', file,
    ], { encoding: 'utf8' })
    const streams = JSON.parse(probed.stdout) as { streams?: Array<{ codec_type?: string }> }
    const hasAudioStream = streams.streams?.some(stream => stream.codec_type === 'audio') === true
    const measured = await exec('ffmpeg', [
      '-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-',
    ], { encoding: 'utf8' })
    const volume = measured.stderr.match(/mean_volume:\s*(-?(?:inf|\d+(?:\.\d+)?))/i)
    assert.ok(volume)
    const meanVolumeDb = volume[1].toLowerCase() === '-inf' ? Number.NEGATIVE_INFINITY : Number(volume[1])
    const proof = separateExportProofs({
      fileAccepted: true,
      hasAudioStream,
      meanVolumeDb,
      sync: 'estimated-equal-split',
    })
    assert.equal(proof.file, 'accepted')
    assert.equal(proof.audio, 'silent-stream')
    assert.equal(proof.subtitles, 'estimated-equal-split')
    assert.equal(proof.speechMeasured, false)
    assert.equal(proof.readyImpliesAlignedSpeech, false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
