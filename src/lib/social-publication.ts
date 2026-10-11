import { createHash, randomUUID } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'
import { publishToPlatforms, buildPublishPayload, getPublicationResults, type PublishRequest, type PublishResult, type SocialPlatform } from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'

export interface VideoPublicationInput {
  videoId: string
  platforms: SocialPlatform[]
  caption?: string
  hashtags?: string[]
  title?: string
  description?: string
  tags?: string[]
  autoCaption?: boolean
  scheduledAt?: string
}
interface Operation {
  id: string
  fingerprint: string
  phase: 'submitting' | 'recorded'
  createdAt: string
  request: PublishRequest
  accountRows: Record<string, string>
  results?: PublishResult[]
}

export function publicationOutcome(results: PublishResult[]) {
  const published = results.filter(r => r.status === 'published' && r.success).length
  const status = results.length && published === results.length ? 'published'
    : results.some(r => r.status === 'unknown' || r.status === 'publishing') ? 'publishing'
    : published ? 'partially_published'
    : results.length && results.every(r => r.status === 'scheduled') ? 'scheduled' : 'failed'
  return { success: status === 'published', status, results }
}

async function savePublicationHistory(userId: string, videoId: string, operation: Operation, service: ReturnType<typeof createServiceClient>) {
  const results = (operation.results ?? []).filter(r => ['published', 'scheduled', 'failed'].includes(r.status ?? ''))
  if (!results.length) return
  const idFor = (platform: string) => {
    const hex = createHash('sha256').update(`${operation.id}:${platform}`).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  }
  const { error: socialError } = await service.schema('public').from('social_posts').upsert(results.map(result => ({
    id: idFor(result.platform), user_id: userId, video_id: videoId, platform: result.platform,
    account_id: operation.accountRows[result.platform], zernio_post_id: result.postId ?? null,
    external_post_id: result.externalPostId ?? null, post_url: result.postUrl ?? null,
    caption: operation.request.captionsByPlatform?.[result.platform]?.caption ?? operation.request.caption,
    hashtags: operation.request.captionsByPlatform?.[result.platform]?.hashtags ?? operation.request.hashtags,
    status: result.status, scheduled_for: operation.request.scheduledAt ?? null,
    published_at: result.status === 'published' ? result.publishedAt ?? null : null,
    error_message: result.error ?? null, metadata: { sutra_operation: operation.id },
  })), { onConflict: 'id' })
  if (socialError) throw new Error('SUTRA_RECONCILIATION_REQUIRED: historique social non enregistre')
  const { error: scheduleError } = await service.from('scheduled_posts').upsert(results.map(result => ({
    id: idFor(result.platform), user_id: userId, video_id: videoId, platform: result.platform,
    scheduled_at: operation.request.scheduledAt ?? operation.createdAt, status: result.status,
    platform_post_id: result.externalPostId ?? result.postId ?? null,
  })), { onConflict: 'id' })
  if (scheduleError) throw new Error('SUTRA_RECONCILIATION_REQUIRED: calendrier publication non enregistre')
}

/** One durable claim for the three historical HTTP routes and create autopilot.
 * publish_data is an existing JSONB column; no new publication queue is introduced. */
export async function publishVideoRecord(userId: string, input: VideoPublicationInput,
  service = createServiceClient(), publish = publishToPlatforms, reconcile = getPublicationResults,
) {
  const platforms = [...new Set(input.platforms)].sort() as SocialPlatform[]
  const { data: video, error } = await service.from('videos').select('id,user_id,status,video_url,title,description,tags,publish_data,shotstack_json')
    .eq('id', input.videoId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error('SUTRA_PUBLICATION_READ_FAILED')
  if (!video) throw new Error('SUTRA_PUBLICATION_VIDEO_NOT_FOUND')
  if (!video.video_url || !['ready', 'published'].includes(video.status)) throw new Error('SUTRA_PUBLICATION_VIDEO_NOT_READY')
  const verification = video.shotstack_json?.sutraVerification
  if (verification?.url !== video.video_url || !/^[a-f\d]{64}$/.test(verification?.sha256 ?? '')) {
    throw new Error('SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED')
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, platforms, videoUrl: video.video_url })).digest('hex')
  const previous = video.publish_data ?? null
  const operations = (previous?.sutraPublications ?? []) as Operation[]
  if (!Array.isArray(operations)) throw new Error('SUTRA_RECONCILIATION_REQUIRED: historique publication invalide')
  const existing = operations.find(op => op.fingerprint === fingerprint)
  if (existing) {
    if (existing.phase !== 'recorded' || !existing.results) throw new Error('SUTRA_RECONCILIATION_REQUIRED: publication deja soumise')
    const outcome = publicationOutcome(existing.results)
    // Reconciliation is read-only at the provider. Never POST again after a timeout or after 24h.
    if (['publishing', 'scheduled'].includes(outcome.status)) {
      const id = existing.results.find(r => r.postId)?.postId
      if (!id) throw new Error('SUTRA_RECONCILIATION_REQUIRED: identifiant publication manquant')
      const results = await reconcile(id, existing.request)
      const next = { ...previous, sutraPublications: operations.map(op => op.id === existing.id ? { ...op, results } : op) }
      const { data, error: saveError } = await service.from('videos').update({ publish_data: next,
        ...(publicationOutcome(results).success ? { status: 'published' } : {}),
      }).eq('id', input.videoId).eq('user_id', userId).eq('video_url', existing.request.videoUrl)
        .eq('publish_data', JSON.stringify(previous)).select('id').maybeSingle()
      if (saveError || !data) throw new Error('SUTRA_RECONCILIATION_REQUIRED: statut publication non enregistre')
      await savePublicationHistory(userId, input.videoId, { ...existing, results }, service)
      return publicationOutcome(results)
    }
    await savePublicationHistory(userId, input.videoId, existing, service)
    return outcome
  }
  if (operations.some(op => op.phase !== 'recorded' || ['publishing', 'scheduled'].includes(publicationOutcome(op.results ?? []).status))) {
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: publication precedente en cours')
  }
  if (operations.some(op => op.results?.some(r => r.status === 'published' && platforms.includes(r.platform)))) {
    throw new Error('SUTRA_PUBLICATION_ALREADY_PUBLISHED')
  }
  if (!operations.length && video.status === 'published') throw new Error('SUTRA_RECONCILIATION_REQUIRED: publication historique sans preuve')
  const { data: accounts, error: accountError } = await service.schema('public').from('social_accounts')
    .select('id,platform,external_id').eq('user_id', userId).eq('status', 'connected').in('platform', platforms)
  if (accountError) throw new Error('SUTRA_PUBLICATION_ACCOUNTS_UNAVAILABLE')
  const accountIds = {} as Record<SocialPlatform, string>
  const accountRows: Record<string, string> = {}
  for (const platform of platforms) {
    const matches = (accounts ?? []).filter(a => a.platform === platform)
    if (matches.length !== 1 || !matches[0].external_id) throw new Error('SUTRA_PUBLICATION_ACCOUNT_SELECTION_REQUIRED')
    accountIds[platform] = matches[0].external_id
    accountRows[platform] = matches[0].id
  }
  const request: PublishRequest = { videoUrl: video.video_url, platforms, accountIds,
    caption: input.caption ?? [input.title ?? video.title, input.description ?? video.description].filter(Boolean).join('\n\n'),
    hashtags: input.hashtags ?? input.tags ?? video.tags ?? [], scheduledAt: input.scheduledAt, idempotencyKey: randomUUID() }
  buildPublishPayload(request) // Validate before claiming and before any chargeable caption generation.
  const operation: Operation = { id: request.idempotencyKey!, fingerprint, phase: 'submitting', createdAt: new Date().toISOString(), request, accountRows }
  const claimedData = { ...(previous ?? {}), sutraPublications: [...operations, operation] }
  const claimedSnapshot = JSON.stringify(claimedData)
  let claim = service.from('videos').update({ publish_data: claimedData }).eq('id', input.videoId).eq('user_id', userId)
    .eq('status', video.status).eq('video_url', video.video_url)
    .eq('shotstack_json', JSON.stringify(video.shotstack_json))
  claim = previous === null ? claim.is('publish_data', null) : claim.eq('publish_data', JSON.stringify(previous))
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle()
  if (claimError || !claimed) throw new Error('SUTRA_PUBLICATION_ALREADY_CLAIMED')
  if (input.autoCaption) {
    request.captionsByPlatform = await generateMultiPlatformCaptions(input.title ?? video.title ?? '', input.description ?? video.description ?? '',
      platforms, { language: 'fr', style: 'engaging', includeCta: true })
  }
  const results = await publish(request)
  const outcome = publicationOutcome(results)
  // Keep the exact remote request and every per-account result, including partial/unknown states.
  const finalOperation: Operation = { ...operation, request, phase: 'recorded', results }
  const finalData = { ...(previous ?? {}), status: outcome.status, sutraPublications: [...operations, finalOperation] }
  const { data: saved, error: saveError } = await service.from('videos').update({ publish_data: finalData,
    ...(outcome.success ? { status: 'published' } : {}),
  }).eq('id', input.videoId).eq('user_id', userId).eq('video_url', request.videoUrl)
    .eq('publish_data', claimedSnapshot).select('id').maybeSingle()
  if (saveError || !saved) throw new Error('SUTRA_RECONCILIATION_REQUIRED: resultat publication non enregistre')
  await savePublicationHistory(userId, input.videoId, finalOperation, service)
  return outcome
}
