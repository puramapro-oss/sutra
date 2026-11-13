import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createCinemaProject } from '../src/lib/cinema-project.ts'
import { exportBlenderScript } from '../src/lib/blender-export.ts'

const blender = process.env.SUTRA_BLENDER_BIN || 'blender'
const probe = spawnSync(blender, ['--version'], { encoding: 'utf8', timeout: 15_000 })

test('Blender creates an editable scene, preserves existing work, reopens and renders it', {
  skip: probe.status !== 0 ? 'Blender is unavailable; this is not a provider or plugin qualification.' : false,
  timeout: 180_000,
}, () => {
  const directory = mkdtempSync(join(tmpdir(), 'sutra-cinema-'))
  const output = join(directory, 'project.blend')
  const script = join(directory, 'project.py')
  const proof = join(directory, 'proof.json')
  const image = join(directory, 'preview.png')
  const marker = join(directory, 'MUST_NOT_EXIST')
  const hostile = `"""\n__import__('pathlib').Path(${JSON.stringify(marker)}).touch()\n# 🪷 é <script> \\ end`
  const project = createCinemaProject({ title: 'Épreuve 🪷', format: '9:16', fps: { numerator: 30000, denominator: 1001 }, scenes: [
    { id: 'plan-a', description: hostile, visual_prompt: hostile, duration_seconds: 1.001, transition: 'fade' },
    { id: 'plan-b', description: 'Suite', visual_prompt: 'A different view', duration_seconds: 2.002, transition: 'cut' },
  ] })
  writeFileSync(script, exportBlenderScript(project))
  const create = join(directory, 'create.py')
  writeFileSync(create, `import bpy, json, runpy
original = bpy.context.scene
original.name = 'USER_SCENE'
original.render.fps = 25
cube = bpy.data.objects['Cube']
cube.name = 'USER_OBJECT'
cube.location = (11, 12, 13)
before_scenes = set(bpy.data.scenes.keys())
before_objects = set(bpy.data.objects.keys())
runpy.run_path(${JSON.stringify(script)}, run_name='__main__')
added = set(bpy.data.scenes.keys()) - before_scenes
assert len(added) == 1
scene = bpy.data.scenes[added.pop()]
assert set(bpy.data.objects.keys()).issuperset(before_objects)
assert tuple(cube.location) == (11.0, 12.0, 13.0)
assert original.render.fps == 25
assert scene.frame_start == 1 and scene.frame_end == 90
assert abs(scene.render.fps / scene.render.fps_base - 30000 / 1001) < 0.00001
markers = sorted(scene.timeline_markers, key=lambda m: m.frame)
assert [m.frame for m in markers] == [1, 31]
assert [m.camera['sutra_scene_id'] for m in markers] == ['plan-a', 'plan-b']
assert all(m.camera.animation_data is not None for m in markers)
manifest = json.loads(bpy.data.texts[scene['sutra_manifest_text']].as_string())
assert manifest['scenes'][0]['description'] == json.loads(${JSON.stringify(JSON.stringify(hostile).replace(/[\u007f-\uffff]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`))})
assert manifest['qualification']['rights'] == 'unverified'
assert scene['sutra_audio_status'] == 'not_prepared'
with open(${JSON.stringify(proof)}, 'w') as stream:
    json.dump({'scene': scene.name, 'frames': scene.frame_end, 'markers': [m.frame for m in markers], 'objects_preserved': True, 'blender': bpy.app.version_string}, stream)
`)
  const created = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '7', '--python', create, '--', '--sutra-output', output], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 2_000_000,
  })
  assert.equal(created.status, 0, `${created.stdout}\n${created.stderr}`)
  assert.ok(existsSync(output))
  assert.equal(existsSync(marker), false, 'Prompt text must never be executed')
  assert.deepEqual(JSON.parse(readFileSync(proof, 'utf8')).markers, [1, 31])
  const before = readFileSync(output)
  const duplicate = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '7', '--python', script, '--', '--sutra-output', output], {
    encoding: 'utf8', timeout: 45_000, maxBuffer: 2_000_000,
  })
  assert.equal(duplicate.status, 7, 'Explicit export must refuse to overwrite an existing file')
  assert.deepEqual(readFileSync(output), before)
  const reopen = join(directory, 'reopen.py')
  writeFileSync(reopen, `import bpy, json
scene = next(scene for scene in bpy.data.scenes if scene.get('sutra_schema_version') == 1)
assert bpy.data.objects['USER_OBJECT'].location.x == 11
assert scene.frame_end == 90
assert len(scene.timeline_markers) == 2
scene.frame_set(40)
scene.camera = sorted(scene.timeline_markers, key=lambda marker: marker.frame)[1].camera
scene.render.resolution_x, scene.render.resolution_y = 90, 160
scene.render.resolution_percentage = 100
scene.cycles.samples = 1
scene.render.threads_mode = 'FIXED'
scene.render.threads = 2
scene.render.filepath = ${JSON.stringify(image)}
bpy.ops.render.render(write_still=True, scene=scene.name)
`)
  const reopened = spawnSync(blender, ['--background', output, '--python-exit-code', '7', '--python', reopen], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: 2_000_000,
  })
  assert.equal(reopened.status, 0, `${reopened.stdout}\n${reopened.stderr}`)
  const png = readFileSync(image)
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 90)
  assert.equal(png.readUInt32BE(20), 160)
  assert.equal(existsSync(marker), false)
})
