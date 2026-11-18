import assert from 'node:assert/strict'
import test from 'node:test'
import { createStoryboardBrief, importStoryboardText } from '../src/lib/storyboard-exchange.ts'
import { storyboardProjectTitle } from '../src/lib/storyboard.ts'
import type { StoryboardDraftSource } from '../src/lib/storyboard-create-draft'

const shot = { description: 'La gourde est posée sur la table.', visual_prompt: 'Copper bottle, wide shot', duration_seconds: 4.5, transition: 'fade' } as const
const source: StoryboardDraftSource = {
  idea: 'Une gourde pour la randonnée', format: '9:16', durationTarget: 'short',
  scenes: [{ ...shot, id: 'existing' }],
}

test('long creative briefs stay intact while exports receive a usable project title', () => {
  const longIdea = 'Une journée dehors\n' + '🏞️'.repeat(300)
  assert.equal(storyboardProjectTitle(longIdea), 'Une journée dehors')
  assert.ok(createStoryboardBrief('chatgpt', { ...source, idea: longIdea }).includes('🏞️'.repeat(300)))
  assert.equal(storyboardProjectTitle('🏞'.repeat(300)), '🏞'.repeat(99) + '…')
  assert.equal(storyboardProjectTitle('  '), 'Projet cinéma SUTRA')
})

test('the creative brief carries the actual product, timings and approved storyboard text', () => {
  const text = createStoryboardBrief('chatgpt', source)
  const data = JSON.parse(text.split('\n\n').at(-1)!)
  assert.deepEqual(data, { sujet: source.idea, format: '9:16', duree: '4.5 s au total', plans: [shot] })
  const detailedIdea = 'Présentation du produit. '.repeat(32)
  assert.ok(createStoryboardBrief('chatgpt', { ...source, idea: detailedIdea }).includes(detailedIdea.trim()))
  const exampleLine = text.split('\n').find(line => line.startsWith('{"scenes"'))
  assert.equal(importStoryboardText(exampleLine!, '9:16').length, 1)
})

test('the MotionLab handoff follows its local command and preserves other requested ratios', () => {
  const text = createStoryboardBrief('motionlab', { ...source, format: '1:1' })
  assert.match(text, /^\/full-visual /)
  assert.match(text, /La cible SUTRA est 1:1/)
  assert.match(text, /MP4 local/)
  assert.equal(JSON.parse(text.split('\n\n').at(-1)!).plans[0].transition, 'fade')
  assert.doesNotMatch(createStoryboardBrief('motionlab', source), /recadrage à préparer/)
  assert.doesNotMatch(createStoryboardBrief('motionlab', source), /publicité PURAMA/)
  assert.match(createStoryboardBrief('chatgpt', { ...source, idea: 'Film d’ensemble de PURAMA' }), /une seule invitation/)
})

test('empty, fresh and over-sized briefs are handled before an export', () => {
  assert.throws(() => createStoryboardBrief('chatgpt', { ...source, idea: ' ', scenes: [] }), /sujet/)
  assert.match(createStoryboardBrief('chatgpt', { ...source, scenes: [] }), /~30s/)
  const scenes = Array.from({ length: 30 }, (_, i) => ({
    ...shot, id: String(i), visual_prompt: '🐦'.repeat(8_000),
  }))
  assert.throws(() => createStoryboardBrief('chatgpt', { ...source, scenes }), /512 Kio/)
})

test('imports strict or fenced JSON as editable fresh scenes without deduplicating repeated shots', () => {
  const raw = JSON.stringify({ scenes: [shot, shot] })
  const first = importStoryboardText(raw, '16:9')
  const fenced = importStoryboardText('\uFEFF```json\r\n' + raw + '\r\n```', '1:1')
  assert.deepEqual(fenced.map(({ id, ...fields }) => { assert.ok(id); return fields }), [shot, shot])
  assert.equal(new Set([...first, ...fenced].map(scene => scene.id)).size, 4)
})

test('rejects malformed or excessive imports and incomplete or unrenderable scenes', () => {
  for (const raw of ['narration', '[]', '{"scenes":[]}', JSON.stringify({ scenes: [{ ...shot, id: 'borrowed' }] }),
    JSON.stringify({ scenes: [{ ...shot, duration_seconds: 0.001 }] }), JSON.stringify({ scenes: [{ ...shot, transition: 'other' }] }),
    JSON.stringify({ scenes: [{ ...shot, description: ' ' }] }), JSON.stringify({ scenes: [null] }),
    JSON.stringify({ scenes: Array.from({ length: 61 }, () => shot) }), '🐦'.repeat(140_000)]) {
    assert.throws(() => importStoryboardText(raw, '9:16'))
  }
})
