import { fetchWithRetry } from '@/lib/utils/api'

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY ?? ''
const ZERNIO_BASE = process.env.ZERNIO_BASE_URL ?? 'https://zernio.com/api/v1'

export type SocialPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'x' | 'linkedin'

export interface PublishRequest {
  videoUrl: string
  title: string
  description: string
  tags: string[]
  platforms: SocialPlatform[]
  scheduledAt?: string
  format?: string
}

export interface PublishResult {
  platform: SocialPlatform
  success: boolean
  postUrl?: string
  error?: string
}

export interface ConnectedAccount {
  platform: SocialPlatform
  username: string
  connected: boolean
}

export interface PublishHistoryEntry {
  id: string
  platform: SocialPlatform
  title: string
  status: string
  publishedAt: string
  postUrl?: string
}

export interface ScheduleResult {
  scheduleId: string
  scheduledAt: string
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${ZERNIO_API_KEY}`,
    'Content-Type': 'application/json',
  }
}

export async function publishToSocial(req: PublishRequest): Promise<PublishResult[]> {
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/publish`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          video_url: req.videoUrl,
          title: req.title,
          description: req.description,
          tags: req.tags,
          platforms: req.platforms,
          format: req.format,
        }),
      },
      3
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error')
      return req.platforms.map((platform) => ({
        platform,
        success: false,
        error: `Zernio API error ${res.status}: ${errText}`,
      }))
    }

    const data = await res.json()
    return (data.results ?? []) as PublishResult[]
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur reseau Zernio'
    return req.platforms.map((platform) => ({
      platform,
      success: false,
      error: message,
    }))
  }
}

export async function getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/accounts?user_id=${encodeURIComponent(userId)}`,
      { method: 'GET', headers: headers() },
      2
    )

    if (!res.ok) return []
    const data = await res.json()
    return (data.accounts ?? []) as ConnectedAccount[]
  } catch {
    return []
  }
}

export async function schedulePost(req: PublishRequest): Promise<ScheduleResult> {
  const res = await fetchWithRetry(
    `${ZERNIO_BASE}/schedule`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        video_url: req.videoUrl,
        title: req.title,
        description: req.description,
        tags: req.tags,
        platforms: req.platforms,
        scheduled_at: req.scheduledAt,
        format: req.format,
      }),
    },
    3
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    throw new Error(`Zernio schedule error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return {
    scheduleId: data.schedule_id ?? '',
    scheduledAt: data.scheduled_at ?? req.scheduledAt ?? '',
  }
}

export async function getPublishHistory(
  userId: string,
  limit = 20
): Promise<PublishHistoryEntry[]> {
  try {
    const res = await fetchWithRetry(
      `${ZERNIO_BASE}/history?user_id=${encodeURIComponent(userId)}&limit=${limit}`,
      { method: 'GET', headers: headers() },
      2
    )

    if (!res.ok) return []
    const data = await res.json()
    return (data.history ?? []) as PublishHistoryEntry[]
  } catch {
    return []
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
  }
  return formats[platform]
}

export const PLATFORM_INFO: Record<SocialPlatform, { label: string; color: string; icon: string }> = {
  tiktok: { label: 'TikTok', color: 'text-white', icon: '♪' },
  youtube: { label: 'YouTube', color: 'text-red-500', icon: '▶' },
  instagram: { label: 'Instagram', color: 'text-pink-500', icon: '📷' },
  facebook: { label: 'Facebook', color: 'text-blue-500', icon: '👤' },
  x: { label: 'X', color: 'text-white', icon: '𝕏' },
  linkedin: { label: 'LinkedIn', color: 'text-blue-400', icon: '💼' },
}
