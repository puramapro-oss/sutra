import { createServiceClient } from '@/lib/supabase'

export async function uploadToStorage(
  path: string,
  data: ArrayBuffer | Buffer | Blob,
  contentType: string
): Promise<string> {
  try {
    const supabase = createServiceClient()

    const { error } = await supabase.storage
      .from('sutra-assets')
      .upload(path, data, {
        contentType,
        upsert: true,
      })

    if (error) throw new Error('SUTRA_STORAGE_UPLOAD_FAILED')

    const { data: urlData } = supabase.storage
      .from('sutra-assets')
      .getPublicUrl(path)

    return urlData.publicUrl
  } catch {
    throw new Error('SUTRA_STORAGE_UPLOAD_FAILED')
  }
}

export async function deleteFromStorage(path: string): Promise<void> {
  try {
    const supabase = createServiceClient()
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
