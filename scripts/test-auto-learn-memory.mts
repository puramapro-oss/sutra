import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { AutoVideoRecord } from '../src/lib/sutra-auto-types.ts'

globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
let prompts: string[] = []
let saved: { data: { id: string } | null; error: { message: string } | null }
mock.module('@purama/smarana', { namedExports: { smarana: {
  ask: async ({ message }: { message: string }) => { prompts.push(message); return { text: '{"insights":[]}' } },
} } })
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  from: () => ({ insert: () => ({ select: () => ({ maybeSingle: async () => saved }) }) }),
}) } })
const { analyzePerformance, recordMemory } = await import('../src/lib/sutra-auto-helpers.ts')
beforeEach(() => { prompts = []; saved = { data: { id: 'memory-a' }, error: null } })

test('learning prompt retains unknown metrics as unavailable rather than inventing zero', async () => {
  const video = { title: 'Measured views, unknown rate', views: 100, likes: 0, engagement_rate: null } as unknown as AutoVideoRecord
  await analyzePerformance({ userId: 'user-a', recentVideos: [video] })
  assert.match(prompts[0], /views=100, likes=0, engagement=indisponible/)
  assert.doesNotMatch(prompts[0], /engagement=0%/)
})

test('learning prompt retains an explicitly measured zero rate', async () => {
  const video = { title: 'Measured zero', views: 100, likes: 0, engagement_rate: 0 } as unknown as AutoVideoRecord
  await analyzePerformance({ userId: 'user-a', recentVideos: [video] })
  assert.match(prompts[0], /engagement=0%/)
})

for (const mode of ['saved', 'error', 'no-row'] as const) test(`memory ${mode} returns only confirmed persistence`, async () => {
  if (mode === 'error') saved = { data: null, error: { message: 'synthetic-private-db-detail' } }
  if (mode === 'no-row') saved = { data: null, error: null }
  assert.equal(await recordMemory({ userId: 'user-a', type: 'learning', content: 'verified insight' }), mode === 'saved')
})
