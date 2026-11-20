import { assertCronAuth } from '@/lib/cron-auth'
/**
 * CRON quotidien (22h)
 * Pour chaque user actif, recupere les stats de ses videos publiees
 * dans les 48 dernieres heures et genere des insights memoriels.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzePerformance, recordMemory, type AutoVideoRecord } from '@/lib/sutra-auto'
import { getAccountAnalytics, getAuthorizedProfileId, PLATFORM_INFO, type SocialPlatform } from '@/lib/zernio'

export const maxDuration = 300

export async function GET(request: Request) {
  const authError = assertCronAuth(request)
  if (authError) return authError

  const supabase = createServiceClient()
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data: configs, error: configError, count: configCount } = await supabase
    .from('sutra_auto_config')
    .select('user_id', { count: 'exact' })
    .eq('is_active', true)
  if (configError || !Array.isArray(configs) || configCount !== configs.length) {
    return NextResponse.json({ status: 'unavailable', error: 'SUTRA_ANALYTICS_SCOPE_UNAVAILABLE' }, { status: 503 })
  }

  const summaries: Array<{ user_id: string; insights_count: number; videos_updated: number; videos_skipped: number; status: string }> = []

  for (const c of configs) {
    const userId = c.user_id
    const summary = { user_id: userId, insights_count: 0, videos_updated: 0, videos_skipped: 0, status: 'ok' }
    summaries.push(summary)
    const [videoRead, accountRead] = await Promise.all([
      supabase.from('sutra_auto_videos').select('*', { count: 'exact' }).eq('user_id', userId)
        .eq('status', 'published').gte('published_at', since),
      supabase.schema('public').from('social_accounts')
        .select('id,platform,external_id,status,token_expires_at,metadata', { count: 'exact' }).eq('user_id', userId),
    ])
    if (videoRead.error || accountRead.error || !Array.isArray(videoRead.data) || !Array.isArray(accountRead.data)
      || videoRead.count !== videoRead.data.length || accountRead.count !== accountRead.data.length) {
      summary.status = 'unavailable'; continue
    }
    const verified: AutoVideoRecord[] = []
    for (const video of videoRead.data) {
      try {
        const platforms = video.published_platforms as Array<{
          platform: SocialPlatform; postId?: string; accountId?: string; account_id?: string
          localAccountId?: string; status?: string; success?: boolean
        }> | null
        if (!Array.isArray(platforms) || !platforms.length || platforms.length > 50
          || video.updated_at === undefined) throw new Error('SUTRA_ANALYTICS_IDENTITY_REQUIRED')
        const profileId = getAuthorizedProfileId(userId)
        const seen = new Set<string>()
        const destinations = platforms.map(p => {
          const accountId = p?.accountId ?? p?.account_id
          if (!p || !Object.hasOwn(PLATFORM_INFO, p.platform) || !p.postId || !accountId
            || (p.accountId && p.account_id && p.accountId !== p.account_id)
            || p.success !== true || (p.status !== undefined && p.status !== 'published')) throw new Error('SUTRA_ANALYTICS_IDENTITY_REQUIRED')
          const key = JSON.stringify([p.platform, accountId, p.postId])
          if (seen.has(key)) throw new Error('SUTRA_ANALYTICS_DUPLICATE_DESTINATION')
          seen.add(key)
          const matches = accountRead.data.filter(account => account.platform === p.platform && account.external_id === accountId
            && (!p.localAccountId || p.localAccountId === account.id))
          const account = matches.length === 1 ? matches[0] : undefined
          if (!account || account.status !== 'connected' || account.metadata?.sutra_revocation_pending === true
            || account.metadata?.credential_owner !== 'zernio' || account.metadata?.zernio_profile_id !== profileId
            || (account.token_expires_at && !(Date.parse(account.token_expires_at) > Date.now()))) throw new Error('SUTRA_ANALYTICS_ACCOUNT_UNAVAILABLE')
          return { platform: p.platform, accountId, postId: p.postId, localAccountId: account.id }
        })
        const totals = { views: 0, likes: 0, comments: 0, shares: 0 }
        const observations = []
        for (const destination of destinations) {
          const stats = await getAccountAnalytics(destination.platform, destination.accountId, destination.postId, userId)
          observations.push(stats)
          for (const key of ['views', 'likes', 'comments', 'shares'] as const) totals[key] += stats[key]
        }
        // A disconnect or changed owner while the provider request was pending
        // invalidates this batch's measurements before persistence or learning.
        const live = await supabase.schema('public').from('social_accounts')
          .select('id,platform,external_id,status,token_expires_at,metadata', { count: 'exact' })
          .eq('user_id', userId).in('id', destinations.map(destination => destination.localAccountId))
        if (live.error || !Array.isArray(live.data) || live.count !== live.data.length
          || getAuthorizedProfileId(userId) !== profileId || destinations.some(destination => {
            const matches = live.data.filter(account => account.id === destination.localAccountId
              && account.platform === destination.platform && account.external_id === destination.accountId)
            const account = matches.length === 1 ? matches[0] : undefined
            return !account || account.status !== 'connected' || account.metadata?.sutra_revocation_pending === true
              || account.metadata?.credential_owner !== 'zernio' || account.metadata?.zernio_profile_id !== profileId
              || (account.token_expires_at && !(Date.parse(account.token_expires_at) > Date.now()))
          })) throw new Error('SUTRA_ANALYTICS_ACCOUNT_UNAVAILABLE')
        // Preserve the existing INTEGER columns; never round/wrap an overflow.
        if (Object.values(totals).some(value => !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647)) throw new Error('SUTRA_ANALYTICS_STORAGE_LIMIT')
        // A provider rate may use impressions, even when video views are zero.
        // Across accounts, do not invent a denominator for an unavailable view count.
        const providerRate = observations.length === 1 ? observations[0].engagementRate : undefined
        const rawEngagement = providerRate ?? (observations.every(stats => stats.views > 0)
          ? (totals.likes + totals.comments + totals.shares) / totals.views * 100 : null)
        const engagement = rawEngagement === null ? null : Number(rawEngagement.toFixed(2))
        if (engagement !== null && engagement > 999.99) throw new Error('SUTRA_ANALYTICS_STORAGE_LIMIT')
        const metrics = { ...totals, engagement_rate: engagement }
        let write = supabase.from('sutra_auto_videos').update(metrics).eq('id', video.id).eq('user_id', userId)
          .eq('status', 'published').eq('published_platforms', JSON.stringify(platforms))
        write = video.updated_at === null ? write.is('updated_at', null) : write.eq('updated_at', video.updated_at)
        const saved = await write.select('id').maybeSingle()
        if (saved.error || !saved.data) throw new Error('SUTRA_ANALYTICS_UPDATE_UNCONFIRMED')
        verified.push({ ...video, ...metrics } as AutoVideoRecord)
        summary.videos_updated++
      } catch {
        // A missing account, pending sync or failed destination is not zero.
        // Preserve the whole previous aggregate and exclude it from learning.
        summary.videos_skipped++; summary.status = 'partial'
      }
    }
    if (!verified.length) continue
    try {
      // Do not reread unverified/stale rows back into this batch's AI input.
      const insights = await analyzePerformance({ userId, recentVideos: verified })
      for (const insight of insights) {
        const saved = await recordMemory({ userId, type: 'learning', content: insight, importance: 0.8, expiresInDays: 30 })
        if (!saved) throw new Error('SUTRA_LEARNING_MEMORY_UNCONFIRMED')
        summary.insights_count++
      }
    } catch {
      summary.status = 'partial'
    }
  }

  return NextResponse.json({ status: summaries.some(summary => summary.status !== 'ok') ? 'partial' : 'ok', users_processed: summaries.length, summaries })
}
