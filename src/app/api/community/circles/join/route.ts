import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const JoinSchema = z.object({
  circleId: z.string().uuid('ID de cercle invalide'),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = JoinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { circleId } = parsed.data
    const service = createServiceClient()

    // Check circle exists
    const { data: circle, error: circleError } = await service
      .from('love_circles')
      .select('id, max_members')
      .eq('id', circleId)
      .eq('app_slug', 'sutra')
      .single()

    if (circleError || !circle) {
      return NextResponse.json({ error: 'Cercle introuvable' }, { status: 404 })
    }

    // Check not already a member
    const { data: existing } = await service
      .from('circle_members')
      .select('id')
      .eq('circle_id', circleId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Tu fais deja partie de ce cercle' }, { status: 409 })
    }

    // Check not full
    const { count } = await service
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)

    if ((count ?? 0) >= circle.max_members) {
      return NextResponse.json({ error: 'Ce cercle est complet' }, { status: 400 })
    }

    // Join
    const { error: joinError } = await service.from('circle_members').insert({
      circle_id: circleId,
      user_id: user.id,
      role: 'member',
      streak_days: 0,
    })

    if (joinError) {
      return NextResponse.json({ error: joinError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Bienvenue dans le cercle !' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
