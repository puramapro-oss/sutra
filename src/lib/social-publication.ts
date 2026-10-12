import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { publishToPlatforms, getPublicationResults, type PublishResult, type SocialPlatform } from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'
import { runPublicationJournal, publicationHistoryId, type PublicationOperation, type PublicationGateway } from '@/lib/publication-journal'
export { publicationOutcome } from '@/lib/publication-journal'

export interface VideoPublicationInput {
  videoId: string; platforms: SocialPlatform[]; accountIds?: Partial<Record<SocialPlatform, string>>
  caption?: string; hashtags?: string[]; title?: string; description?: string; tags?: string[]
  autoCaption?: boolean; scheduledAt?: string
}

export async function savePublicationHistory(userId: string, videoId: string, operations: PublicationOperation[],
  service = createServiceClient(), kind: 'video' | 'auto' = 'video') {
  for (const operation of operations) {
    const results: PublishResult[] = operation.results ?? operation.request.platforms.map(platform => ({ platform, status: 'unknown', success: false }))
    const rows = results.map(result => ({
      id: operation.fingerprint ? (() => {
        // Preserve PR3 history IDs on import; upsert must repair the existing row.
        const hex = createHash('sha256').update(`${operation.id}:${result.platform}`).digest('hex')
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
      })() : publicationHistoryId(`${kind}:${videoId}`, result.platform, operation.request.accountIds[result.platform]),
      user_id: userId, video_id: kind === 'video' ? videoId : null, platform: result.platform,
      account_id: operation.accountRows[result.platform], zernio_post_id: result.postId ?? null,
      external_post_id: result.externalPostId ?? null, post_url: result.postUrl ?? null,
      caption: operation.request.captionsByPlatform?.[result.platform]?.caption ?? operation.request.caption,
      hashtags: operation.request.captionsByPlatform?.[result.platform]?.hashtags ?? operation.request.hashtags,
      status: result.status === 'unknown' || !result.status ? 'publishing' : result.status,
      scheduled_for: operation.request.scheduledAt ?? null,
      published_at: result.status === 'published' ? result.publishedAt ?? operation.createdAt : null,
      error_message: result.error ?? null,
      metadata: { sutra_operation: operation.id, production_kind: kind, production_id: videoId,
        account_id: operation.request.accountIds[result.platform], remote_status: result.status ?? 'unknown' },
    }))
    if (!rows.length) continue
    const history = await service.schema('public').from('social_posts').upsert(rows, { onConflict: 'id' })
    if (history.error) throw new Error('SUTRA_RECONCILIATION_REQUIRED: historique non enregistre')
    if (kind === 'video') {
      const scheduled = await service.from('scheduled_posts').upsert(rows.map(row => ({
        id: row.id, user_id: userId, video_id: videoId, platform: row.platform,
        scheduled_at: row.scheduled_for ?? operation.createdAt, status: row.status,
        platform_post_id: row.external_post_id ?? row.zernio_post_id,
      })), { onConflict: 'id' })
      if (scheduled.error) throw new Error('SUTRA_RECONCILIATION_REQUIRED: calendrier non enregistre')
    }
  }
}

export async function publishVideoRecord(userId: string, input: VideoPublicationInput,
  service = createServiceClient(), publish = publishToPlatforms, reconcile = getPublicationResults,
  gateway: Partial<PublicationGateway> = {}) {
  const read = () => service.from('videos').select('id,user_id,status,video_url,title,description,tags,publish_data,shotstack_json')
    .eq('id', input.videoId).eq('user_id', userId).maybeSingle()
  const { data: video, error } = await read()
  if (error) throw new Error('SUTRA_VIDEO_READ_FAILED')
  if (!video) throw new Error('SUTRA_VIDEO_NOT_FOUND')
  const verify = (row: typeof video) => {
    if (!row?.video_url || !['ready', 'published'].includes(row.status)) throw new Error('SUTRA_VIDEO_NOT_READY')
    const verification = row.shotstack_json?.sutraVerification
    if (verification?.url !== row.video_url || !/^[a-f\d]{64}$/.test(verification?.sha256 ?? '')) throw new Error('SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED')
  }
  verify(video)
  const previous = video.publish_data ?? null
  const operations = previous?.sutraPublications ?? []
  if (!Array.isArray(operations)) throw new Error('SUTRA_PUBLICATION_HISTORY_INVALID')
  const platforms = [...new Set(input.platforms)].sort()
  let captionsByPlatform
  // Generate before the claim; never mutate an already claimed provider request.
  const existingJournal = await service.from('social_publication_journals').select('operations')
    .eq('kind', 'video').eq('production_id', input.videoId).eq('user_id', userId).maybeSingle()
  if (existingJournal.error) throw new Error('SUTRA_PUBLICATION_JOURNAL_READ_FAILED')
  if (input.autoCaption && !operations.length && !existingJournal.data?.operations?.length) {
    captionsByPlatform = await generateMultiPlatformCaptions(input.title ?? video.title ?? '',
      input.description ?? video.description ?? '', platforms, { userId })
  }
  const outcome = await runPublicationJournal({ userId, productionId: input.videoId, kind: 'video', platforms,
    accountIds: input.accountIds, legacyOperations: operations,
    legacyUncertain: video.status === 'published' && !operations.length,
    request: { videoUrl: video.video_url, verifiedSha256: video.shotstack_json.sutraVerification.sha256, caption: input.caption ?? [input.title ?? video.title, input.description ?? video.description].filter(Boolean).join('\n\n'),
      hashtags: input.hashtags ?? input.tags ?? video.tags ?? [], scheduledAt: input.scheduledAt, captionsByPlatform },
    retryFailed: true,
    authorize: async request => {
      const current = await read()
      if (current.error || !current.data) throw new Error('SUTRA_VIDEO_READ_FAILED')
      verify(current.data)
      if (current.data.video_url !== request.videoUrl || (request.verifiedSha256 && current.data.shotstack_json.sutraVerification.sha256 !== request.verifiedSha256)) throw new Error('SUTRA_MEDIA_CHANGED')
    },
  }, service, { publish, reconcile, ...gateway })
  if ('reconciliationRequired' in outcome) return outcome
  const nextData = { ...previous, status: outcome.status, sutraPublications: outcome.operations }
  let update = service.from('videos').update({ publish_data: nextData, ...(outcome.success ? { status: 'published' } : {}) })
    .eq('id', input.videoId).eq('user_id', userId).eq('video_url', video.video_url)
    .eq('shotstack_json', JSON.stringify(video.shotstack_json))
  update = previous === null ? update.is('publish_data', null) : update.eq('publish_data', JSON.stringify(previous))
  const saved = await update.select('id').maybeSingle()
  if (saved.error || !saved.data) throw new Error('SUTRA_RECONCILIATION_REQUIRED: projection video non enregistree')
  await savePublicationHistory(userId, input.videoId, outcome.operations, service)
  return outcome
}
