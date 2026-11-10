import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { isValidAutoSchedules } from '@/lib/auto-schedule-validation'
import { z } from 'zod'
import { readOwnedPublicationDestinations, destinationPlatformsMatch } from '@/lib/social-destinations'

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
  'publish_account_ids',
  'auto_publish',
  'require_approval_before_publish',
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
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

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
  } catch {
    return NextResponse.json({ error: 'Erreur config' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Configuration invalide' }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key]
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucune donnee a mettre a jour' }, { status: 400 })
    }
    const service = createServiceClient()
    if (['is_active', 'auto_publish', 'require_approval_before_publish'].some(key => key in updates && typeof updates[key] !== 'boolean')) {
      return NextResponse.json({ error: 'Autorisation de publication invalide' }, { status: 400 })
    }
    if ('publish_account_ids' in updates && !z.array(z.string().uuid()).max(50)
      .refine(ids => new Set(ids).size === ids.length).safeParse(updates.publish_account_ids).success) {
      return NextResponse.json({ error: 'Selection des comptes invalide' }, { status: 400 })
    }
    if ('publish_platforms' in updates && !z.array(z.string()).max(14).safeParse(updates.publish_platforms).success) {
      return NextResponse.json({ error: 'Selection des plateformes invalide' }, { status: 400 })
    }
    const stopping = updates.auto_publish === false || updates.is_active === false
    if (!stopping && ('publish_account_ids' in updates || 'publish_platforms' in updates || updates.auto_publish === true || updates.is_active === true)) {
      const current = await service.from('sutra_auto_config').select('publish_platforms,publish_account_ids,auto_publish,is_active')
        .eq('user_id', user.id).maybeSingle()
      if (current.error) throw current.error
      const ids = (updates.publish_account_ids ?? current.data?.publish_account_ids ?? []) as string[]
      const platforms = (updates.publish_platforms ?? current.data?.publish_platforms ?? []) as string[]
      const autoPublish = updates.auto_publish ?? current.data?.auto_publish ?? false
      try {
        const destinations = await readOwnedPublicationDestinations(user.id, ids, service, Boolean(autoPublish))
        if ((autoPublish && !destinations.length) || !destinationPlatformsMatch(destinations, platforms)) throw new Error('SUTRA_ACCOUNT_SELECTION_REQUIRED')
      } catch (error) {
        if (error instanceof Error && error.message === 'SUTRA_SOCIAL_ACCOUNTS_READ_FAILED') throw error
        return NextResponse.json({ error: 'Selectionne les comptes autorises pour cette publication automatique', code: 'SUTRA_ACCOUNT_SELECTION_REQUIRED' }, { status: 400 })
      }
    }

    if ('schedules' in updates) {
      if (!Object.hasOwn(body, 'expectedSchedules')) {
        return NextResponse.json({ error: 'Relis les plannings avant de les modifier', code: 'SCHEDULE_PRECONDITION_REQUIRED' }, { status: 428 })
      }
      // The previous snapshot may contain legacy entries that the user is removing.
      if (!Array.isArray(body.expectedSchedules) || !isValidAutoSchedules(updates.schedules)) {
        return NextResponse.json({ error: 'Plannings invalides', code: 'SCHEDULE_INVALID' }, { status: 400 })
      }
      const { data, error } = await createServiceClient()
        .from('sutra_auto_config')
        .update(updates)
        .eq('user_id', user.id)
        .eq('schedules', JSON.stringify(body.expectedSchedules))
        .select()
        .maybeSingle()
      if (error) throw error
      if (!data) {
        return NextResponse.json({ error: 'Les plannings ont change. Relis leur etat avant de reessayer.', code: 'SCHEDULE_CONFLICT' }, { status: 409 })
      }
      return NextResponse.json({ config: data })
    }

    const { data, error } = await service
      .from('sutra_auto_config')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch {
    return NextResponse.json({ error: 'Erreur mise a jour config' }, { status: 500 })
  }
}
