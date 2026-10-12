import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

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
    const current = await service.from('sutra_auto_videos').select('status,published_platforms').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (current.error || !current.data) return NextResponse.json({ error: 'Video indisponible' }, { status: 404 })
    if (updates.status && (!['ready', 'pending_approval'].includes(current.data.status)
      || (current.data.published_platforms?.length ?? 0) > 0)) {
      return NextResponse.json({ error: 'Une publication engagee ne peut pas etre remise a zero' }, { status: 409 })
    }
    if (updates.status) {
      const journal = await service.from('social_publication_journals').select('operations').eq('kind', 'auto')
        .eq('production_id', id).eq('user_id', user.id).maybeSingle()
      if (journal.error || journal.data?.operations?.length) {
        return NextResponse.json({ error: 'Une publication engagee ne peut pas etre remise a zero' }, { status: 409 })
      }
    }
    const { data, error } = await service
      .from('sutra_auto_videos')
      .update(updates)
      .eq('status', current.data.status)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !data) return NextResponse.json({ error: 'Transition non confirmee' }, { status: 409 })
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const service = createServiceClient()
    // Occurrence identity and submission evidence must survive deletion attempts.
    const current = await service.from('sutra_auto_videos').select('status,schedule_id,published_platforms').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (current.error || !current.data) return NextResponse.json({ error: 'Video indisponible' }, { status: 404 })
    const journal = await service.from('social_publication_journals').select('production_id').eq('kind', 'auto')
      .eq('production_id', id).eq('user_id', user.id).maybeSingle()
    if (journal.error || journal.data || current.data.schedule_id || (current.data.published_platforms?.length ?? 0) > 0
      || !['ready', 'pending_approval', 'failed'].includes(current.data.status)) {
      return NextResponse.json({ error: 'Occurrence ou historique de publication a conserver' }, { status: 409 })
    }
    const { data: deleted, error } = await service
      .from('sutra_auto_videos')
      .delete()
      .eq('status', current.data.status)
      .eq('id', id)
      .eq('user_id', user.id).select('id').maybeSingle()

    if (error || !deleted) return NextResponse.json({ error: 'Suppression non confirmee' }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur suppression', details: message }, { status: 500 })
  }
}
