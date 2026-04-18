import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

// Gains en graines par niveau cascade (multiplicateur ×2)
const SEEDS_BY_LEVEL = [0, 50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600]

const CreateSchema = z.object({
  parent_wave_id: z.string().uuid().optional().nullable(),
  title: z.string().min(3).max(120),
  challenge: z.string().min(5).max(500),
  video_url: z.string().url().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    // Top vagues actives avec beaucoup d'enfants
    const { data: topWaves } = await service
      .from('karma_vagues')
      .select('id, initiator_id, parent_wave_id, level, title, challenge, video_url, children_count, expires_at, created_at, status')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('children_count', { ascending: false })
      .limit(30)

    const userIds = Array.from(new Set((topWaves ?? []).map(w => w.initiator_id)))
    let profilesMap: Record<string, { full_name: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      profilesMap = Object.fromEntries(
        (profiles ?? []).map(p => [p.id, { full_name: p.full_name }])
      )
    }

    const enriched = (topWaves ?? []).map(w => ({
      ...w,
      initiator: profilesMap[w.initiator_id] ?? { full_name: null },
    }))

    let myWaves: typeof enriched = []
    if (user) {
      const { data: mine } = await service
        .from('karma_vagues')
        .select('id, parent_wave_id, level, title, challenge, children_count, seeds_awarded, expires_at, status, created_at, initiator_id')
        .eq('initiator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      myWaves = (mine ?? []).map(m => ({
        ...m,
        video_url: null,
        initiator: { full_name: null },
      }))
    }

    return NextResponse.json({
      top_waves: enriched,
      my_waves: myWaves,
      seeds_by_level: SEEDS_BY_LEVEL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide', details: parsed.error.issues }, { status: 400 })
    }

    const service = createServiceClient()

    let level = 1
    if (parsed.data.parent_wave_id) {
      const { data: parent } = await service
        .from('karma_vagues')
        .select('level, status, expires_at, initiator_id')
        .eq('id', parsed.data.parent_wave_id)
        .maybeSingle()
      if (!parent) {
        return NextResponse.json({ error: 'Vague parente introuvable' }, { status: 404 })
      }
      if (parent.status !== 'active' || new Date(parent.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Vague parente fermée.' }, { status: 400 })
      }
      if (parent.initiator_id === user.id) {
        return NextResponse.json({ error: 'Impossible de rejoindre sa propre vague.' }, { status: 400 })
      }
      level = Math.min(parent.level + 1, SEEDS_BY_LEVEL.length - 1)
    }

    const seeds = SEEDS_BY_LEVEL[level] ?? 0

    const { data: wave, error: insertErr } = await service
      .from('karma_vagues')
      .insert({
        initiator_id: user.id,
        parent_wave_id: parsed.data.parent_wave_id ?? null,
        level,
        title: parsed.data.title,
        challenge: parsed.data.challenge,
        video_url: parsed.data.video_url ?? null,
        seeds_awarded: seeds,
      })
      .select('id, level')
      .single()

    if (insertErr || !wave) {
      return NextResponse.json({ error: insertErr?.message ?? 'Erreur insertion' }, { status: 500 })
    }

    if (seeds > 0) {
      const { data: current } = await service
        .from('karma_seeds')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .maybeSingle()
      const balance = current?.balance ?? 0
      const lifetime = current?.lifetime_earned ?? 0
      await service.from('karma_seeds').upsert(
        { user_id: user.id, balance: balance + seeds, lifetime_earned: lifetime + seeds },
        { onConflict: 'user_id' }
      )
      await service.from('karma_seed_transactions').insert({
        user_id: user.id,
        amount: seeds,
        direction: 'earn',
        source: 'vague',
        source_ref: wave.id,
        reason: `La Vague niveau ${level}`,
      })
    }

    return NextResponse.json({
      wave_id: wave.id,
      level: wave.level,
      seeds_awarded: seeds,
      message: parsed.data.parent_wave_id
        ? `+${seeds} 🌱 Tu rejoins la vague niveau ${level}.`
        : `Vague créée ! +${seeds} 🌱`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
