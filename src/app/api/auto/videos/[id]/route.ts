import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (typeof body.user_rating === 'number' && body.user_rating >= 1 && body.user_rating <= 5) {
      updates.user_rating = body.user_rating
    }
    if (typeof body.user_feedback === 'string') updates.user_feedback = body.user_feedback.slice(0, 1000)
    if (body.status === 'ready' || body.status === 'pending_approval') updates.status = body.status

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'Rien a mettre a jour' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_videos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ video: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur mise a jour video', details: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const service = createServiceClient()
    const { error } = await service
      .from('sutra_auto_videos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur suppression', details: message }, { status: 500 })
  }
}
