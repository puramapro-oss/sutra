import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const CompleteSchema = z.object({
  mission_slug: z.string().min(1).max(120),
  proof_url: z.string().url().optional().nullable(),
})

interface MissionRow {
  id: string
  slug: string
  title: string
  description: string
  category: string
  pilier: string
  seeds_reward: number
  verification_type: string
  max_per_day: number
  max_per_week: number | null
  active: boolean
}

interface CompletionRow {
  mission_id: string
  completion_date: string
  status: string
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()
    const todayParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
      .toISOString()
      .slice(0, 10)

    // 7 derniers jours pour calculer max_per_week
    const weekAgoDate = new Date()
    weekAgoDate.setDate(weekAgoDate.getDate() - 7)
    const weekAgo = weekAgoDate.toISOString().slice(0, 10)

    const [missionsRes, completionsRes] = await Promise.all([
      service
        .from('karma_missions')
        .select('*')
        .eq('active', true)
        .order('seeds_reward', { ascending: true }),
      service
        .from('karma_mission_completions')
        .select('mission_id, completion_date, status')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .gte('completion_date', weekAgo),
    ])

    const missions = (missionsRes.data ?? []) as MissionRow[]
    const completions = (completionsRes.data ?? []) as CompletionRow[]

    const enriched = missions.map(m => {
      const byMission = completions.filter(c => c.mission_id === m.id)
      const todayCount = byMission.filter(c => c.completion_date === todayParis).length
      const weekCount = byMission.length

      const canCompleteToday = todayCount < m.max_per_day
      const canCompleteWeek = m.max_per_week === null || weekCount < m.max_per_week
      const canComplete = canCompleteToday && canCompleteWeek

      return {
        id: m.id,
        slug: m.slug,
        title: m.title,
        description: m.description,
        category: m.category,
        pilier: m.pilier,
        seeds_reward: m.seeds_reward,
        verification_type: m.verification_type,
        max_per_day: m.max_per_day,
        max_per_week: m.max_per_week,
        today_count: todayCount,
        week_count: weekCount,
        can_complete: canComplete,
        reason_blocked: !canCompleteToday
          ? `Limite journalière atteinte (${m.max_per_day})`
          : !canCompleteWeek
            ? `Limite hebdo atteinte (${m.max_per_week})`
            : null,
      }
    })

    return NextResponse.json({ missions: enriched })
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
    const parsed = CompleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide', details: parsed.error.issues }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: mission, error: missionErr } = await service
      .from('karma_missions')
      .select('id, slug, seeds_reward, max_per_day, max_per_week, verification_type, active')
      .eq('slug', parsed.data.mission_slug)
      .maybeSingle()

    if (missionErr || !mission) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 })
    }
    if (!mission.active) {
      return NextResponse.json({ error: 'Mission inactive' }, { status: 400 })
    }

    const todayParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
      .toISOString()
      .slice(0, 10)
    const weekAgoDate = new Date()
    weekAgoDate.setDate(weekAgoDate.getDate() - 7)
    const weekAgo = weekAgoDate.toISOString().slice(0, 10)

    const { data: recent } = await service
      .from('karma_mission_completions')
      .select('completion_date')
      .eq('user_id', user.id)
      .eq('mission_id', mission.id)
      .eq('status', 'approved')
      .gte('completion_date', weekAgo)

    const todayCount = (recent ?? []).filter(r => r.completion_date === todayParis).length
    const weekCount = (recent ?? []).length

    if (todayCount >= mission.max_per_day) {
      return NextResponse.json(
        { error: `Limite journalière atteinte (${mission.max_per_day}).` },
        { status: 400 }
      )
    }
    if (mission.max_per_week !== null && weekCount >= mission.max_per_week) {
      return NextResponse.json(
        { error: `Limite hebdo atteinte (${mission.max_per_week}).` },
        { status: 400 }
      )
    }

    const status = mission.verification_type === 'manual' ? 'pending' : 'approved'
    const seedsAwarded = status === 'approved' ? mission.seeds_reward : 0

    const { data: completion, error: insertErr } = await service
      .from('karma_mission_completions')
      .insert({
        user_id: user.id,
        mission_id: mission.id,
        completion_date: todayParis,
        proof_url: parsed.data.proof_url ?? null,
        status,
        seeds_awarded: seedsAwarded,
      })
      .select('id')
      .single()

    if (insertErr || !completion) {
      return NextResponse.json({ error: insertErr?.message ?? 'Erreur insertion' }, { status: 500 })
    }

    if (seedsAwarded > 0) {
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
          balance: balance + seedsAwarded,
          lifetime_earned: lifetime + seedsAwarded,
        },
        { onConflict: 'user_id' }
      )

      await service.from('karma_seed_transactions').insert({
        user_id: user.id,
        amount: seedsAwarded,
        direction: 'earn',
        source: `mission:${mission.slug}`,
        source_ref: completion.id,
        reason: `Mission « ${parsed.data.mission_slug} »`,
      })
    }

    return NextResponse.json({
      completion_id: completion.id,
      status,
      seeds_awarded: seedsAwarded,
      message: status === 'approved'
        ? `+${seedsAwarded} graines créditées.`
        : 'Mission soumise, en attente de validation.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
