import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
let answer: unknown = true
let transport = false
const diagnostic = 'T03_SYNTHETIC_PRIVATE_TRANSPORT_DIAGNOSTIC'
mock.module('../../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  rpc: async () => { if (transport) throw new Error(diagnostic); return { data: answer, error: null } },
}) } })
const { cancelJobByKey } = await import('../../src/lib/video-queue.ts')
test('cancel transport failure is scrubbed and never acknowledged', async () => {
  transport = true
  try { await assert.rejects(cancelJobByKey('fixture-key'), error => error instanceof Error && !error.message.includes(diagnostic)) }
  finally { transport = false }
})
for (const malformed of [null, undefined, 'true', 'false', 0, {}, []]) {
  test(`cancel malformed ACK ${JSON.stringify(malformed)} requires reconciliation`, async () => {
    answer = malformed
    await assert.rejects(cancelJobByKey('fixture-key'), /SUTRA_CANCEL_FAILED/)
  })
}
test('cancel literal boolean ACK remains authoritative', async () => {
  answer = true; assert.equal(await cancelJobByKey('fixture-key'), true)
  answer = false; assert.equal(await cancelJobByKey('fixture-key'), false)
})
