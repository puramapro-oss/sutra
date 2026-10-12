import test from 'node:test'
import assert from 'node:assert/strict'
import { pipelineSteps, checkpointStage, type PipelineStage } from '../../../src/lib/pipeline-state.ts'
import { socialDatabase, postId } from '../../../scripts/helpers/social-database.mts'
import { publishVideoRecord } from '../../../src/lib/social-publication.ts'
import type { PublicationGateway } from '../../../src/lib/publication-journal.ts'

globalThis.fetch = async () => { throw new Error('T08_UNEXPECTED_NETWORK') }
const stages: PipelineStage[] = ['script', 'scenes', 'images', 'voice', 'music', 'subtitles', 'composition', 'export', 'publication']

test('T08 load: 8 workers / 32 isolated checkpoint sequences, duplicate callers and restart', async t => {
  let active = 0, maxActive = 0, totalCalls = 0
  const latencies: number[] = []
  const started = performance.now()
  await Promise.all(Array.from({ length: 8 }, async (_, worker) => {
    for (let offset = 0; offset < 4; offset++) {
      const id = worker * 4 + offset, durable: Record<string, unknown> = {}, calls = new Map<string, number>()
      const begin = performance.now(); active++; maxActive = Math.max(maxActive, active)
      const hooks = { onStepResolved: async (key: string, value: unknown) => { durable[key] = structuredClone(value) } }
      const run = async () => {
        const done = structuredClone(durable), step = pipelineSteps(done, hooks)
        for (const stage of stages) {
          const execute = async () => {
            calls.set(stage, (calls.get(stage) ?? 0) + 1); totalCalls++
            await new Promise(resolve => setTimeout(resolve, 1))
            return { id, asset: `${id}:${stage}` }
          }
          const [a, b] = await Promise.all([step(stage, execute, true), step(stage, execute, true)])
          assert.deepEqual(a, b); assert.equal(a.id, id)
          await checkpointStage(done, hooks, stage, a)
        }
      }
      await run(); await run()
      for (const stage of stages) {
        assert.equal(calls.get(stage), 1)
        assert.deepEqual(durable[`stage:${stage}`], { status: 'complete', value: { id, asset: `${id}:${stage}` } })
      }
      latencies.push(performance.now() - begin); active--
    }
  }))
  assert.equal(totalCalls, 32 * 9); assert.equal(maxActive, 8)
  latencies.sort((a, b) => a - b)
  t.diagnostic(JSON.stringify({ model: 'memory checkpoints; no SQL/provider', workers: 8, sequences: 32, operations: totalCalls,
    totalMs: performance.now() - started, p95SequenceMs: latencies[Math.ceil(latencies.length * .95) - 1] }))
})

test('T08 load: 32 publication journals / 64 destinations remain unique after contention and replay', async t => {
  let submissions = 0, active = 0, peak = 0
  const start = performance.now()
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let sequence = 0; sequence < 4; sequence++) {
      // Each fixture is a separate DB model. This does not assert shared-DB RLS.
      const db = socialDatabase()
      const gateway: PublicationGateway = {
        now: () => Date.now(),
        publish: async request => {
          submissions++; active++; peak = Math.max(peak, active)
          await new Promise(resolve => setTimeout(resolve, 2)); active--
          return request.platforms.map(platform => ({ platform, accountId: request.accountIds[platform], postId, success: true, status: 'published' }))
        },
        replay: async () => { throw new Error('UNEXPECTED_REPLAY') },
        retry: async () => { throw new Error('UNEXPECTED_RETRY') },
        reconcile: async () => { throw new Error('UNEXPECTED_RECONCILE') },
      }
      const invoke = () => publishVideoRecord('u', { videoId: 'v', platforms: ['youtube', 'instagram'] }, db.client, gateway.publish, gateway.reconcile, gateway)
      // A losing CAS is a reconciliation refusal, never a successful publication.
      const outcomes = await Promise.allSettled([invoke(), invoke()])
      for (const outcome of outcomes) if (outcome.status === 'rejected') assert.match(String(outcome.reason), /^Error: SUTRA_RECONCILIATION_REQUIRED: journal concurrent ou non enregistre$/)
      const final = await invoke()
      assert.equal(final.status, 'published')
      assert.equal(db.tables.social_publication_journals.length, 1)
      assert.equal(db.tables.social_publication_journals[0].operations.length, 2)
      assert.equal(db.tables.social_posts.length, 2)
      assert.equal(new Set(db.tables.social_posts.map(row => row.id)).size, 2)
    }
  }))
  assert.equal(submissions, 64); assert.ok(peak <= 8)
  t.diagnostic(JSON.stringify({ model: 'fake PostgREST CAS; no SQL/social network', workers: 8, journals: 32, submissions, peak, durationMs: performance.now() - start }))
})
