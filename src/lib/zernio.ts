import { fetchWithRetry } from '@/lib/utils/api'

const ZERNIO_BASE = process.env.ZERNIO_BASE_URL ?? 'https://zernio.com/api/v1'

export type SocialPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'x' | 'linkedin' | 'pinterest' | 'reddit' | 'threads' | 'snapchat' | 'tumblr' | 'mastodon' | 'bluesky' | 'vimeo'

export interface OAuthUrlResponse { url: string; state: string }
export interface AccountProfile { platform: SocialPlatform; externalId: string; username: string; displayName: string; avatarUrl?: string; accessToken?: string; refreshToken?: string; tokenExpiresAt?: string }
export interface PublishRequest { videoUrl: string; providerMediaUrl?: string; verifiedSha256?: string; caption: string; hashtags: string[]; platforms: SocialPlatform[]; accountIds: Record<SocialPlatform, string>; scheduledAt?: string; format?: string; idempotencyKey?: string; captionsByPlatform?: Partial<Record<SocialPlatform, { caption: string; hashtags: string[] }>> }
export type PublicationStatus = 'published' | 'scheduled' | 'publishing' | 'failed' | 'unknown'
export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  published: 'Publie', scheduled: 'Programme', publishing: 'En cours', failed: 'Echec', unknown: 'A verifier',
}
export interface PublishResult { platform: SocialPlatform; accountId?: string; success: boolean; status?: PublicationStatus; postId?: string; postUrl?: string; externalPostId?: string; publishedAt?: string; error?: string }
export interface AnalyticsData { views: number; likes: number; shares: number; comments: number; engagementRate?: number }

function headers(): HeadersInit {
  const key = process.env.ZERNIO_API_KEY?.trim()
  if (!key) throw new Error('SUTRA_ZERNIO_NOT_CONFIGURED')
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}
// Toujours logger (prod inclus) : une erreur Zernio avalée silencieusement en
// prod = publication sociale qui échoue sans aucune trace. Jamais de secret.
function logError(context: string, err: unknown): void { void err; console.error(`[zernio:${context}]`, 'SUTRA_PROVIDER_REQUEST_FAILED') }

export async function getOAuthUrl(platform: SocialPlatform, userId: string, redirectUri: string): Promise<OAuthUrlResponse> {
  try {
    const qs = new URLSearchParams({ platform, user_id: userId, redirect_uri: redirectUri })
    const res = await fetchWithRetry(`${ZERNIO_BASE}/oauth/url?${qs.toString()}`, { method: 'GET', headers: headers() }, 2)
    if (!res.ok) { logError('getOAuthUrl', `HTTP ${res.status}`); return { url: '', state: '' } }
    const data = await res.json()
    return { url: String(data.url ?? ''), state: String(data.state ?? '') }
  } catch (err) { logError('getOAuthUrl', err); return { url: '', state: '' } }
}

export async function exchangeOAuthCode(platform: SocialPlatform, code: string, state: string): Promise<AccountProfile> {
  const empty: AccountProfile = { platform, externalId: '', username: '', displayName: '' }
  try {
    const res = await fetchWithRetry(`${ZERNIO_BASE}/oauth/exchange`, { method: 'POST', headers: headers(), body: JSON.stringify({ platform, code, state }) }, 2)
    if (!res.ok) { logError('exchangeOAuthCode', `HTTP ${res.status}`); return empty }
    const data = await res.json()
    return { platform, externalId: String(data.external_id ?? data.externalId ?? ''), username: String(data.username ?? ''), displayName: String(data.display_name ?? data.displayName ?? data.username ?? ''), avatarUrl: data.avatar_url ?? data.avatarUrl, accessToken: data.access_token ?? data.accessToken, refreshToken: data.refresh_token ?? data.refreshToken, tokenExpiresAt: data.token_expires_at ?? data.tokenExpiresAt }
  } catch (err) { logError('exchangeOAuthCode', err); return empty }
}

const SUPPORTED_PUBLICATION_PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin', 'pinterest', 'reddit', 'threads', 'bluesky'])
const providerPlatform = (platform: SocialPlatform) => platform === 'x' ? 'twitter' : platform
const contentWithTags = (caption: string, tags: string[]) => [caption, tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ')].filter(Boolean).join('\n\n')
function publicPostUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}

export function buildPublishPayload(req: PublishRequest): Record<string, unknown> {
  const platforms = [...new Set(req.platforms)]
  if (!platforms.length || platforms.some(p => !SUPPORTED_PUBLICATION_PLATFORMS.has(p))) throw new Error('SUTRA_ZERNIO_PLATFORM_UNAVAILABLE')
  // Zernio account IDs are provider IDs, never the UUID of public.social_accounts.
  if (platforms.some(p => !/^[a-f\d]{24}$/i.test(req.accountIds[p] ?? ''))) throw new Error('SUTRA_ZERNIO_ACCOUNT_RECONNECTION_REQUIRED')
  const url = new URL(req.providerMediaUrl ?? req.videoUrl)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('SUTRA_ZERNIO_INVALID_MEDIA_URL')
  if (!req.idempotencyKey || req.idempotencyKey.length > 255) throw new Error('SUTRA_ZERNIO_IDEMPOTENCY_REQUIRED')
  if (req.scheduledAt && (!/(Z|[+-]\d\d:\d\d)$/.test(req.scheduledAt) || !Number.isFinite(Date.parse(req.scheduledAt)) || Date.parse(req.scheduledAt) <= Date.now())) {
    // Provider silently publishes a past schedule immediately. Refuse that change of intent.
    throw new Error('SUTRA_ZERNIO_SCHEDULE_MUST_BE_FUTURE')
  }
  return { content: contentWithTags(req.caption, req.hashtags), mediaItems: [{ type: 'video', url: req.providerMediaUrl ?? req.videoUrl }],
    platforms: platforms.map(platform => ({ platform: providerPlatform(platform), accountId: req.accountIds[platform],
      ...(req.captionsByPlatform?.[platform] ? { customContent: contentWithTags(req.captionsByPlatform[platform]!.caption, req.captionsByPlatform[platform]!.hashtags) } : {}),
    })), ...(req.scheduledAt ? { scheduledFor: req.scheduledAt } : { publishNow: true }),
  }
}

/** Accepted, scheduled and partially published are not a global publication success. */
export function parsePublicationResults(data: unknown, req: PublishRequest): PublishResult[] {
  const post = (data as { post?: { _id?: unknown; status?: string; platforms?: Array<{ platform?: string; accountId?: string | { _id?: string }; status?: string; platformPostUrl?: string; platformPostId?: string; publishedAt?: string }> } })?.post
  if (typeof post?._id !== 'string' || !/^[a-f\d]{24}$/i.test(post._id)) throw new Error('SUTRA_RECONCILIATION_REQUIRED: reponse publication sans identifiant')
  return [...new Set(req.platforms)].map(platform => {
    const matches = post.platforms?.filter(target => target.platform === providerPlatform(platform)
      && (typeof target.accountId === 'string' ? target.accountId : target.accountId?._id) === req.accountIds[platform]) ?? []
    const target = matches.length === 1 ? matches[0] : undefined
    const status: PublicationStatus = target?.status === 'published' ? 'published'
      : target?.status === 'failed' ? 'failed'
      : post.status === 'scheduled' && target?.status === 'pending' ? 'scheduled'
      : target && ['pending', 'processing', 'uploading', 'publishing'].includes(target.status ?? '') ? 'publishing' : 'unknown'
    return { platform, accountId: req.accountIds[platform], status, success: status === 'published', postId: post._id as string,
      postUrl: publicPostUrl(target?.platformPostUrl), externalPostId: target?.platformPostId,
      publishedAt: target?.publishedAt && Number.isFinite(Date.parse(target.publishedAt)) ? target.publishedAt : undefined,
      ...(status === 'failed' ? { error: 'Publication refusee par la plateforme' } : status === 'unknown' ? { error: 'Resultat distant a reconcilier' } : {}),
    }
  })
}

export async function publishToPlatforms(req: PublishRequest): Promise<PublishResult[]> {
  const body = buildPublishPayload(req)
  const auth = headers()
  try {
    const res = await fetchWithRetry(`${ZERNIO_BASE}/posts`, { method: 'POST', headers: auth,
      body: JSON.stringify(body), idempotencyKey: req.idempotencyKey, providerSupportsIdempotency: true,
      redirect: 'error', timeoutMs: 90_000 }, 1)
    if (!res.ok) throw new Error(`SUTRA_ZERNIO_HTTP_${res.status}`)
    return parsePublicationResults(await res.json(), req)
  } catch {
    // An ambiguous request remains unresolved; never translate a transport error into "failed, retry".
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: publication distante non confirmee')
  }
}
/** Replays only the original request; the durable caller enforces the 24h window. */
export async function replayPublication(req: PublishRequest): Promise<PublishResult[]> {
  return publishToPlatforms(req)
}

/** The original post owns the destination set. Zernio skips published targets. */
export async function retryPublication(postId: string, req: PublishRequest): Promise<PublishResult[]> {
  if (!/^[a-f\d]{24}$/i.test(postId)) throw new Error('SUTRA_ZERNIO_INVALID_POST_ID')
  try {
    const res = await fetchWithRetry(`${ZERNIO_BASE}/posts/${postId}/retry`, {
      method: 'POST', headers: headers(), redirect: 'error', timeoutMs: 90_000,
    }, 1)
    if (!res.ok) throw new Error('SUTRA_RECONCILIATION_REQUIRED')
    const data = await res.json()
    if (data?.post?._id !== postId) throw new Error('SUTRA_RECONCILIATION_REQUIRED')
    return parsePublicationResults(data, req)
  } catch { throw new Error('SUTRA_RECONCILIATION_REQUIRED: reprise distante non confirmee') }
}

export async function schedulePublication(req: PublishRequest): Promise<PublishResult[]> {
  if (!req.scheduledAt) throw new Error('SUTRA_ZERNIO_SCHEDULE_REQUIRED')
  return publishToPlatforms(req)
}

export async function getPublicationResults(postId: string, req: PublishRequest): Promise<PublishResult[]> {
  if (!/^[a-f\d]{24}$/i.test(postId)) throw new Error('SUTRA_ZERNIO_INVALID_POST_ID')
  const res = await fetchWithRetry(`${ZERNIO_BASE}/posts/${postId}`, { method: 'GET', headers: headers(), redirect: 'error' }, 2)
    .catch(() => { throw new Error('SUTRA_ZERNIO_STATUS_UNAVAILABLE') })
  if (!res.ok) throw new Error(`SUTRA_ZERNIO_STATUS_HTTP_${res.status}`)
  const data = await res.json().catch(() => { throw new Error('SUTRA_ZERNIO_STATUS_INVALID_RESPONSE') })
  if (data?.post?._id !== postId) throw new Error('SUTRA_RECONCILIATION_REQUIRED: identifiant publication incoherent')
  // /retry replays every failed remote target, so an imported post must have
  // exactly the authorized destination set before the journal may retry it.
  const targets = data.post.platforms as Array<{ platform?: string; accountId?: string | { _id?: string } }> | undefined
  if (!Array.isArray(targets) || targets.length !== req.platforms.length || req.platforms.some(platform =>
    targets.filter(target => target.platform === providerPlatform(platform)
      && (typeof target.accountId === 'string' ? target.accountId : target.accountId?._id) === req.accountIds[platform]).length !== 1)) {
    throw new Error('SUTRA_RECONCILIATION_REQUIRED: destinations distantes incoherentes')
  }
  return parsePublicationResults(data, req)
}

export async function getAccountAnalytics(platform: SocialPlatform, accountId: string, postId: string): Promise<AnalyticsData> {
  const empty: AnalyticsData = { views: 0, likes: 0, shares: 0, comments: 0 }
  try {
    const qs = new URLSearchParams({ platform, account_id: accountId, post_id: postId })
    const res = await fetchWithRetry(`${ZERNIO_BASE}/analytics?${qs.toString()}`, { method: 'GET', headers: headers() }, 2)
    if (!res.ok) { logError('getAccountAnalytics', `HTTP ${res.status}`); return empty }
    const data = await res.json()
    return { views: Number(data.views ?? 0), likes: Number(data.likes ?? 0), shares: Number(data.shares ?? 0), comments: Number(data.comments ?? 0), engagementRate: data.engagement_rate !== undefined ? Number(data.engagement_rate) : data.engagementRate !== undefined ? Number(data.engagementRate) : undefined }
  } catch (err) { logError('getAccountAnalytics', err); return empty }
}

export async function deletePost(platform: SocialPlatform, accountId: string, postId: string): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ platform, account_id: accountId })
    const res = await fetchWithRetry(`${ZERNIO_BASE}/posts/${encodeURIComponent(postId)}?${qs.toString()}`, { method: 'DELETE', headers: headers() }, 2)
    return res.ok
  } catch (err) { logError('deletePost', err); return false }
}

export async function disconnectAccount(platform: SocialPlatform, accountId: string): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ platform })
    const res = await fetchWithRetry(`${ZERNIO_BASE}/accounts/${encodeURIComponent(accountId)}?${qs.toString()}`, { method: 'DELETE', headers: headers() }, 2)
    return res.ok || res.status === 404
  } catch (err) { logError('disconnectAccount', err); return false }
}

export async function refreshAccessToken(platform: SocialPlatform, refreshToken: string): Promise<{ accessToken: string; expiresAt: string }> {
  try {
    const res = await fetchWithRetry(`${ZERNIO_BASE}/oauth/refresh`, { method: 'POST', headers: headers(), body: JSON.stringify({ platform, refresh_token: refreshToken }) }, 2)
    if (!res.ok) { logError('refreshAccessToken', `HTTP ${res.status}`); return { accessToken: '', expiresAt: '' } }
    const data = await res.json()
    return { accessToken: String(data.access_token ?? data.accessToken ?? ''), expiresAt: String(data.expires_at ?? data.expiresAt ?? '') }
  } catch (err) { logError('refreshAccessToken', err); return { accessToken: '', expiresAt: '' } }
}

export function getOptimalFormat(platform: SocialPlatform): string {
  const formats: Record<SocialPlatform, string> = { tiktok: '9:16', youtube: '16:9', instagram: '1:1', facebook: '16:9', x: '16:9', linkedin: '16:9', pinterest: '1:1', reddit: '16:9', threads: '9:16', snapchat: '9:16', tumblr: '1:1', mastodon: '16:9', bluesky: '16:9', vimeo: '16:9' }
  return formats[platform]
}

export const PLATFORM_INFO: Record<SocialPlatform, { label: string; color: string; icon: string; bgColor: string; description: string }> = {
  tiktok: { label: 'TikTok', color: '#FF0050', icon: '🎵', bgColor: 'from-[#FF0050] to-[#00F2EA]', description: 'Videos courtes virales, format 9:16, audience jeune et tendance' },
  youtube: { label: 'YouTube', color: '#FF0000', icon: '▶️', bgColor: 'from-[#FF0000] to-[#CC0000]', description: 'Videos longues format 16:9, monetisation et SEO puissant' },
  instagram: { label: 'Instagram', color: '#E4405F', icon: '📸', bgColor: 'from-[#F58529] via-[#DD2A7B] to-[#8134AF]', description: 'Reels, Stories et feed, esthetique visuelle et engagement' },
  facebook: { label: 'Facebook', color: '#1877F2', icon: '👥', bgColor: 'from-[#1877F2] to-[#0C5ECF]', description: 'Audience large et diversifiee, ideal pour communautes' },
  x: { label: 'X', color: '#000000', icon: '𝕏', bgColor: 'from-black to-gray-800', description: 'Texte court, viralite temps reel et conversation publique' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2', icon: '💼', bgColor: 'from-[#0A66C2] to-[#004182]', description: 'Reseau professionnel, B2B, expertise et thought leadership' },
  pinterest: { label: 'Pinterest', color: '#E60023', icon: '📌', bgColor: 'from-[#E60023] to-[#AD081B]', description: 'Decouverte visuelle, trafic long terme, inspiration et DIY' },
  reddit: { label: 'Reddit', color: '#FF4500', icon: '👾', bgColor: 'from-[#FF4500] to-[#CC3700]', description: 'Communautes de niche, discussions authentiques et virales' },
  threads: { label: 'Threads', color: '#000000', icon: '🧵', bgColor: 'from-gray-900 to-black', description: 'Microblog Meta, conversations textuelles et croissance rapide' },
  snapchat: { label: 'Snapchat', color: '#FFFC00', icon: '👻', bgColor: 'from-[#FFFC00] to-[#FFE600]', description: 'Stories ephemeres et Spotlight, audience Gen Z' },
  tumblr: { label: 'Tumblr', color: '#36465D', icon: '📝', bgColor: 'from-[#36465D] to-[#001935]', description: 'Microblog creatif, fandoms et culture alternative' },
  mastodon: { label: 'Mastodon', color: '#6364FF', icon: '🐘', bgColor: 'from-[#6364FF] to-[#563ACC]', description: 'Reseau decentralise, communautes tech et libertes numeriques' },
  bluesky: { label: 'Bluesky', color: '#0085FF', icon: '☁️', bgColor: 'from-[#0085FF] to-[#0066CC]', description: 'Microblog decentralise, audience early adopters et tech' },
  vimeo: { label: 'Vimeo', color: '#1AB7EA', icon: '🎬', bgColor: 'from-[#1AB7EA] to-[#162221]', description: 'Video haut de gamme, createurs pros et portfolio cinema' }
}
