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
const { withMediaOwner, durableMediaUrl } = await import('../src/lib/private-media.ts')
const { uploadToStorage, deleteFromStorage, listStorageFiles } = await import('../src/lib/storage.ts')
for (const mode of ['result', 'exception'] as const) {
  test(`storage ${mode}: failed upload/delete/list never report success or expose provider details`, async () => {
    failure = mode; publicUrlReads = 0
    for (const [operation, code] of [
      [() => withMediaOwner('owner-a', () => uploadToStorage('test.mp4', Buffer.alloc(12), 'video/mp4')), 'UPLOAD'],
      [() => deleteFromStorage('test.mp4'), 'DELETE'],
      [() => listStorageFiles('test'), 'LIST'],
    ] as const) {
      await assert.rejects(operation, error => error instanceof Error && error.message === `SUTRA_STORAGE_${code}_FAILED`)
    }
    assert.equal(publicUrlReads, 0)
  })
}
test('uploads return stable owner references, never a public or expiring URL', async () => {
  failure = null
  assert.equal(await withMediaOwner('owner-a', () => uploadToStorage('test.mp4', Buffer.alloc(12), 'video/mp4')), durableMediaUrl('owners/owner-a/test.mp4'))
  assert.equal(publicUrlReads, 0)
  await assert.rejects(() => uploadToStorage('test.mp4', Buffer.alloc(12), 'video/mp4'), /UPLOAD_FAILED/)
  await deleteFromStorage('test.mp4'); assert.deepEqual(await listStorageFiles('test'), [])
})
