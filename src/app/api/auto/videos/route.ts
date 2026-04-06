import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200)

    const service = createServiceClient()
    let query = service
      .from('sutra_auto_videos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ videos: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur videos', details: message }, { status: 500 })
  }
}
