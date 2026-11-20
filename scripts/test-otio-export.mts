import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { CINEMA_FPS, createCinemaProject } from '../src/lib/cinema-project.ts'
import type { Scene, VideoFormat } from '../src/lib/storyboard.ts'
import { exportOtioProject } from '../src/lib/otio-export.ts'

const scenes: Scene[] = [
  { id: 'lumière', visual_prompt: 'Rain 🎬\n"Close-up"', description: 'Reflets\nUne aube nouvelle', duration_seconds: 0.1, transition: 'fade' },
  { id: 'cœur', visual_prompt: 'Wide shot', description: '', duration_seconds: 0.1, transition: 'slide' },
  { id: 'final', visual_prompt: 'Zoom in', description: 'Dernier plan', duration_seconds: 0.15, transition: 'zoom' },
]
const formats: VideoFormat[] = ['16:9', '9:16', '1:1']
const projects = CINEMA_FPS.flatMap(([numerator, denominator]) => formats.map(format =>
  createCinemaProject({ title: 'Un geste 🌿', scenes, format, fps: { numerator, denominator } })))

test('all formats and frame rates preserve canonical cut points and durations including accumulated rounding', () => {
  for (const project of projects) {
    const json = JSON.parse(exportOtioProject(project))
    assert.equal(json.OTIO_SCHEMA, 'Timeline.1')
    assert.equal(json.name, project.title)
    assert.equal(json.metadata.sutra.format, project.format)
    assert.deepEqual(json.metadata.sutra.fps, project.fps)
    assert.equal(json.global_start_time.rate, project.fps.numerator / project.fps.denominator)
    assert.equal(json.global_start_time.value, 0)
    assert.equal(json.tracks.children.length, 1)
    const [track] = json.tracks.children
    assert.equal(track.kind, 'Video')
    assert.equal(track.children.length, scenes.length)
    assert.equal(json.tracks.markers.length, scenes.length)
    let frames = 0
    for (const [i, scene] of project.scenes.entries()) {
      const clip = track.children[i]
      const marker = json.tracks.markers[i]
      assert.equal(clip.metadata.sutra.sceneId, scene.id)
      assert.equal(marker.metadata.sutra.sceneId, scene.id)
      assert.equal(marker.marked_range.start_time.value, frames)
      assert.equal(marker.marked_range.duration.value, 0)
      assert.equal(frames, scene.timeline.startFrame)
      assert.equal(clip.source_range.start_time.value, scene.source.inFrame)
      assert.equal(clip.source_range.duration.value, scene.timeline.durationFrames)
      assert.equal(clip.source_range.duration.rate, json.global_start_time.rate)
      frames += clip.source_range.duration.value
      assert.equal(frames, scene.timeline.endFrameExclusive)
    }
    assert.equal(frames, project.timeline.totalFrames)
    assert.equal(json.metadata.sutra.totalFrames, frames)
  }
})

test('editable offline clips retain instructions, identities and intended transitions without invented sources or handles', () => {
  const serialized = exportOtioProject(projects[0])
  const timeline = JSON.parse(serialized)
  const clips = timeline.tracks.children[0].children
  for (const [i, scene] of scenes.entries()) {
    const clip = clips[i]
    assert.equal(clip.OTIO_SCHEMA, 'Clip.1')
    assert.equal(clip.metadata.sutra.description, scene.description)
    assert.equal(clip.metadata.sutra.visual_prompt, scene.visual_prompt)
    assert.equal(clip.metadata.sutra.requestedSeconds, scene.duration_seconds)
    assert.equal(clip.metadata.sutra.requestedTransition, scene.transition)
    assert.deepEqual(clip.media_reference, {
      OTIO_SCHEMA: 'MissingReference.1', name: scene.id, available_range: null, metadata: {},
    })
    assert.deepEqual(clip.effects, [])
  }
  assert.equal(clips[0].name, 'Plan 1 — Reflets')
  assert.equal(clips[1].name, 'Plan 2 — cœur')
  assert.equal(serialized, exportOtioProject(projects[0]))
})

test('a modified derived timeline is rejected before serialization', () => {
  const project = structuredClone(projects[0])
  project.scenes[1].timeline.startFrame++
  assert.throws(() => exportOtioProject(project), /Projet cinéma invalide/)
})

// Optional native interoperability gate; ordinary TypeScript CI needs no Python dependency.
const python = process.env.SUTRA_OTIO_PYTHON
if (python) test('the official OTIO reader and writer round-trip every format and cadence', () => {
  const script = `
import json, sys
import opentimelineio as otio
for example in json.load(sys.stdin):
    source = example['project']
    timeline = otio.adapters.read_from_string(example['otio'], adapter_name='otio_json')
    rate = source['fps']['numerator'] / source['fps']['denominator']
    for iteration in range(2):
        assert isinstance(timeline, otio.schema.Timeline) and timeline.name == source['title']
        assert timeline.duration().value == source['timeline']['totalFrames'] and timeline.duration().rate == rate
        assert timeline.metadata['sutra']['format'] == source['format']
        assert len(timeline.video_tracks()) == 1 and len(timeline.audio_tracks()) == 0
        track = timeline.video_tracks()[0]
        assert len(track) == len(timeline.tracks.markers) == len(source['scenes'])
        for clip, marker, shot in zip(track, timeline.tracks.markers, source['scenes']):
            assert isinstance(clip, otio.schema.Clip) and isinstance(clip.media_reference, otio.schema.MissingReference)
            assert clip.media_reference.name == shot['id'] and clip.media_reference.available_range is None
            assert clip.metadata['sutra']['visual_prompt'] == shot['visual_prompt']
            assert clip.metadata['sutra']['requestedTransition'] == shot['transition']
            assert marker.metadata['sutra']['sceneId'] == shot['id']
            assert marker.marked_range.start_time.rate == rate
            assert marker.marked_range.start_time.value == shot['timeline']['startFrame']
            edit = track.range_of_child(clip)
            assert edit.start_time.value == shot['timeline']['startFrame'] and edit.duration.rate == rate
            assert edit.end_time_exclusive().value == shot['timeline']['endFrameExclusive']
        if iteration == 0:
            text = otio.adapters.write_to_string(timeline, adapter_name='otio_json')
            timeline = otio.adapters.read_from_string(text, adapter_name='otio_json')
`
  const input = JSON.stringify(projects.map(project => ({ project, otio: exportOtioProject(project) })))
  const result = spawnSync(python, ['-c', script], { input, encoding: 'utf8', timeout: 20000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})
