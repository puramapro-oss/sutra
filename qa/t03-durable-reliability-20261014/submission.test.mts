import assert from 'node:assert/strict'
import { test } from 'node:test'
import { submitVideoJob, submissionErrorStatus } from '../../src/lib/pipeline-submit'
import type { Profile } from '../../src/types'

const profile = { id: 'fixture-user', email: 'fixture@example.test', plan: 'free' } as Profile
const params = { kind: 'production' as const, videoId: null, input: {}, key: 'fixture-key', fingerprint: 'a'.repeat(64) }
for (const [diagnostic, expected, status] of [
  ['T03_SYNTHETIC_INTERNAL_DIAGNOSTIC', 'SUTRA_SUBMISSION_UNCONFIRMED', 503],
  ['SUTRA_QUOTA_EXHAUSTED', 'SUTRA_QUOTA_EXHAUSTED', 403],
  ['SUTRA_IDEMPOTENCY_CONFLICT', 'SUTRA_IDEMPOTENCY_CONFLICT', 409],
  ['SUTRA_INVALID_REQUEST_ID', 'SUTRA_INVALID_REQUEST_ID', 400],
  ['SUTRA_QUOTA_EXHAUSTED: T03_SYNTHETIC_INTERNAL_DIAGNOSTIC', 'SUTRA_SUBMISSION_UNCONFIRMED', 503],
] as const) {
  test(`submission exposes only exact allowed public code: ${status} ${diagnostic}`, async t => {
    const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
    let calls = 0
    globalThis.fetch = async (request) => {
      assert.equal(new URL(String(request)).origin, 'https://db.fixture.invalid'); calls++
      return new Response(JSON.stringify({ message: diagnostic, code: 'P0001' }), { status: 400 })
    }
    await assert.rejects(submitVideoJob(profile, params), error => {
      assert.equal((error as Error).message, expected)
      assert.equal(submissionErrorStatus((error as Error).message), status)
      return true
    })
    assert.equal(calls, 1)
  })
}
test('submission transport exception is redacted and never retried by the helper', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original })
  let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('T03_SYNTHETIC_TRANSPORT_DIAGNOSTIC') }
  await assert.rejects(submitVideoJob(profile, params), { message: 'SUTRA_SUBMISSION_UNCONFIRMED' })
  assert.equal(calls, 1)
})
