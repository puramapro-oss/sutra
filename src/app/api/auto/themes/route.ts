import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_themes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ themes: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur themes', details: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body.theme || typeof body.theme !== 'string') {
      return NextResponse.json({ error: 'Le champ theme est requis' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_themes')
      .insert({
        user_id: user.id,
        theme: body.theme.trim(),
        description: body.description ?? null,
        example_prompts: Array.isArray(body.example_prompts) ? body.example_prompts : [],
        must_include: Array.isArray(body.must_include) ? body.must_include : [],
        never_include: Array.isArray(body.never_include) ? body.never_include : [],
        target_audience: body.target_audience ?? null,
        tone: body.tone ?? null,
        weight: typeof body.weight === 'number' ? Math.max(1, Math.min(10, body.weight)) : 1,
        schedule_id: body.schedule_id ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ theme: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur creation theme', details: message }, { status: 500 })
  }
}
