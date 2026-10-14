import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

const calls: Array<{ operation: string; path: string }> = []
let serviceReads = 0
let legacyOwner: string | null = null
let legacyError = false
const service = {
  storage: { from: () => ({
    remove: async (paths: string[]) => { calls.push({ operation: 'remove', path: paths[0] }); return { error: null } },
    list: async (path: string) => { calls.push({ operation: 'list', path }); return { data: [{ name: 'clip.mp4', created_at: '2026-10-14' }], error: null } },
  }) },
  from: () => {
    const filters: Record<string, string> = {}
    const query = {
      select: () => query,
      eq: (key: string, value: string) => { filters[key] = value; return query },
      maybeSingle: async () => {
        assert.equal(filters.user_id, 'alice')
        assert.equal(filters.object_path, 'legacy/clip.mp4')
        return { data: legacyOwner ? { user_id: legacyOwner } : null, error: legacyError ? { message: 'synthetic-private-detail' } : null }
      },
    }
    return query
  },
}
mock.module('../src/lib/supabase.ts', { namedExports: { createServiceClient: () => { serviceReads++; return service } } })
const { withMediaOwner } = await import('../src/lib/private-media.ts')
const { deleteFromStorage, listStorageFiles } = await import('../src/lib/storage.ts')
beforeEach(() => { calls.length = 0; serviceReads = 0; legacyOwner = null; legacyError = false })

for (const operation of ['delete', 'list'] as const) {
  const invoke = (path: string) => operation === 'delete' ? deleteFromStorage(path) : listStorageFiles(path)
  const code = `SUTRA_STORAGE_${operation.toUpperCase()}_FAILED`
  test(`${operation}: missing owner must fail before service-role access`, async () => {
    await assert.rejects(() => invoke('owners/alice/clip.mp4'), { message: code })
    assert.equal(serviceReads, 0)
    assert.deepEqual(calls, [])
  })
  test(`${operation}: another user's object or folder is denied`, async () => {
    await assert.rejects(() => withMediaOwner('alice', () => invoke('owners/bob/clip.mp4')), { message: code })
    assert.deepEqual(calls, [])
  })
  test(`${operation}: traversal and malformed paths cannot reach storage`, async () => {
    for (const path of ['owners/alice/../bob', 'owners/alice/./clip.mp4', 'owners/alice//clip.mp4', 'owners/alice/clip\\secret', 'owners/alice/\u0000clip', 'owners/alice/' + 'x'.repeat(1024)]) {
      await assert.rejects(() => withMediaOwner('alice', () => invoke(path)), { message: code })
    }
    assert.deepEqual(calls, [])
  })
}
test('delete: owner can remove an exact owned key', async () => {
  await withMediaOwner('alice', () => deleteFromStorage('owners/alice/clip.mp4'))
  assert.deepEqual(calls, [{ operation: 'remove', path: 'owners/alice/clip.mp4' }])
})
test('list: owner can list their root and a folder, never a sibling prefix', async () => {
  await withMediaOwner('alice', async () => {
    assert.deepEqual(await listStorageFiles('owners/alice'), [{ name: 'clip.mp4', created_at: '2026-10-14' }])
    await listStorageFiles('owners/alice/videos')
    await assert.rejects(() => listStorageFiles('owners/alice-other'), /SUTRA_STORAGE_LIST_FAILED/)
    await assert.rejects(() => listStorageFiles('owners'), /SUTRA_STORAGE_LIST_FAILED/)
    await assert.rejects(() => listStorageFiles(''), /SUTRA_STORAGE_LIST_FAILED/)
  })
  assert.deepEqual(calls.map(c => c.path), ['owners/alice', 'owners/alice/videos'])
})
test('delete: legacy objects require the existing exact ownership inventory', async () => {
  for (const owner of [null, 'bob', 'alice']) {
    legacyOwner = owner
    if (owner === 'alice') await withMediaOwner('alice', () => deleteFromStorage('legacy/clip.mp4'))
    else await assert.rejects(() => withMediaOwner('alice', () => deleteFromStorage('legacy/clip.mp4')), /SUTRA_STORAGE_DELETE_FAILED/)
  }
  assert.deepEqual(calls, [{ operation: 'remove', path: 'legacy/clip.mp4' }])
})
test('delete: unavailable legacy inventory fails closed without exposing errors', async () => {
  legacyOwner = 'alice'; legacyError = true
  await assert.rejects(() => withMediaOwner('alice', () => deleteFromStorage('legacy/clip.mp4')), { message: 'SUTRA_STORAGE_DELETE_FAILED' })
  assert.deepEqual(calls, [])
})
test('list: legacy inventory cannot authorize a shared prefix', async () => {
  legacyOwner = 'alice'
  await assert.rejects(() => withMediaOwner('alice', () => listStorageFiles('legacy/clip.mp4')), /SUTRA_STORAGE_LIST_FAILED/)
  assert.deepEqual(calls, [])
})
