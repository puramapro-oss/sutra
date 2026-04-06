import { fetchWithRetry } from '@/lib/utils/api'

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY ?? ''
const ZERNIO_BASE = process.env.ZERNIO_BASE_URL ?? 'https://zernio.com/api/v1'
const IS_DEV = process.env.NODE_ENV !== 'production'

export type SocialPlatform =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'pinterest'
  | 'reddit'
  | 'threads'
  | 'snapchat'
  | 'tumblr'
  | 'mastodon'
  | 'bluesky'
  | 'vimeo'

export interface OAuthUrlResponse {
  url: string
  state: string
}

export interface AccountProfile {
  platform: SocialPlatform
  externalId: string
  username: string
  displayName: string
  avatarUrl?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string
}

export interface PublishRequest {
  videoUrl: string
  caption: string
  hashtags: string[]
  platforms: SocialPlatform[]
  accountIds: Record<SocialPlatform, string>
  scheduledAt?: string
  format?: string
}

export interface PublishResult {
  platform: SocialPlatform
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
}

export interface AnalyticsData {
  views: number
  likes: number
  shares: number
  comments: number
  engagementRate?: number
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

function logError(context: string, err: unknown): void {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.error(`[zernio:${context}]`, err instanceof Error ? err.message : err)
  }
}

export async function getOAuthUrl(
  platform: SocialPlatform,
  userId: string,
  redirectUri: string
): Promise<OAuthUrlResponse> {
  try {
    const qs = new URLSearchParams({
      platform,
      user_id: userId,
      redirect_uri: redirectUri,
    })
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/oauth/url?${qs.toString()}`,
      { method: 'GET', headers: headers() },
      2
    )
    if (!res.ok) {
      logError('getOAuthUrl', `HTTP ${res.status}`)
      return { url: '', state: '' }
    }
    const data = await res.json()
    return {
      url: String(data.url ?? ''),
      state: String(data.state ?? ''),
    }
  } catch (err) {
    logError('getOAuthUrl', err)
    return { url: '', state: '' }
  }
}

export async function exchangeOAuthCode(
  platform: SocialPlatform,
  code: string,
  state: string
): Promise<AccountProfile> {
  const empty: AccountProfile = {
    platform,
    externalId: '',
    username: '',
    displayName: '',
  }
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/oauth/exchange`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ platform, code, state }),
      },
      2
    )
    if (!res.ok) {
      logError('exchangeOAuthCode', `HTTP ${res.status}`)
      return empty
    }
    const data = await res.json()
    return {
      platform,
      externalId: String(data.external_id ?? data.externalId ?? ''),
      username: String(data.username ?? ''),
      displayName: String(data.display_name ?? data.displayName ?? data.username ?? ''),
      avatarUrl: data.avatar_url ?? data.avatarUrl,
      accessToken: data.access_token ?? data.accessToken,
      refreshToken: data.refresh_token ?? data.refreshToken,
      tokenExpiresAt: data.token_expires_at ?? data.tokenExpiresAt,
    }
  } catch (err) {
    logError('exchangeOAuthCode', err)
    return empty
  }
}

function buildPublishPayload(req: PublishRequest): Record<string, unknown> {
  return {
    video_url: req.videoUrl,
    caption: req.caption,
    hashtags: req.hashtags,
    platforms: req.platforms,
    account_ids: req.accountIds,
    scheduled_at: req.scheduledAt,
    format: req.format,
  }
}

async function callPublishEndpoint(
  endpoint: 'publish' | 'schedule',
  req: PublishRequest
): Promise<PublishResult[]> {
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/${endpoint}`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(buildPublishPayload(req)),
      },
      3
    )
    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      logError(endpoint, `HTTP ${res.status}: ${errText}`)
      return req.platforms.map((platform) => ({
        platform,
        success: false,
        error: `Zernio ${endpoint} error ${res.status}`,
      }))
    }
    const data = await res.json()
    const results = (data.results ?? []) as Array<{
      platform: SocialPlatform
      success: boolean
      post_id?: string
      postId?: string
      post_url?: string
      postUrl?: string
      error?: string
    }>
    return results.map((r) => ({
      platform: r.platform,
      success: Boolean(r.success),
      postId: r.post_id ?? r.postId,
      postUrl: r.post_url ?? r.postUrl,
      error: r.error,
    }))
  } catch (err) {
    logError(endpoint, err)
    const message = err instanceof Error ? err.message : `Erreur reseau Zernio ${endpoint}`
    return req.platforms.map((platform) => ({
      platform,
      success: false,
      error: message,
    }))
  }
}

export async function publishToPlatforms(req: PublishRequest): Promise<PublishResult[]> {
  return callPublishEndpoint('publish', req)
}

export async function schedulePublication(req: PublishRequest): Promise<PublishResult[]> {
  return callPublishEndpoint('schedule', req)
}

export async function getAccountAnalytics(
  platform: SocialPlatform,
  accountId: string,
  postId: string
): Promise<AnalyticsData> {
  const empty: AnalyticsData = { views: 0, likes: 0, shares: 0, comments: 0 }
  try {
    const qs = new URLSearchParams({
      platform,
      account_id: accountId,
      post_id: postId,
    })
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/analytics?${qs.toString()}`,
      { method: 'GET', headers: headers() },
      2
    )
    if (!res.ok) {
      logError('getAccountAnalytics', `HTTP ${res.status}`)
      return empty
    }
    const data = await res.json()
    return {
      views: Number(data.views ?? 0),
      likes: Number(data.likes ?? 0),
      shares: Number(data.shares ?? 0),
      comments: Number(data.comments ?? 0),
      engagementRate:
        data.engagement_rate !== undefined
          ? Number(data.engagement_rate)
          : data.engagementRate !== undefined
            ? Number(data.engagementRate)
            : undefined,
    }
  } catch (err) {
    logError('getAccountAnalytics', err)
    return empty
  }
}

export async function deletePost(
  platform: SocialPlatform,
  accountId: string,
  postId: string
): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ platform, account_id: accountId })
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/posts/${encodeURIComponent(postId)}?${qs.toString()}`,
      { method: 'DELETE', headers: headers() },
      2
    )
    return res.ok
  } catch (err) {
    logError('deletePost', err)
    return false
  }
}

export async function disconnectAccount(
  platform: SocialPlatform,
  accountId: string
): Promise<boolean> {
  try {
    const qs = new URLSearchParams({ platform })
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/accounts/${encodeURIComponent(accountId)}?${qs.toString()}`,
      { method: 'DELETE', headers: headers() },
      2
    )
    return res.ok
  } catch (err) {
    logError('disconnectAccount', err)
    return false
  }
}

export async function refreshAccessToken(
  platform: SocialPlatform,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string }> {
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/oauth/refresh`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ platform, refresh_token: refreshToken }),
      },
      2
    )
    if (!res.ok) {
      logError('refreshAccessToken', `HTTP ${res.status}`)
      return { accessToken: '', expiresAt: '' }
    }
    const data = await res.json()
    return {
      accessToken: String(data.access_token ?? data.accessToken ?? ''),
      expiresAt: String(data.expires_at ?? data.expiresAt ?? ''),
    }
  } catch (err) {
    logError('refreshAccessToken', err)
    return { accessToken: '', expiresAt: '' }
  }
}

export function getOptimalFormat(platform: SocialPlatform): string {
  const formats: Record<SocialPlatform, string> = {
    tiktok: '9:16',
    youtube: '16:9',
    instagram: '1:1',
    facebook: '16:9',
    x: '16:9',
    linkedin: '16:9',
    pinterest: '1:1',
    reddit: '16:9',
    threads: '9:16',
    snapchat: '9:16',
    tumblr: '1:1',
    mastodon: '16:9',
    bluesky: '16:9',
    vimeo: '16:9',
  }
  return formats[platform]
}

export const PLATFORM_INFO: Record<
  SocialPlatform,
  { label: string; color: string; icon: string; bgColor: string; description: string }
> = {
  tiktok: {
    label: 'TikTok',
    color: '#FF0050',
    icon: '🎵',
    bgColor: 'from-[#FF0050] to-[#00F2EA]',
    description: 'Videos courtes virales, format 9:16, audience jeune et tendance',
  },
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    icon: '▶️',
    bgColor: 'from-[#FF0000] to-[#CC0000]',
    description: 'Videos longues format 16:9, monetisation et SEO puissant',
  },
  instagram: {
    label: 'Instagram',
    color: '#E4405F',
    icon: '📸',
    bgColor: 'from-[#F58529] via-[#DD2A7B] to-[#8134AF]',
    description: 'Reels, Stories et feed, esthetique visuelle et engagement',
  },
  facebook: {
    label: 'Facebook',
    color: '#1877F2',
    icon: '👥',
    bgColor: 'from-[#1877F2] to-[#0C5ECF]',
    description: 'Audience large et diversifiee, ideal pour communautes',
  },
  x: {
    label: 'X',
    color: '#000000',
    icon: '𝕏',
    bgColor: 'from-black to-gray-800',
    description: 'Texte court, viralite temps reel et conversation publique',
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    icon: '💼',
    bgColor: 'from-[#0A66C2] to-[#004182]',
    description: 'Reseau professionnel, B2B, expertise et thought leadership',
  },
  pinterest: {
    label: 'Pinterest',
    color: '#E60023',
    icon: '📌',
    bgColor: 'from-[#E60023] to-[#AD081B]',
    description: 'Decouverte visuelle, trafic long terme, inspiration et DIY',
  },
  reddit: {
    label: 'Reddit',
    color: '#FF4500',
    icon: '👾',
    bgColor: 'from-[#FF4500] to-[#CC3700]',
    description: 'Communautes de niche, discussions authentiques et virales',
  },
  threads: {
    label: 'Threads',
    color: '#000000',
    icon: '🧵',
    bgColor: 'from-gray-900 to-black',
    description: 'Microblog Meta, conversations textuelles et croissance rapide',
  },
  snapchat: {
    label: 'Snapchat',
    color: '#FFFC00',
    icon: '👻',
    bgColor: 'from-[#FFFC00] to-[#FFE600]',
    description: 'Stories ephemeres et Spotlight, audience Gen Z',
  },
  tumblr: {
    label: 'Tumblr',
    color: '#36465D',
    icon: '📝',
    bgColor: 'from-[#36465D] to-[#001935]',
    description: 'Microblog creatif, fandoms et culture alternative',
  },
  mastodon: {
    label: 'Mastodon',
    color: '#6364FF',
    icon: '🐘',
    bgColor: 'from-[#6364FF] to-[#563ACC]',
    description: 'Reseau decentralise, communautes tech et libertes numeriques',
  },
  bluesky: {
    label: 'Bluesky',
    color: '#0085FF',
    icon: '☁️',
    bgColor: 'from-[#0085FF] to-[#0066CC]',
    description: 'Microblog decentralise, audience early adopters et tech',
  },
  vimeo: {
    label: 'Vimeo',
    color: '#1AB7EA',
    icon: '🎬',
    bgColor: 'from-[#1AB7EA] to-[#162221]',
    description: 'Video haut de gamme, createurs pros et portfolio cinema',
  },
}
