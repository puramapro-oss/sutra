import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { renderStoryboardMp4 } from '../src/lib/storyboard-mp4.ts'
import { transformSync } from 'esbuild'
import { createCinemaProject } from '../src/lib/cinema-project.ts'
import { exportRemotionProject } from '../src/lib/remotion-export.ts'
import type { Scene, VideoFormat } from '../src/lib/storyboard.ts'

const drawing = readFileSync(new URL('../public/motion/storyboard-frame.mjs', import.meta.url), 'utf8')
const visualPrompt = 'Un produit en cuivre sur fond uni.'
const title = 'Démo « Lumière »'
const caption = 'Le titre `été`\n"<script>" 雨 \u2028\u2029'
const scenes: Scene[] = [
  { id: 'ouverture', visual_prompt: visualPrompt, description: caption, duration_seconds: 0.125, transition: 'slide' },
  { id: 'détail', visual_prompt: visualPrompt, description: 'Le reflet du cuivre.', duration_seconds: 0.25, transition: 'zoom' },
]

for (const [format, width, height] of [
  ['9:16', 1080, 1920], ['1:1', 1080, 1080], ['16:9', 1920, 1080],
] as const satisfies ReadonlyArray<readonly [VideoFormat, number, number]>) {
  test(`editable Remotion source preserves ${format}, fractional FPS, timing and literal scene text`, () => {
    const film = createCinemaProject({ title, format, scenes, fps: { numerator: 30000, denominator: 1001 } })
    const source = exportRemotionProject(film, drawing)
    const match = source.match(/^const project = ([\s\S]*?^});$/m)
    assert.ok(match, 'editable object data')
    const data = JSON.parse(match[1])
    assert.equal(data.title, title)
    assert.deepEqual([data.width, data.height, data.fps], [width, height, film.fps])
    assert.deepEqual(data.scenes.map((scene: { frames: number }) => scene.frames),
      film.scenes.map(scene => scene.timeline.durationFrames))
    assert.equal(data.scenes[0].text, caption)
    assert.equal(data.scenes[0].visualPrompt, visualPrompt)
    assert.deepEqual(data.scenes.map((scene: { entrance: string }) => scene.entrance), ['slide', 'zoom'])
    assert.equal(data.scenes[0].media, null)
    assert.equal(data.voiceover, null)
    assert.equal(source.includes('<script>'), false)
    assert.doesNotThrow(() => transformSync(source, { loader: 'jsx' }))
    assert.equal(exportRemotionProject(film, drawing), source)
  })
}

test('a stored project with stale timing cannot be exported', () => {
  const film = createCinemaProject({ title, format: '1:1', scenes })
  film.scenes[0].timeline.durationFrames++
  assert.throws(() => exportRemotionProject(film, drawing), /Projet cinéma invalide/)
})

test('oversized local previews and unsupported browsers leave the portable export usable', async () => {
  const film = createCinemaProject({ title, format: '16:9', scenes: scenes.map(scene => ({ ...scene, duration_seconds: 70 })) })
  await assert.rejects(renderStoryboardMp4(film, new AbortController().signal, () => {}), /deux minutes/)
  const brief = createCinemaProject({ title, format: '16:9', scenes })
  await assert.rejects(renderStoryboardMp4(brief, new AbortController().signal, () => {}), /H.264/)
  assert.match(exportRemotionProject(film, drawing), /registerRoot\(Root\)/)
  assert.throws(() => exportRemotionProject(brief, '<html>'), /dessin du storyboard/)
})

test('a cancelled local export never enters the encoder', async () => {
  const controller = new AbortController()
  controller.abort()
  const film = createCinemaProject({ title, format: '9:16', scenes })
  await assert.rejects(renderStoryboardMp4(film, controller.signal, () => {}), { name: 'AbortError' })
})
