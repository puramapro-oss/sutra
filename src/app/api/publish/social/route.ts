import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { publishToSocial, schedulePost, getOptimalFormat } from '@/lib/zernio'
import type { SocialPlatform, PublishResult } from '@/lib/zernio'

const socialPublishSchema = z.object({
  videoId: z.string().uuid('videoId invalide'),
  platforms: z
    .array(z.enum(['tiktok', 'youtube', 'instagram', 'facebook', 'x', 'linkedin']))
    .min(1, 'Au moins une plateforme requise'),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
})

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

    // Determine optimal format for the first platform (or auto per-platform via Zernio)
    const primaryFormat = getOptimalFormat(platforms[0] as SocialPlatform)

    let results: PublishResult[]

    if (scheduledAt) {
      // Schedule via Zernio
      try {
        const scheduleResult = await schedulePost({
          videoUrl: video.video_url,
          title: publishTitle,
          description: publishDesc,
          tags: publishTags,
          platforms: platforms as SocialPlatform[],
          scheduledAt,
          format: primaryFormat,
        })

        results = platforms.map((p) => ({
          platform: p as SocialPlatform,
          success: true,
          postUrl: undefined,
          error: undefined,
        }))

        // Log scheduled posts to DB
        const posts = platforms.map((platform) => ({
          user_id: user.id,
          video_id: videoId,
          platform,
          scheduled_at: scheduledAt,
          status: 'scheduled' as const,
          zernio_schedule_id: scheduleResult.scheduleId,
        }))

        await serviceClient.from('scheduled_posts').insert(posts)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur programmation Zernio'
        results = platforms.map((p) => ({
          platform: p as SocialPlatform,
          success: false,
          error: message,
        }))
      }
    } else {
      // Publish immediately via Zernio
      results = await publishToSocial({
        videoUrl: video.video_url,
        title: publishTitle,
        description: publishDesc,
        tags: publishTags,
        platforms: platforms as SocialPlatform[],
        format: primaryFormat,
      })

      // Log published posts to DB
      const posts = results.map((r) => ({
        user_id: user.id,
        video_id: videoId,
        platform: r.platform,
        scheduled_at: new Date().toISOString(),
        status: r.success ? ('published' as const) : ('failed' as const),
        platform_post_id: r.postUrl ?? null,
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
    return NextResponse.json({ error: 'Erreur publication sociale', details: message }, { status: 500 })
  }
}
