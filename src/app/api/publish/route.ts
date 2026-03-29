import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { logActivity, sendNotification } from '@/lib/logger'

const publishSchema = z.object({
  video_id: z.string().uuid('video_id invalide'),
  platforms: z.array(z.enum(['youtube', 'tiktok', 'instagram'])).min(1, 'Au moins une plateforme requise'),
  scheduled_at: z.string().datetime().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = publishSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { video_id, platforms, scheduled_at } = parsed.data
    const serviceClient = createServiceClient()

    const { data: video } = await serviceClient
      .from('videos')
      .select('id, title, status, user_id')
      .eq('id', video_id)
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

    const posts = platforms.map((platform) => ({
      user_id: user.id,
      video_id,
      platform,
      scheduled_at: scheduled_at ?? new Date().toISOString(),
      status: scheduled_at ? 'scheduled' as const : 'published' as const,
    }))

    const { data: scheduledPosts, error: insertError } = await serviceClient
      .from('scheduled_posts')
      .insert(posts)
      .select('*')

    if (insertError) {
      return NextResponse.json({ error: 'Erreur enregistrement publication' }, { status: 500 })
    }

    await serviceClient
      .from('videos')
      .update({
        status: 'published',
        publish_data: {
          platforms,
          scheduled_at: scheduled_at ?? null,
          published_at: scheduled_at ? null : new Date().toISOString(),
        },
      })
      .eq('id', video_id)

    await sendNotification(user.id, {
      type: 'success',
      title: scheduled_at ? 'Publication programmee' : 'Video publiee',
      message: scheduled_at
        ? `Ta video sera publiee sur ${platforms.join(', ')}.`
        : `Ta video est publiee sur ${platforms.join(', ')}.`,
    })

    await logActivity(user.id, 'video_published', `Video publiee sur ${platforms.join(', ')}`, {
      video_id,
      platforms,
      scheduled_at,
    })

    return NextResponse.json({ success: true, posts: scheduledPosts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur publication', details: message }, { status: 500 })
  }
}
