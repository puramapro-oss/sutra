import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

let failure: 'result' | 'exception' | null = null
let publicUrlReads = 0
const result = async () => {
  if (failure === 'exception') throw new Error('synthetic-sensitive-marker')
  return { data: [], error: failure === 'result' ? { message: 'synthetic-sensitive-marker' } : null }
}
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => ({
  storage: { from: () => ({ upload: result, remove: result, list: result,
    getPublicUrl: () => { publicUrlReads++; return { data: { publicUrl: 'https://storage.invalid/fixture' } } },
  }) },
}) } })
const { uploadToStorage, deleteFromStorage, listStorageFiles } = await import('../src/lib/storage.ts')
for (const mode of ['result', 'exception'] as const) {
  test(`storage ${mode}: failed upload/delete/list never report success or expose provider details`, async () => {
    failure = mode; publicUrlReads = 0
    for (const [operation, code] of [
      [() => uploadToStorage('test.mp4', Buffer.alloc(12), 'video/mp4'), 'UPLOAD'],
      [() => deleteFromStorage('test.mp4'), 'DELETE'],
      [() => listStorageFiles('test'), 'LIST'],
    ] as const) {
      await assert.rejects(operation, error => error instanceof Error && error.message === `SUTRA_STORAGE_${code}_FAILED`)
    }
    assert.equal(publicUrlReads, 0)
  })
}
test('successful legacy storage operations retain their existing contract', async () => {
  failure = null
  assert.equal(await uploadToStorage('test.mp4', Buffer.alloc(12), 'video/mp4'), 'https://storage.invalid/fixture')
  await deleteFromStorage('test.mp4'); assert.deepEqual(await listStorageFiles('test'), [])
})
