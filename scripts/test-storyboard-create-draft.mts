import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareStoryboardDraft, readStoryboardDraft, importStoryboardDraft, storyboardDraftKey,
  StoryboardDraftError, MAX_STORYBOARD_DRAFT_BYTES } from '../src/lib/storyboard-create-draft.ts'

const user = '00000000-0000-4000-8000-000000000017'
const other = '00000000-0000-4000-8000-000000000018'
const source = () => ({ idea: 'Le souffle — forêt 🌿', format: '1:1' as const, durationTarget: 'medium' as const,
  scenes: [
    { id: 'plan-a', visual_prompt: 'A golden forest, wide shot', description: 'La lumière entre.\nLa forêt respire.', duration_seconds: 7, transition: 'fade' as const },
    { id: 'plan-b', visual_prompt: 'A mountain river from above', description: 'La rivière poursuit son chemin.', duration_seconds: 11, transition: 'cut' as const },
  ] })
class MemoryStorage {
  values = new Map<string, string>(); reads: string[] = []; writes: string[] = []
  failRead = false; failWrite = false
  getItem(key: string) { this.reads.push(key); if (this.failRead) throw new Error('read denied'); return this.values.get(key) ?? null }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error('quota'); this.writes.push(key); this.values.set(key, value) }
}
const options = { requestLocked: false, hasDraft: false, replaceConfirmed: false }
const errorCode = (code: string) => (cause: unknown) => cause instanceof StoryboardDraftError && cause.code === code

test('handoff keeps the complete original and binds its version and identity to its owner', () => {
  const storage = new MemoryStorage(), original = source(), before = structuredClone(original)
  const packet = prepareStoryboardDraft(storage, user, original)
  assert.equal(packet.version, 1); assert.equal(packet.userId, user); assert.equal(packet.importCount, 0)
  assert.match(packet.id, /^[0-9a-f-]{36}$/)
  assert.deepEqual(packet.source, before); assert.deepEqual(original, before)
  assert.deepEqual(readStoryboardDraft(storage, user), packet)
  assert.deepEqual(storage.writes, [storyboardDraftKey(user)])
})

test('explicit import converts descriptions only and retains IDs, prompts, timing and transitions', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  const result = importStoryboardDraft(storage, user, packet, options)
  assert.deepEqual(result.draft, { topic: 'Le souffle — forêt 🌿', format: '1:1',
    script: 'La lumière entre. La forêt respire.\nLa rivière poursuit son chemin.' })
  assert.equal(result.packet.importCount, 1); assert.equal(result.packet.id, packet.id)
  assert.deepEqual(result.packet.source, packet.source)
  assert.deepEqual(readStoryboardDraft(storage, user), result.packet)
})

test('repeated preparation is idempotent and never clears a previous import receipt', () => {
  const storage = new MemoryStorage(), first = prepareStoryboardDraft(storage, user, source())
  const second = prepareStoryboardDraft(storage, user, source())
  assert.deepEqual(second, first); assert.equal(storage.writes.length, 1)
  const imported = importStoryboardDraft(storage, user, first, options).packet
  assert.deepEqual(prepareStoryboardDraft(storage, user, source()), imported)
  assert.equal(storage.writes.length, 2)
})

test('a different prepared storyboard cannot replace the previous one without explicit consent', () => {
  const storage = new MemoryStorage(), first = prepareStoryboardDraft(storage, user, source())
  const next = { ...source(), idea: 'Une autre histoire' }
  assert.throws(() => prepareStoryboardDraft(storage, user, next), errorCode('EXISTS'))
  assert.deepEqual(readStoryboardDraft(storage, user), first); assert.equal(storage.writes.length, 1)
  const replaced = prepareStoryboardDraft(storage, user, next, true)
  assert.notEqual(replaced.id, first.id); assert.equal(replaced.source.idea, next.idea)
})

test('an existing form draft requires consent before the import marker can change', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  assert.throws(() => importStoryboardDraft(storage, user, packet, { ...options, hasDraft: true }), errorCode('CONSENT'))
  assert.deepEqual(readStoryboardDraft(storage, user), packet); assert.equal(storage.writes.length, 1)
  assert.equal(importStoryboardDraft(storage, user, packet, { ...options, hasDraft: true, replaceConfirmed: true }).packet.importCount, 1)
})

test('a pending durable request blocks every import even with replacement consent', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source()), reads = storage.reads.length
  assert.throws(() => importStoryboardDraft(storage, user, packet, { ...options, requestLocked: true, replaceConfirmed: true }), errorCode('LOCKED'))
  assert.equal(storage.reads.length, reads); assert.equal(storage.writes.length, 1)
})

test('stale and double imports cannot replay; a fresh intentional reimport preserves the same original', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  const first = importStoryboardDraft(storage, user, packet, options).packet
  assert.throws(() => importStoryboardDraft(storage, user, packet, { ...options, replaceConfirmed: true }), errorCode('CHANGED'))
  assert.throws(() => importStoryboardDraft(storage, user, first, options), errorCode('CONSENT'))
  const next = importStoryboardDraft(storage, user, first, { ...options, replaceConfirmed: true }).packet
  assert.equal(next.importCount, 2); assert.deepEqual(next.source, packet.source); assert.equal(storage.writes.length, 3)
})

test('a handoff changed after display cannot borrow the old consent', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  const next = prepareStoryboardDraft(storage, user, { ...source(), idea: 'Nouveau projet' }, true)
  assert.throws(() => importStoryboardDraft(storage, user, packet, { ...options, replaceConfirmed: true }), errorCode('CHANGED'))
  assert.deepEqual(readStoryboardDraft(storage, user), next)
})

test('changing account never reads or imports the previous owner’s handoff', () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  storage.reads = []
  assert.equal(readStoryboardDraft(storage, other), null)
  assert.deepEqual(storage.reads, [storyboardDraftKey(other)])
  assert.throws(() => importStoryboardDraft(storage, other, packet, { ...options, replaceConfirmed: true }), errorCode('CHANGED'))
  storage.values.set(storyboardDraftKey(other), JSON.stringify(packet))
  assert.throws(() => readStoryboardDraft(storage, other), errorCode('CORRUPT'))
  assert.deepEqual(readStoryboardDraft(storage, user), packet)
})

for (const [name, mutate] of [
  ['blank description', (s: ReturnType<typeof source>) => { s.scenes[0].description = ' \r\n ' }],
  ['duplicate shot identity', (s: ReturnType<typeof source>) => { s.scenes[1].id = s.scenes[0].id }],
  ['empty visual prompt', (s: ReturnType<typeof source>) => { s.scenes[0].visual_prompt = '' }],
  ['zero duration', (s: ReturnType<typeof source>) => { s.scenes[0].duration_seconds = 0 }],
  ['negative duration', (s: ReturnType<typeof source>) => { s.scenes[0].duration_seconds = -1 }],
  ['non-finite duration', (s: ReturnType<typeof source>) => { s.scenes[0].duration_seconds = Infinity }],
  ['oversized duration', (s: ReturnType<typeof source>) => { s.scenes[0].duration_seconds = 121 }],
  ['short topic', (s: ReturnType<typeof source>) => { s.idea = 'ab' }],
  ['61 shots', (s: ReturnType<typeof source>) => { s.scenes = Array.from({ length: 61 }, (_, i) => ({ ...s.scenes[0], id: `plan-${i}` })) }],
  ['script above 20,000 characters', (s: ReturnType<typeof source>) => { s.scenes[0].description = 'a'.repeat(15_000); s.scenes[1].description = 'b'.repeat(5_000) }],
] as const) test(`invalid ${name} is rejected before storing or replacing any draft`, () => {
  const storage = new MemoryStorage(), input = source(); mutate(input)
  assert.throws(() => prepareStoryboardDraft(storage, user, input, true), errorCode('INVALID'))
  assert.equal(storage.writes.length, 0)
})

test('60 scenes and exactly 20,000 script characters remain admissible', () => {
  const storage = new MemoryStorage(), input = source()
  input.scenes = Array.from({ length: 60 }, (_, i) => ({ ...input.scenes[0], id: `plan-${i}`, description: 'a' }))
  const packet = prepareStoryboardDraft(storage, user, input)
  assert.equal(importStoryboardDraft(storage, user, packet, options).draft.script.split('\n').length, 60)
  const limit = source(); limit.scenes[0].description = 'a'.repeat(15_000); limit.scenes[1].description = 'b'.repeat(4_999)
  const boundary = prepareStoryboardDraft(storage, user, limit, true)
  assert.equal(importStoryboardDraft(storage, user, boundary, options).draft.script.length, 20_000)
})

test('the storage limit counts UTF-8 bytes before accepting a large transfer', () => {
  const storage = new MemoryStorage(), input = source()
  input.scenes = Array.from({ length: 40 }, (_, i) => ({ ...input.scenes[0], id: `plan-${i}`, visual_prompt: '🌿'.repeat(4_000) }))
  const raw = JSON.stringify(input)
  assert.ok(raw.length < MAX_STORYBOARD_DRAFT_BYTES)
  assert.ok(new TextEncoder().encode(raw).byteLength > MAX_STORYBOARD_DRAFT_BYTES)
  assert.throws(() => prepareStoryboardDraft(storage, user, input), errorCode('INVALID'))
  assert.equal(storage.writes.length, 0)
})

for (const [name, alter] of [
  ['invalid JSON', () => '{'],
  ['unsupported version', (p: unknown) => JSON.stringify({ ...(p as object), version: 2 })],
  ['unknown envelope property', (p: unknown) => JSON.stringify({ ...(p as object), autoSubmit: true })],
  ['too large raw input', () => 'x'.repeat(MAX_STORYBOARD_DRAFT_BYTES + 1)],
] as const) test(`stored ${name} never becomes an implicit form mutation`, () => {
  const storage = new MemoryStorage(), packet = prepareStoryboardDraft(storage, user, source())
  storage.values.set(storyboardDraftKey(user), alter(packet))
  assert.throws(() => readStoryboardDraft(storage, user), errorCode('CORRUPT'))
  assert.throws(() => prepareStoryboardDraft(storage, user, source()), errorCode('CORRUPT'))
  assert.equal(storage.writes.length, 1)
  assert.equal(prepareStoryboardDraft(storage, user, source(), true).importCount, 0)
})

test('read denial and quota failures stay visible without admitting an import', () => {
  const storage = new MemoryStorage(); storage.failRead = true
  assert.throws(() => prepareStoryboardDraft(storage, user, source(), true), errorCode('STORAGE'))
  storage.failRead = false; storage.failWrite = true
  assert.throws(() => prepareStoryboardDraft(storage, user, source()), errorCode('STORAGE'))
  storage.failWrite = false; const packet = prepareStoryboardDraft(storage, user, source()); storage.failWrite = true
  assert.throws(() => importStoryboardDraft(storage, user, packet, options), errorCode('STORAGE'))
  assert.deepEqual(readStoryboardDraft(storage, user), packet); assert.equal(storage.writes.length, 1)
})

test('historical handoffs and durable request receipts are never rewritten or removed', () => {
  const storage = new MemoryStorage(), receiptKey = `sutra:create-intent:v1:${user}`
  storage.values.set(receiptKey, '{"version":1,"cancelRequested":true}')
  storage.values.set('sutra-storyboard', JSON.stringify(source()))
  const before = new Map(storage.values)
  const packet = prepareStoryboardDraft(storage, user, source())
  importStoryboardDraft(storage, user, packet, options)
  for (const [key, value] of before) assert.equal(storage.values.get(key), value)
  assert.ok(storage.writes.every(key => key === storyboardDraftKey(user)))
})
