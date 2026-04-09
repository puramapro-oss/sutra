import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const CreateCircleSchema = z.object({
  objective: z.string().min(3, 'Objectif requis (min 3 caracteres)').max(200, 'Maximum 200 caracteres'),
  description: z.string().max(1000, 'Maximum 1000 caracteres').optional(),
  maxMembers: z.number().int().min(2).max(12).default(12),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Get circles user belongs to
    const { data: memberOf } = await service
      .from('circle_members')
      .select('circle_id, role, joined_at, streak_days')
      .eq('user_id', user.id)

    const myCircleIds = (memberOf ?? []).map((m) => m.circle_id)

    let myCircles: unknown[] = []
    if (myCircleIds.length > 0) {
      const { data } = await service
        .from('love_circles')
        .select('id, objective, max_members, created_at')
        .in('id', myCircleIds)
        .eq('app_slug', 'sutra')

      myCircles = (data ?? []).map((circle) => {
        const membership = memberOf?.find((m) => m.circle_id === circle.id)
        return { ...circle, role: membership?.role, streak_days: membership?.streak_days }
      })
    }

    // Get available circles to join (not full, not already member)
    const { data: availableRaw } = await service
      .from('love_circles')
      .select('id, objective, max_members, created_at')
      .eq('app_slug', 'sutra')
      .order('created_at', { ascending: false })
      .limit(20)

    const available = (availableRaw ?? []).filter((c) => !myCircleIds.includes(c.id))

    // Get member counts for available circles
    const availableWithCounts = await Promise.all(
      available.map(async (circle) => {
        const { count } = await service
          .from('circle_members')
          .select('id', { count: 'exact', head: true })
          .eq('circle_id', circle.id)
        return { ...circle, member_count: count ?? 0 }
      })
    )

    return NextResponse.json({
      myCircles,
      available: availableWithCounts.filter((c) => c.member_count < c.max_members),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = CreateCircleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { objective, description, maxMembers } = parsed.data
    const service = createServiceClient()

    // Create circle
    const { data: circle, error: circleError } = await service
      .from('love_circles')
      .insert({
        app_slug: 'sutra',
        objective,
        description: description ?? null,
        max_members: maxMembers,
      })
      .select('id, objective, max_members, created_at')
      .single()

    if (circleError) {
      return NextResponse.json({ error: circleError.message }, { status: 500 })
    }

    // Auto-join creator as captain
    await service.from('circle_members').insert({
      circle_id: circle.id,
      user_id: user.id,
      role: 'captain',
      streak_days: 0,
    })

    return NextResponse.json({ circle, role: 'captain' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
