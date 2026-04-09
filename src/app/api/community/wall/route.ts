import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const PostSchema = z.object({
  content: z.string().min(1, 'Le contenu est requis').max(2000, 'Maximum 2000 caracteres'),
  type: z.enum(['victory', 'encouragement', 'milestone', 'gratitude']),
})

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const offset = (page - 1) * limit

    const service = createServiceClient()

    const { data: posts, error: postsError } = await service
      .from('love_wall_posts')
      .select('id, user_id, content, type, reactions_count, pinned, created_at, profiles(full_name, avatar)')
      .eq('app_slug', 'sutra')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) {
      return NextResponse.json({ error: postsError.message }, { status: 500 })
    }

    const { count } = await service
      .from('love_wall_posts')
      .select('id', { count: 'exact', head: true })
      .eq('app_slug', 'sutra')

    return NextResponse.json({
      posts: posts ?? [],
      pagination: { page, limit, total: count ?? 0 },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { content, type } = parsed.data
    const service = createServiceClient()

    const { data: post, error: insertError } = await service
      .from('love_wall_posts')
      .insert({
        user_id: user.id,
        app_slug: 'sutra',
        content,
        type,
        reactions_count: 0,
        pinned: false,
      })
      .select('id, content, type, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Award 50 points
    await service.from('point_transactions').insert({
      user_id: user.id,
      amount: 50,
      type: 'earn',
      source_app: 'sutra',
      description: 'Publication sur le mur communautaire',
    })

    const rpcRes = await service.rpc('increment_points', { uid: user.id, pts: 50 })
    if (rpcRes.error) {
      await service
        .from('profiles')
        .update({ purama_points: 50 })
        .eq('id', user.id)
    }

    return NextResponse.json({ post, points_awarded: 50 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
