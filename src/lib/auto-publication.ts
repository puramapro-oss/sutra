import { createServiceClient } from '@/lib/supabase'
import { publishToPlatforms, type SocialPlatform, type PublishResult } from '@/lib/zernio'
import { runPublicationJournal, type PublicationGateway } from '@/lib/publication-journal'
import { savePublicationHistory } from '@/lib/social-publication'
import type { AutoConfig } from './sutra-auto-types'

// ---------------------------------------------------------------
// 3. PUBLICATION - via Zernio sur les plateformes connectees
// ---------------------------------------------------------------

const PLATFORM_ALIASES: Record<string, SocialPlatform> = {
  youtube_shorts: 'youtube',
  instagram_reels: 'instagram',
  tiktok: 'tiktok',
  youtube: 'youtube',
  instagram: 'instagram',
  facebook: 'facebook',
  x: 'x',
  twitter: 'x',
  linkedin: 'linkedin',
  pinterest: 'pinterest',
  threads: 'threads',
  snapchat: 'snapchat',
  reddit: 'reddit',
}

export async function publishAutoVideo(params: {
  config: AutoConfig
  videoUrl: string
  title: string
  description: string
  hashtags: string[]
  scheduledFor?: string
  idempotencyKey?: string
}): Promise<PublishResult[]> {
  const platforms = [...new Set((params.config.publish_platforms ?? [])
    .map((p) => PLATFORM_ALIASES[p] ?? (p as SocialPlatform))
    .filter(Boolean))] as SocialPlatform[]

  if (!platforms.length) {
    throw new Error('SUTRA_NO_PLATFORMS_CONFIGURED')
  }

  const accountIds: Record<string, string> = {}
  for (const conn of params.config.zernio_connected_platforms ?? []) {
    if (accountIds[conn.platform] && accountIds[conn.platform] !== conn.account_id) throw new Error('SUTRA_ACCOUNT_SELECTION_REQUIRED')
    accountIds[conn.platform] = conn.account_id
  }

  // Every disconnected destination remains an explicit failure.
  const missing = platforms.filter((p) => !accountIds[p])
  if (missing.length === platforms.length) {
    return platforms.map((p) => ({
      platform: p,
      success: false,
      error: 'compte non connecte',
    }))
  }

  const results = await publishToPlatforms({
    videoUrl: params.videoUrl,
    caption: `${params.title}\n\n${params.description}`,
    hashtags: params.hashtags,
    platforms: platforms.filter((p) => accountIds[p]),
    accountIds: accountIds as Record<SocialPlatform, string>,
    scheduledAt: params.scheduledFor,
    idempotencyKey: params.idempotencyKey,
  })

  // Include disconnected requested platforms so callers cannot report full success.
  return [
    ...results,
    ...missing.map((platform) => ({
      platform,
      success: false,
      error: 'compte non connecte',
    })),
  ]
}

// Functions analyzePerformance, loadAutoContext, recordMemory
// are re-exported from sutra-auto-helpers.ts

/** Manual and cron use the same durable journal; reconciliation requires no
 * new publication authority and therefore remains possible after revocation. */
export async function publishAutoVideoRecord(
  userId: string,
  videoId: string,
  explicitApproval: boolean,
  service = createServiceClient(),
  publish = publishAutoVideo,
  gateway: Partial<PublicationGateway> = {},
  reconcileOnly = false,
) {
  const read = () => service.from('sutra_auto_videos').select('*').eq('id', videoId).eq('user_id', userId).maybeSingle()
  const { data: video, error: videoError } = await read()
  if (videoError) throw new Error('Lecture video impossible')
  if (!video || !['ready', 'pending_approval', 'publishing', 'partially_published', 'published', 'failed'].includes(video.status)) {
    throw new Error('Video non publiable')
  }
  const { data: config, error: configError } = await service.from('sutra_auto_config')
    .select('*').eq('user_id', userId).single()
  if (configError || !config) throw new Error('Configuration publication indisponible')
  const verify = async (expectedHash?: string) => {
    const current = await read()
    if (current.error || !current.data || !current.data.video_final_url || current.data.video_final_url !== video.video_final_url) throw new Error('SUTRA_MEDIA_CHANGED')
    if (!['ready', 'pending_approval', 'publishing', 'partially_published', 'published', 'failed'].includes(current.data.status)) throw new Error('SUTRA_APPROVAL_REVOKED')
    const { data: completedJob, error: jobError } = await service.from('video_jobs').select('progress')
      .eq('user_id', userId).eq('kind', 'auto').eq('status', 'done')
      .contains('payload', { input: { videoRowId: videoId } }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const verification = completedJob?.progress?.steps?.assembly?.verification
    if (jobError || verification?.url !== current.data.video_final_url || !/^[a-f\d]{64}$/.test(verification?.sha256 ?? '')) throw new Error('SUTRA_PUBLICATION_MEDIA_VERIFICATION_REQUIRED')
    if (expectedHash && verification.sha256 !== expectedHash) throw new Error('SUTRA_MEDIA_CHANGED')
    const liveConfig = await service.from('sutra_auto_config').select('*').eq('user_id', userId).single()
    if (liveConfig.error || !liveConfig.data) throw new Error('Configuration publication indisponible')
    const currentConfig = liveConfig.data
    const due = Date.parse(current.data.scheduled_for ?? '')
    if (!reconcileOnly && !explicitApproval && (!currentConfig.is_active || !currentConfig.auto_publish || currentConfig.require_approval_before_publish
      || current.data.status === 'pending_approval' || !Number.isFinite(due) || due > (gateway.now ?? Date.now)())) {
      throw new Error('SUTRA_AUTO_PUBLICATION_NOT_AUTHORIZED')
    }
    return verification.sha256 as string
  }
  const verifiedSha256 = await verify()
  const platforms = [...new Set((config.publish_platforms ?? []).map((p: string) => PLATFORM_ALIASES[p] ?? p))] as SocialPlatform[]
  const outcome = await runPublicationJournal({ userId, productionId: videoId, kind: 'auto', platforms,
    request: { videoUrl: video.video_final_url, verifiedSha256, caption: `${video.title ?? ''}\n\n${video.description ?? ''}`, hashtags: video.hashtags ?? [] },
    legacyResults: video.published_platforms ?? [],
    legacyUncertain: ['publishing', 'published', 'partially_published'].includes(video.status),
    reconcileOnly, retryFailed: explicitApproval,
    authorize: async request => {
      await verify(request.verifiedSha256)
      if (request.videoUrl !== video.video_final_url) throw new Error('SUTRA_MEDIA_CHANGED')
      const live = await service.from('sutra_auto_config').select('publish_platforms').eq('user_id', userId).single()
      const allowed = (live.data?.publish_platforms ?? []).map((p: string) => PLATFORM_ALIASES[p] ?? p)
      if (live.error || request.platforms.some(p => !allowed.includes(p))) throw new Error('SUTRA_DESTINATION_REVOKED')
    },
  }, service, { ...gateway, publish: gateway.publish ?? (async request => publish({
    config: { ...config, publish_platforms: request.platforms,
      zernio_connected_platforms: request.platforms.map(platform => ({ platform, account_id: request.accountIds[platform], username: '' })) } as AutoConfig,
    videoUrl: request.videoUrl, title: video.title ?? '', description: video.description ?? '', hashtags: request.hashtags,
    idempotencyKey: request.idempotencyKey,
  })) })
  // Do not rewrite ambiguous legacy evidence as an empty journal.
  if ('reconciliationRequired' in outcome) return outcome
  const successes = outcome.results.filter(result => result.status === 'published' && result.success).length
  const status = outcome.status === 'scheduled' ? 'publishing' : outcome.status
  const saved = await service.from('sutra_auto_videos').update({ status,
    published_at: successes ? video.published_at ?? new Date((gateway.now ?? Date.now)()).toISOString() : null,
    published_platforms: outcome.results,
    error_message: outcome.results.map(r => r.error).filter(Boolean).join(' | ') || null,
  }).eq('id', videoId).eq('user_id', userId).eq('status', video.status)
    .eq('video_final_url', video.video_final_url).select('id').maybeSingle()
  if (saved.error || !saved.data) throw new Error('SUTRA_RECONCILIATION_REQUIRED: projection auto non enregistree')
  await savePublicationHistory(userId, videoId, outcome.operations, service, 'auto')
  return { ...outcome, status }
}
