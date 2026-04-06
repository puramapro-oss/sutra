/**
 * /api/auto/publish
 * Publie une video auto deja generee (status ready ou pending_approval).
 */
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { publishAutoVideo, recordMemory, type AutoConfig, type AutoVideoRecord } from '@/lib/sutra-auto'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body.video_id) return NextResponse.json({ error: 'video_id requis' }, { status: 400 })

    const service = createServiceClient()

    const { data: video } = await service
      .from('sutra_auto_videos')
      .select('*')
      .eq('id', body.video_id)
      .eq('user_id', user.id)
      .single()

    if (!video) return NextResponse.json({ error: 'Video introuvable' }, { status: 404 })
    if (!video.video_final_url) return NextResponse.json({ error: 'Video non prete' }, { status: 400 })

    const { data: config } = await service
      .from('sutra_auto_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!config) return NextResponse.json({ error: 'Config introuvable' }, { status: 400 })

    await service
      .from('sutra_auto_videos')
      .update({ status: 'publishing' })
      .eq('id', video.id)

    const v = video as AutoVideoRecord
    const results = await publishAutoVideo({
      config: config as AutoConfig,
      videoUrl: v.video_final_url!,
      title: v.title ?? '',
      description: v.description ?? '',
      hashtags: v.hashtags ?? [],
    })

    const success = results.some((r) => r.success)
    await service
      .from('sutra_auto_videos')
      .update({
        status: success ? 'published' : 'failed',
        published_at: success ? new Date().toISOString() : null,
        published_platforms: results,
        error_message: success ? null : results.map((r) => r.error).filter(Boolean).join(' | '),
      })
      .eq('id', video.id)

    if (success) {
      await recordMemory({
        userId: user.id,
        type: 'preference',
        content: `Video publiee: "${v.title}" sur ${results.filter((r) => r.success).map((r) => r.platform).join(', ')}`,
        importance: 0.6,
        related_video_id: v.id,
      })
    }

    return NextResponse.json({ success, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur publication', details: message }, { status: 500 })
  }
}
