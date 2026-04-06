/**
 * CRON quotidien (22h)
 * Pour chaque user actif, recupere les stats de ses videos publiees
 * dans les 48 dernieres heures et genere des insights memoriels.
 */
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { analyzePerformance, recordMemory, type AutoVideoRecord } from '@/lib/sutra-auto'
import { getAccountAnalytics, type SocialPlatform } from '@/lib/zernio'

export const maxDuration = 300
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const { data: configs } = await supabase
    .from('sutra_auto_config')
    .select('user_id')
    .eq('is_active', true)

  const summaries: Array<{ user_id: string; insights_count: number }> = []

  for (const c of configs ?? []) {
    const userId = c.user_id

    const { data: videos } = await supabase
      .from('sutra_auto_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'published')
      .gte('published_at', since)

    if (!videos || !videos.length) continue

    // Refresh stats via Zernio (best effort)
    for (const v of videos as AutoVideoRecord[]) {
      const platforms = (v as AutoVideoRecord & {
        published_platforms?: Array<{ platform: SocialPlatform; postId?: string; account_id?: string }>
      }).published_platforms
      if (!platforms) continue
      let totalViews = 0
      let totalLikes = 0
      let totalComments = 0
      let totalShares = 0
      for (const p of platforms) {
        if (!p.postId || !p.account_id) continue
        try {
          const stats = await getAccountAnalytics(p.platform, p.account_id, p.postId)
          totalViews += stats.views
          totalLikes += stats.likes
          totalComments += stats.comments
          totalShares += stats.shares
        } catch {
          // ignore
        }
      }
      const eng = totalViews ? Number(((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)) : 0
      await supabase
        .from('sutra_auto_videos')
        .update({ views: totalViews, likes: totalLikes, comments: totalComments, shares: totalShares, engagement_rate: eng })
        .eq('id', v.id)
    }

    // Re-fetch with updated stats
    const { data: refreshed } = await supabase
      .from('sutra_auto_videos')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'published')
      .gte('published_at', since)

    const insights = await analyzePerformance({
      userId,
      recentVideos: (refreshed ?? []) as AutoVideoRecord[],
    })

    for (const insight of insights) {
      await recordMemory({
        userId,
        type: 'learning',
        content: insight,
        importance: 0.8,
        expiresInDays: 30,
      })
    }

    summaries.push({ user_id: userId, insights_count: insights.length })
  }

  return NextResponse.json({ status: 'ok', users_processed: summaries.length, summaries })
}
