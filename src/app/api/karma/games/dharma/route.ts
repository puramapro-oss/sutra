import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

// 12 segments — distribution prosociale (moyenne ~80 graines/tour)
// Index 0..11, chacun a un label, un reward, et un badge optionnel
export const DHARMA_SEGMENTS = [
  { index: 0, label: 'Souffle',       seeds: 10,   badge: null,                weight: 18 },
  { index: 1, label: 'Étincelle',     seeds: 25,   badge: null,                weight: 16 },
  { index: 2, label: 'Présent',       seeds: 50,   badge: null,                weight: 14 },
  { index: 3, label: 'Élan',          seeds: 75,   badge: null,                weight: 12 },
  { index: 4, label: 'Clarté',        seeds: 100,  badge: null,                weight: 10 },
  { index: 5, label: 'Rythme',        seeds: 150,  badge: null,                weight: 8 },
  { index: 6, label: 'Feu',           seeds: 200,  badge: null,                weight: 6 },
  { index: 7, label: 'Muse',          seeds: 300,  badge: 'Muse éveillée',     weight: 5 },
  { index: 8, label: 'Flamme',        seeds: 400,  badge: null,                weight: 4 },
  { index: 9, label: 'Aube',          seeds: 500,  badge: null,                weight: 3 },
  { index: 10, label: 'Rayonnement',  seeds: 750,  badge: 'Rayonnement',       weight: 2 },
  { index: 11, label: 'Grand Cercle', seeds: 1000, badge: 'Grand Cercle',      weight: 2 },
] as const

function weightedPick(): typeof DHARMA_SEGMENTS[number] {
  const total = DHARMA_SEGMENTS.reduce((s, seg) => s + seg.weight, 0)
  let roll = Math.random() * total
  for (const seg of DHARMA_SEGMENTS) {
    roll -= seg.weight
    if (roll <= 0) return seg
  }
  return DHARMA_SEGMENTS[0]
}

function parisTodayISO(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    .toISOString()
    .slice(0, 10)
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()
    const today = parisTodayISO()

    const { data: todaySpin } = await service
      .from('karma_dharma_spins')
      .select('segment_index, seeds_won, badge_won, created_at')
      .eq('user_id', user.id)
      .eq('spin_date', today)
      .maybeSingle()

    const { data: history } = await service
      .from('karma_dharma_spins')
      .select('spin_date, segment_index, seeds_won, badge_won')
      .eq('user_id', user.id)
      .order('spin_date', { ascending: false })
      .limit(7)

    return NextResponse.json({
      segments: DHARMA_SEGMENTS.map(s => ({
        index: s.index,
        label: s.label,
        seeds: s.seeds,
        badge: s.badge,
      })),
      today_spin: todaySpin ?? null,
      can_spin: !todaySpin,
      history: history ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()
    const today = parisTodayISO()

    // Vérifier si déjà spiné aujourd'hui (UNIQUE constraint DB garantit aussi l'atomicité)
    const { data: existing } = await service
      .from('karma_dharma_spins')
      .select('id')
      .eq('user_id', user.id)
      .eq('spin_date', today)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Tu as déjà fait tourner la roue aujourd\'hui. Reviens demain.' },
        { status: 400 }
      )
    }

    const segment = weightedPick()

    const { data: spin, error: insertErr } = await service
      .from('karma_dharma_spins')
      .insert({
        user_id: user.id,
        spin_date: today,
        segment_index: segment.index,
        seeds_won: segment.seeds,
        badge_won: segment.badge,
      })
      .select('id')
      .single()

    if (insertErr || !spin) {
      // Si collision concurrente → considérer qu'un spin a déjà eu lieu
      return NextResponse.json(
        { error: 'Un spin a déjà été enregistré aujourd\'hui.' },
        { status: 400 }
      )
    }

    // Créditer les graines
    const { data: current } = await service
      .from('karma_seeds')
      .select('balance, lifetime_earned')
      .eq('user_id', user.id)
      .maybeSingle()

    const balance = current?.balance ?? 0
    const lifetime = current?.lifetime_earned ?? 0

    await service.from('karma_seeds').upsert(
      {
        user_id: user.id,
        balance: balance + segment.seeds,
        lifetime_earned: lifetime + segment.seeds,
      },
      { onConflict: 'user_id' }
    )

    await service.from('karma_seed_transactions').insert({
      user_id: user.id,
      amount: segment.seeds,
      direction: 'earn',
      source: 'dharma_wheel',
      source_ref: spin.id,
      reason: `Roue du Dharma — ${segment.label}`,
    })

    return NextResponse.json({
      segment_index: segment.index,
      label: segment.label,
      seeds_won: segment.seeds,
      badge_won: segment.badge,
      new_balance: balance + segment.seeds,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
