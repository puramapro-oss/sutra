import { stampMp4 } from '@/lib/opentimestamps'
import { createServiceClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Video Proofs — orchestration OpenTimestamps + Supabase Storage + DB.
// Appelée après assembly Shotstack pour horodater chaque vidéo SUTRA.
//
// Flow :
//   1. fetch(videoUrl) → MP4 buffer
//   2. stampMp4(buffer) → { sha256Hex, proofBase64 } (hit calendars ~1-2s)
//   3. Upload .ots bytes dans bucket "video-proofs" au path {userId}/{videoId}.ots
//   4. Insert sutra.video_proofs (status='pending', FK videos.id)
//
// Non-blocking côté caller : erreurs attrapées, la génération ne fail pas
// si le stamp échoue (on peut toujours re-stamp via CRON plus tard).
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'video-proofs'
const MAX_MP4_BYTES = 100 * 1024 * 1024 // 100 MB — protection mémoire serverless
const FETCH_TIMEOUT_MS = 60_000

export type StampVideoOutcome =
  | { status: 'stamped'; proofId: string; sha256Hex: string; blockchain: 'bitcoin' }
  | { status: 'skipped'; reason: 'too_large' | 'fetch_failed' | 'already_stamped' }
  | { status: 'failed'; reason: string }

/**
 * Horodate une vidéo SUTRA fraîchement assemblée.
 *
 * @param params.videoId   UUID de sutra.videos
 * @param params.userId    UUID du propriétaire (pour path Storage + RLS)
 * @param params.videoUrl  URL publique du MP4 final (Shotstack CDN ou équivalent)
 */
export async function stampVideoWhenReady(params: {
  videoId: string
  userId: string
  videoUrl: string
}): Promise<StampVideoOutcome> {
  const { videoId, userId, videoUrl } = params
  const supabase = createServiceClient()

  // 0. Idempotence : si déjà stampé, skip.
  const existing = await supabase
    .from('video_proofs')
    .select('id')
    .eq('video_id', videoId)
    .maybeSingle<{ id: string }>()
  if (existing.data) {
    return { status: 'skipped', reason: 'already_stamped' }
  }

  // 1. Fetch MP4 avec timeout + garde taille.
  let buffer: Buffer
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(videoUrl, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) {
      return { status: 'skipped', reason: 'fetch_failed' }
    }
    const contentLength = Number(res.headers.get('content-length') ?? 0)
    if (contentLength && contentLength > MAX_MP4_BYTES) {
      return { status: 'skipped', reason: 'too_large' }
    }
    const arr = await res.arrayBuffer()
    if (arr.byteLength > MAX_MP4_BYTES) {
      return { status: 'skipped', reason: 'too_large' }
    }
    buffer = Buffer.from(arr)
  } catch (err) {
    return {
      status: 'failed',
      reason: err instanceof Error ? err.message : 'fetch exception',
    }
  }

  // 2. Stamp OTS — hit calendars publics ~1-2s.
  let sha256Hex: string
  let proofBase64: string
  try {
    const stamp = await stampMp4(buffer)
    sha256Hex = stamp.sha256Hex
    proofBase64 = stamp.proofBase64
  } catch (err) {
    return {
      status: 'failed',
      reason: err instanceof Error ? `stamp failed: ${err.message}` : 'stamp exception',
    }
  }

  // 3. Upload .ots dans bucket Storage.
  const storagePath = `${userId}/${videoId}.ots`
  const otsBytes = Buffer.from(proofBase64, 'base64')
  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, otsBytes, {
      contentType: 'application/x-opentimestamps',
      upsert: true,
    })
  if (upload.error) {
    return { status: 'failed', reason: `storage upload: ${upload.error.message}` }
  }

  // 4. URL publique du .ots (bucket public read).
  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  // 5. Insert video_proofs.
  const insert = await supabase
    .from('video_proofs')
    .insert({
      video_id: videoId,
      user_id: userId,
      content_sha256: sha256Hex,
      ots_proof_base64: proofBase64,
      storage_path: storagePath,
      storage_public_url: publicUrlData?.publicUrl ?? null,
      blockchain: 'bitcoin',
      status: 'pending',
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (insert.error) {
    return { status: 'failed', reason: `db insert: ${insert.error.message}` }
  }
  if (!insert.data) {
    return { status: 'failed', reason: 'db insert returned no row' }
  }

  return {
    status: 'stamped',
    proofId: insert.data.id,
    sha256Hex,
    blockchain: 'bitcoin',
  }
}
