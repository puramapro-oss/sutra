import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import {
  publishToPlatforms,
  schedulePublication,
  getOptimalFormat,
  type SocialPlatform,
  type PublishResult,
  type PublishRequest,
} from '@/lib/zernio'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const socialPublishSchema = z.object({
  videoId: z.string().uuid('videoId invalide'),
  platforms: z
    .array(
      z.enum([
        'tiktok',
        'youtube',
        'instagram',
        'facebook',
        'x',
        'linkedin',
        'pinterest',
        'reddit',
        'threads',
        'snapchat',
        'tumblr',
        'mastodon',
        'bluesky',
        'vimeo',
      ])
    )
    .min(1, 'Au moins une plateforme requise'),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
})

function createPublicServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = socialPublishSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { videoId, platforms, title, description, tags, scheduledAt } = parsed.data
    const typedPlatforms = platforms as SocialPlatform[]
    const serviceClient = createServiceClient()

    // Fetch video details
    const { data: video } = await serviceClient
      .from('videos')
      .select('id, title, description, tags, video_url, status, user_id')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (!video) {
      return NextResponse.json({ error: 'Video introuvable' }, { status: 404 })
    }

    if (video.status !== 'ready' && video.status !== 'published') {
      return NextResponse.json(
        { error: 'La video doit etre prete avant publication' },
        { status: 400 }
      )
    }

    if (!video.video_url) {
      return NextResponse.json({ error: 'URL video manquante' }, { status: 400 })
    }

    const publishTitle = title ?? video.title ?? 'Video SUTRA'
    const publishDesc = description ?? video.description ?? ''
    const publishTags = tags ?? video.tags ?? []

    // Fetch connected account IDs
    const publicService = createPublicServiceClient()
    const { data: accounts } = await publicService
      .from('social_accounts')
      .select('id, platform, status')
      .eq('user_id', user.id)
      .in('platform', typedPlatforms)
      .eq('status', 'connected')

    const accountIds = {} as Record<SocialPlatform, string>
    for (const a of accounts ?? []) {
      accountIds[a.platform as SocialPlatform] = a.id as string
    }

    const caption = [publishTitle, publishDesc].filter(Boolean).join('\n\n')
    const hashtags = publishTags.map((t: string) =>
      t.startsWith('#') ? t : `#${t}`
    )

    const primaryFormat = getOptimalFormat(typedPlatforms[0])

    const publishReq: PublishRequest = {
      videoUrl: video.video_url,
      caption,
      hashtags,
      platforms: typedPlatforms,
      accountIds,
      scheduledAt,
      format: primaryFormat,
    }

    let results: PublishResult[]

    if (scheduledAt) {
      results = await schedulePublication(publishReq)

      const posts = results.map((r) => ({
        user_id: user.id,
        video_id: videoId,
        platform: r.platform,
        scheduled_at: scheduledAt,
        status: r.success ? ('scheduled' as const) : ('failed' as const),
        platform_post_id: r.postId ?? null,
      }))

      await serviceClient.from('scheduled_posts').insert(posts)
    } else {
      results = await publishToPlatforms(publishReq)

      const posts = results.map((r) => ({
        user_id: user.id,
        video_id: videoId,
        platform: r.platform,
        scheduled_at: new Date().toISOString(),
        status: r.success ? ('published' as const) : ('failed' as const),
        platform_post_id: r.postId ?? r.postUrl ?? null,
      }))

      await serviceClient.from('scheduled_posts').insert(posts)

      // Update video status if at least one succeeded
      const anySuccess = results.some((r) => r.success)
      if (anySuccess) {
        await serviceClient
          .from('videos')
          .update({
            status: 'published',
            publish_data: {
              platforms,
              published_at: new Date().toISOString(),
            },
          })
          .eq('id', videoId)
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur publication sociale', details: message },
      { status: 500 }
    )
  }
}
