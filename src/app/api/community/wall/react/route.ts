import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const ReactSchema = z.object({
  postId: z.string().uuid('ID de post invalide'),
  emoji: z.string().min(1, 'Emoji requis').max(10, 'Emoji trop long'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = ReactSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { postId, emoji } = parsed.data
    const service = createServiceClient()

    // Check post exists
    const { data: post, error: postError } = await service
      .from('love_wall_posts')
      .select('id, reactions_count')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 })
    }

    // Check if reaction already exists
    const { data: existing } = await service
      .from('love_reactions')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle()

    if (existing) {
      // Remove reaction
      await service
        .from('love_reactions')
        .delete()
        .eq('id', existing.id)

      await service
        .from('love_wall_posts')
        .update({ reactions_count: Math.max(0, (post.reactions_count ?? 1) - 1) })
        .eq('id', postId)

      return NextResponse.json({ action: 'removed', reactions_count: Math.max(0, (post.reactions_count ?? 1) - 1) })
    }

    // Add reaction
    await service.from('love_reactions').insert({
      post_id: postId,
      user_id: user.id,
      emoji,
    })

    const newCount = (post.reactions_count ?? 0) + 1
    await service
      .from('love_wall_posts')
      .update({ reactions_count: newCount })
      .eq('id', postId)

    return NextResponse.json({ action: 'added', reactions_count: newCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
