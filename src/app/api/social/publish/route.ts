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
  type PublishRequest,
} from '@/lib/zernio'
import { generateMultiPlatformCaptions } from '@/lib/ai/social-caption'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLATFORM_ENUM = z.enum([
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

const publishSchema = z.object({
  videoId: z.string().uuid('videoId invalide'),
  platforms: z.array(PLATFORM_ENUM).min(1, 'Au moins une plateforme requise'),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  autoCaption: z.boolean().optional().default(false),
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
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const parsed = publishSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { videoId, platforms, caption, hashtags, autoCaption, scheduledAt } =
      parsed.data

    const typedPlatforms = platforms as SocialPlatform[]

    // Fetch video (sutra schema)
    const sutraService = createServiceClient()
    const { data: video, error: videoError } = await sutraService
      .from('videos')
      .select('id, title, description, tags, video_url, status, user_id')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (videoError || !video) {
      return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 })
    }
    if (!video.video_url) {
      return NextResponse.json({ error: 'URL vidéo manquante' }, { status: 400 })
    }

    // Fetch user's connected accounts for requested platforms (public schema)
    const publicService = createPublicServiceClient()
    const { data: accounts, error: accountsError } = await publicService
      .from('social_accounts')
      .select('id, platform, external_id, username, access_token, status')
      .eq('user_id', user.id)
      .in('platform', typedPlatforms)
      .eq('status', 'connected')

    if (accountsError) {
      return NextResponse.json(
        { error: 'Erreur récupération comptes', details: accountsError.message },
        { status: 500 }
      )
    }

    const connectedPlatforms = new Set(
      (accounts ?? []).map((a) => a.platform as SocialPlatform)
    )
    const missing = typedPlatforms.filter((p) => !connectedPlatforms.has(p))
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Comptes non connectés',
          missing,
          message: `Connecte d'abord : ${missing.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Generate captions per platform if autoCaption = true
    let captionsByPlatform: Partial<
      Record<SocialPlatform, { caption: string; hashtags: string[] }>
    > = {}
    if (autoCaption) {
      try {
        captionsByPlatform = await generateMultiPlatformCaptions(
          video.title ?? '',
          video.description ?? '',
          typedPlatforms,
          { language: 'fr', style: 'engaging', includeCta: true }
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'caption_error'
        return NextResponse.json(
          { error: 'Erreur génération captions', details: msg },
          { status: 500 }
        )
      }
    }

    // Build accountIds map (one accountId per platform)
    const accountMap = new Map(
      (accounts ?? []).map((a) => [a.platform as SocialPlatform, a])
    )
    const accountIds = {} as Record<SocialPlatform, string>
    for (const p of typedPlatforms) {
      const acc = accountMap.get(p)
      if (acc) accountIds[p] = acc.id as string
    }

    // Pick caption/hashtags: if autoCaption, use first platform's generation
    const primaryPlatform = typedPlatforms[0]
    const primaryGenerated = captionsByPlatform[primaryPlatform]
    const finalCaption =
      primaryGenerated?.caption ?? caption ?? video.title ?? ''
    const finalHashtags =
      primaryGenerated?.hashtags ?? hashtags ?? video.tags ?? []

    const publishReq: PublishRequest = {
      videoUrl: video.video_url as string,
      caption: finalCaption,
      hashtags: finalHashtags,
      platforms: typedPlatforms,
      accountIds,
      scheduledAt,
      format: getOptimalFormat(primaryPlatform),
    }

    // Call zernio (publish or schedule)
    const results = scheduledAt
      ? await schedulePublication(publishReq)
      : await publishToPlatforms(publishReq)

    // Insert rows into social_posts
    const nowIso = new Date().toISOString()
    const rows = results.map((r) => {
      const perPlatform = captionsByPlatform[r.platform]
      const rowCaption = perPlatform?.caption ?? finalCaption
      const rowHashtags = perPlatform?.hashtags ?? finalHashtags
      return {
        user_id: user.id,
        video_id: videoId,
        platform: r.platform,
        account_id: accountIds[r.platform] ?? null,
        zernio_post_id: r.postId ?? null,
        external_post_id: r.postId ?? null,
        post_url: r.postUrl ?? null,
        caption: rowCaption,
        hashtags: rowHashtags,
        status: scheduledAt
          ? 'scheduled'
          : r.success
            ? 'published'
            : 'failed',
        scheduled_for: scheduledAt ?? null,
        published_at: !scheduledAt && r.success ? nowIso : null,
        error_message: r.error ?? null,
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        metadata: {},
        created_at: nowIso,
        updated_at: nowIso,
      }
    })

    if (rows.length > 0) {
      const { error: insertError } = await publicService
        .from('social_posts')
        .insert(rows)
      if (insertError) {
        console.error('[social/publish] insert error:', insertError.message)
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json(
      { error: 'Erreur publication', details: message },
      { status: 500 }
    )
  }
}
