import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { profileSchema } from '@/lib/validators'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation profil', details: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = profileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const serviceClient = createServiceClient()
    const updates: Record<string, unknown> = {}

    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.preferred_niche !== undefined) updates.preferred_niche = parsed.data.preferred_niche
    if (parsed.data.preferred_voice_style !== undefined) updates.preferred_voice_style = parsed.data.preferred_voice_style
    if (parsed.data.preferred_quality !== undefined) updates.preferred_quality = parsed.data.preferred_quality
    if (parsed.data.theme_mode !== undefined) updates.theme_mode = parsed.data.theme_mode

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune donnee a mettre a jour' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: profile, error: updateError } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Erreur mise a jour profil' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur mise a jour profil', details: message }, { status: 500 })
  }
}
