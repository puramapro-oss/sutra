import assert from 'node:assert/strict'
import test from 'node:test'
import {
  affectedCinemaNodes,
  createCinemaProject,
  exportCinemaProjectJson,
  validateCinemaProject,
  type CinemaDependencyNode,
  type CinemaProject,
} from '../src/lib/cinema-project.ts'
import type { Scene } from '../src/lib/storyboard.ts'

function scene(id: string, duration = 8, transition: Scene['transition'] = 'cut'): Scene {
  return {
    id,
    visual_prompt: `Le personnage traverse la place, plan ${id}.`,
    description: `Plan ${id}`,
    duration_seconds: duration,
    transition,
  }
}

function project(scenes = [scene('first')]) {
  return createCinemaProject({ title: 'Un geste circule', format: '16:9', scenes })
}

const invalidProject = /Projet cinéma invalide/

test('six eight-second shots occupy exactly 1152 contiguous frames at 24 fps', () => {
  const film = project(Array.from({ length: 6 }, (_, i) => scene(`shot-${i + 1}`)))
  assert.deepEqual(film.fps, { numerator: 24, denominator: 1 })
  assert.deepEqual(film.timeline, { totalFrames: 1152, requestedSeconds: 48, durationSeconds: 48 })
  assert.deepEqual(film.scenes.map(item => item.timeline), [
    { startFrame: 0, durationFrames: 192, endFrameExclusive: 192 },
    { startFrame: 192, durationFrames: 192, endFrameExclusive: 384 },
    { startFrame: 384, durationFrames: 192, endFrameExclusive: 576 },
    { startFrame: 576, durationFrames: 192, endFrameExclusive: 768 },
    { startFrame: 768, durationFrames: 192, endFrameExclusive: 960 },
    { startFrame: 960, durationFrames: 192, endFrameExclusive: 1152 },
  ])
  assert.deepEqual(film.warnings, [])
})

test('fractional frame rates do not accumulate a rounding loss on sixty short shots', () => {
  const film = createCinemaProject({
    title: 'Cadence fractionnaire', format: '16:9',
    fps: { numerator: 24000, denominator: 1001 },
    scenes: Array.from({ length: 60 }, (_, i) => scene(`shot-${i}`, 0.1)),
  })
  // Six seconds at 24000/1001 fps: 144 frames, not 60 independently rounded two-frame shots.
  assert.equal(film.timeline.totalFrames, 144)
  assert.equal(film.timeline.durationSeconds, 6.006)
  assert.ok(Math.abs(film.timeline.requestedSeconds - 6) < 1e-10)
  assert.equal(film.scenes.reduce((total, item) => total + item.timeline.durationFrames, 0), 144)
  for (let i = 0; i < film.scenes.length; i++) {
    const timing = film.scenes[i].timeline
    assert.ok(timing.durationFrames >= 1)
    assert.equal(timing.startFrame, i === 0 ? 0 : film.scenes[i - 1].timeline.endFrameExclusive)
    assert.equal(timing.endFrameExclusive - timing.startFrame, timing.durationFrames)
  }
  assert.ok(film.warnings.some(item => item.code === 'FRAME_QUANTIZATION'))
})

test('JSON export preserves order, original ids, Unicode, newlines and quoted prompt text', () => {
  const title = 'Lumière « éternelle » — 雨 🎬'
  const text = 'Une personne dit "bonjour".\nChemin C:\\images\\film ; fin """ ; __import__("os")'
  const scenes = [
    { ...scene('plan-été-雨'), visual_prompt: text, description: 'Premier : cœur et cuivre.' },
    { ...scene('plan "deux"'), visual_prompt: 'Second angle 🎞️', description: 'Raccord inverse.' },
  ]
  const before = structuredClone(scenes)
  const film = createCinemaProject({ title, format: '9:16', scenes })
  const exported = exportCinemaProjectJson(film)
  assert.ok(exported.endsWith('\n'))
  const restored = JSON.parse(exported)
  assert.equal(restored.title, title)
  assert.equal(restored.format, '9:16')
  assert.deepEqual(restored.scenes.map((item: Scene) => item.id), scenes.map(item => item.id))
  assert.equal(restored.scenes[0].visual_prompt, text)
  assert.equal(restored.scenes[0].description, scenes[0].description)
  assert.deepEqual(validateCinemaProject(restored), film)
  assert.deepEqual(scenes, before)
  assert.equal(exported, exportCinemaProjectJson(createCinemaProject({ title, format: '9:16', scenes })))
})

test('invalid or unrepresentable shot durations cannot become an export', () => {
  for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 120.01, 0.00001]) {
    assert.throws(() => project([scene('bad', duration)]), invalidProject, `duration=${duration}`)
  }
  assert.equal(project([scene('maximum', 120)]).timeline.totalFrames, 2880)
})

test('projects reject duplicate identifiers, empty scenes, excess scenes and invalid formats or cadences', () => {
  assert.throws(() => project([scene('same'), scene('same')]), invalidProject)
  assert.throws(() => project([]), invalidProject)
  assert.throws(() => project(Array.from({ length: 61 }, (_, i) => scene(`shot-${i}`))), invalidProject)
  assert.equal(project(Array.from({ length: 60 }, (_, i) => scene(`shot-${i}`))).scenes.length, 60)
  assert.throws(() => createCinemaProject({ title: 'Film', format: '4:3', scenes: [scene('a')] } as never), invalidProject)
  for (const fps of [
    { numerator: 24, denominator: 0 }, { numerator: 0, denominator: 1 },
    { numerator: -24, denominator: 1 }, { numerator: 23.976, denominator: 1 },
    { numerator: 24, denominator: 1001 }, { numerator: Number.NaN, denominator: 1 },
  ]) {
    assert.throws(() => createCinemaProject({ title: 'Film', format: '16:9', scenes: [scene('a')], fps }), invalidProject)
  }
})

test('blank text, unknown transitions and extra input fields are rejected', () => {
  assert.throws(() => project([{ ...scene('a'), visual_prompt: '   \n' }]), invalidProject)
  assert.throws(() => project([{ ...scene('a'), id: '   ' }]), invalidProject)
  assert.throws(() => createCinemaProject({ title: ' ', format: '16:9', scenes: [scene('a')] }), invalidProject)
  assert.throws(() => project([{ ...scene('a'), transition: 'unimplemented' } as never]), invalidProject)
  assert.throws(() => createCinemaProject({ title: 'Film', format: '16:9', scenes: [scene('a')], secret: 'never-export-this' } as never), invalidProject)
})

test('requested transitions are preserved while preview cuts and warnings are explicit', () => {
  const transitions: Scene['transition'][] = ['fade', 'cut', 'slide', 'zoom']
  const film = project(transitions.map((transition, i) => scene(`shot-${i}`, 8, transition)))
  assert.deepEqual(film.scenes.map(item => item.transition), transitions)
  assert.ok(film.scenes.every(item => item.previewTransition === 'cut'))
  assert.deepEqual(film.warnings.filter(item => item.code === 'TRANSITION_NOT_PREVIEWED').map(item => item.sceneId), ['shot-0', 'shot-2', 'shot-3'])
  assert.equal(film.timeline.totalFrames, 768)
  assert.ok(film.scenes.every(item => item.source.availableFrames === null && item.source.handleInFrames === 0 && item.source.handleOutFrames === 0))
})

test('Higgsfield requests remain unsubmitted and only carry supported whole-second durations', () => {
  const durations = [4, 8, 30, 1, 3.5, 31, 120]
  const film = project(durations.map((duration, i) => scene(`shot-${i}`, duration)))
  assert.equal(film.productionStatus, 'previsualization')
  assert.equal(film.higgsfield.status, 'not_submitted')
  assert.deepEqual(film.qualification, { visual: 'not_tested', rights: 'unverified', audio: 'not_prepared', color: 'unqualified' })
  for (let i = 0; i < durations.length; i++) {
    const request = film.higgsfield.requests[i]
    assert.equal(request.status, 'not_submitted')
    assert.equal(request.sceneId, `shot-${i}`)
    if (i < 3) {
      assert.equal(request.issue, null)
      assert.deepEqual(request.body, {
        prompt: film.scenes[i].visual_prompt, duration: durations[i], resolution: '720p',
        aspect_ratio: '16:9', generate_audio: true,
      })
    } else {
      assert.equal(request.issue, 'DURATION_REQUIRES_EDIT')
      assert.equal(request.body, null)
    }
  }
})

test('missing media references leave a usable previsualization without a falsely valid Higgsfield request', () => {
  const prompt = 'Animate <<<image_1>>> while preserving the original character.'
  const film = project([{ ...scene('reference-shot'), visual_prompt: prompt }])
  assert.equal(film.productionStatus, 'previsualization')
  assert.equal(film.scenes[0].visual_prompt, prompt)
  assert.equal(film.higgsfield.requests[0].status, 'not_submitted')
  assert.equal(film.higgsfield.requests[0].issue, 'REQUEST_REQUIRES_EDIT')
  assert.equal(film.higgsfield.requests[0].body, null)
  assert.deepEqual(validateCinemaProject(JSON.parse(exportCinemaProjectJson(film))), film)
})

test('validation rejects stale timing, invented qualifications, submitted status and extra fields', () => {
  const original = project()
  const mutations: Array<(value: CinemaProject) => void> = [
    value => { value.timeline.totalFrames += 1 },
    value => { value.scenes[0].timeline.startFrame += 1 },
    value => { Object.assign(value.scenes[0].source, { availableFrames: 999 }) },
    value => { Object.assign(value.qualification, { visual: 'passed' }) },
    value => { Object.assign(value, { productionStatus: 'completed' }) },
    value => { Object.assign(value.higgsfield, { status: 'submitted' }) },
    value => { Object.assign(value.higgsfield.requests[0].body!, { duration: 7 }) },
    value => { Object.assign(value.higgsfield.requests[0].body!, { api_key: 'never-export-this' }) },
    value => { Object.assign(value, { unexpected: true }) },
    value => { Object.assign(value.scenes[0], { unexpected: true }) },
    value => { value.dependencies[1].dependsOn = [] },
  ]
  for (const mutate of mutations) {
    const modified = structuredClone(original)
    mutate(modified)
    assert.throws(() => validateCinemaProject(modified), invalidProject)
    assert.throws(() => exportCinemaProjectJson(modified), invalidProject)
  }
  assert.throws(() => validateCinemaProject(null), invalidProject)
  assert.throws(() => validateCinemaProject({}), invalidProject)
})

test('dependency invalidation reaches descendants without invalidating independent branches or parents', () => {
  const nodes: CinemaDependencyNode[] = [
    { id: 'settings', dependsOn: [] },
    { id: 'shot-a', dependsOn: ['settings'] },
    { id: 'shot-b', dependsOn: ['settings'] },
    { id: 'render-a', dependsOn: ['shot-a'] },
    { id: 'render-b', dependsOn: ['shot-b'] },
    { id: 'timeline', dependsOn: ['render-a', 'render-b'] },
    { id: 'export', dependsOn: ['timeline'] },
  ]
  assert.deepEqual(affectedCinemaNodes(nodes, ['shot-a']), ['shot-a', 'render-a', 'timeline', 'export'])
  assert.deepEqual(affectedCinemaNodes(nodes, ['timeline']), ['timeline', 'export'])
  assert.deepEqual(affectedCinemaNodes(nodes, ['settings']), nodes.map(item => item.id))
  assert.deepEqual(affectedCinemaNodes(nodes, []), [])
  const film = project([scene('a'), scene('b')])
  assert.deepEqual(affectedCinemaNodes(film.dependencies, ['scene:a']), ['scene:a', 'timeline:master', 'export:master'])
})

test('invalid dependency graphs reject cycles, missing references, duplicate nodes and duplicate parents', () => {
  const graphs: CinemaDependencyNode[][] = [
    [{ id: 'a', dependsOn: ['a'] }],
    [{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }],
    [{ id: 'a', dependsOn: ['missing'] }],
    [{ id: 'a', dependsOn: [] }, { id: 'a', dependsOn: [] }],
    [{ id: 'a', dependsOn: [] }, { id: 'b', dependsOn: ['a', 'a'] }],
  ]
  for (const nodes of graphs) assert.throws(() => affectedCinemaNodes(nodes, ['a']), invalidProject)
  assert.throws(() => affectedCinemaNodes([{ id: 'a', dependsOn: [] }], ['unknown']), invalidProject)
})
