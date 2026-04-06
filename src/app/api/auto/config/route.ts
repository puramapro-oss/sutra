import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

const ALLOWED_FIELDS = [
  'is_active',
  'schedules',
  'default_style',
  'default_duration',
  'default_aspect_ratio',
  'default_music_genre',
  'default_voice_enabled',
  'default_voice_id',
  'default_language',
  'publish_platforms',
  'auto_publish',
  'require_approval_before_publish',
  'zernio_connected_platforms',
  'watermark_url',
  'intro_clip_url',
  'outro_clip_url',
  'brand_colors',
  'brand_font',
  'preferred_model',
  'quality_level',
] as const

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      // Lazy create with defaults
      const { data: created, error: insErr } = await service
        .from('sutra_auto_config')
        .insert({ user_id: user.id })
        .select()
        .single()
      if (insErr) throw insErr
      return NextResponse.json({ config: created })
    }

    return NextResponse.json({ config: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur config', details: message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune donnee a mettre a jour' }, { status: 400 })
    }

    const service = createServiceClient()
    const { data, error } = await service
      .from('sutra_auto_config')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur mise a jour config', details: message }, { status: 500 })
  }
}
