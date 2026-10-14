import { createServiceClient } from '@/lib/supabase'
import { ownedMediaPath, durableMediaUrl, mediaOwner, assertMediaOwner } from './private-media'

export async function uploadToStorage(
  path: string,
  data: ArrayBuffer | Buffer | Blob,
  contentType: string
): Promise<string> {
  try {
    const objectPath = ownedMediaPath(path)
    const supabase = createServiceClient()

    const { error } = await supabase.storage
      .from('sutra-assets')
      .upload(objectPath, data, {
        contentType,
        upsert: true,
      })

    if (error) throw new Error('SUTRA_STORAGE_UPLOAD_FAILED')

    return durableMediaUrl(objectPath)
  } catch {
    throw new Error('SUTRA_STORAGE_UPLOAD_FAILED')
  }
}

export async function deleteFromStorage(path: string): Promise<void> {
  try {
    const owner = mediaOwner()
    // The input is an exact object key, including its owner prefix. Reuse the
    // upload validator to reject traversal without changing that key.
    ownedMediaPath(path, owner)
    const supabase = createServiceClient()
    await assertMediaOwner(path, owner, supabase)
    const { error } = await supabase.storage.from('sutra-assets').remove([path])
    if (error) throw new Error('SUTRA_STORAGE_DELETE_FAILED')
  } catch {
    throw new Error('SUTRA_STORAGE_DELETE_FAILED')
  }
}

export async function listStorageFiles(
  prefix: string
): Promise<Array<{ name: string; created_at: string }>> {
  try {
    const owner = mediaOwner()
    ownedMediaPath(prefix, owner)
    // A legacy object's ownership cannot authorize listing a shared folder.
    const root = `owners/${owner}`
    if (prefix !== root && !prefix.startsWith(`${root}/`)) throw new Error('SUTRA_STORAGE_LIST_FAILED')
    const supabase = createServiceClient()
    const { data, error } = await supabase.storage
      .from('sutra-assets')
      .list(prefix)

    if (error) throw new Error('SUTRA_STORAGE_LIST_FAILED')

    return (data ?? []).map((f) => ({
      name: f.name,
      created_at: f.created_at ?? '',
    }))
  } catch {
    throw new Error('SUTRA_STORAGE_LIST_FAILED')
  }
}
