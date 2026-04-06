import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    const service = createServiceClient()
    let query = service
      .from('sutra_auto_memory')
      .select('*')
      .eq('user_id', user.id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (type) query = query.eq('memory_type', type)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ memories: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur memoires', details: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body.content) return NextResponse.json({ error: 'content requis' }, { status: 400 })

    const validTypes = ['preference', 'performance', 'feedback', 'trend', 'learning']
    const memory_type = validTypes.includes(body.memory_type) ? body.memory_type : 'preference'

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_memory')
      .insert({
        user_id: user.id,
        memory_type,
        content: String(body.content).slice(0, 2000),
        importance: typeof body.importance === 'number' ? body.importance : 0.7,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ memory: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur creation memoire', details: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const service = createServiceClient()
    const { error } = await service
      .from('sutra_auto_memory')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur suppression memoire', details: message }, { status: 500 })
  }
}
