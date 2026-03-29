import { createServiceClient } from '@/lib/supabase'

export async function uploadToStorage(
  path: string,
  data: ArrayBuffer | Buffer | Blob,
  contentType: string
): Promise<string> {
  const supabase = createServiceClient()

  const { error } = await supabase.storage
    .from('sutra-assets')
    .upload(path, data, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from('sutra-assets')
    .getPublicUrl(path)

  return urlData.publicUrl
}

export async function deleteFromStorage(path: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.storage.from('sutra-assets').remove([path])
}

export async function listStorageFiles(
  prefix: string
): Promise<Array<{ name: string; created_at: string }>> {
  const supabase = createServiceClient()
  const { data } = await supabase.storage
    .from('sutra-assets')
    .list(prefix)

  return (data ?? []).map((f) => ({
    name: f.name,
    created_at: f.created_at ?? '',
  }))
}
