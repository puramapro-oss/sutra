import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const CheckinSchema = z.object({
  message: z.string().max(500, 'Maximum 500 caracteres').optional(),
  moodEmoji: z.string().max(10).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = CheckinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { message, moodEmoji } = parsed.data
    const service = createServiceClient()

    // Find active buddy pair
    const { data: buddyA } = await service
      .from('buddies')
      .select('id, streak_days')
      .eq('user_a', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: buddyB } = await service
      .from('buddies')
      .select('id, streak_days')
      .eq('user_b', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const buddy = buddyA ?? buddyB
    if (!buddy) {
      return NextResponse.json({ error: 'Aucun buddy actif. Fais un matching d\'abord !' }, { status: 400 })
    }

    // Insert checkin
    const { data: checkin, error: checkinError } = await service
      .from('buddy_checkins')
      .insert({
        buddy_pair_id: buddy.id,
        sender_id: user.id,
        message: message ?? null,
        mood_emoji: moodEmoji ?? null,
      })
      .select('id, message, mood_emoji, created_at')
      .single()

    if (checkinError) {
      return NextResponse.json({ error: checkinError.message }, { status: 500 })
    }

    // Award 20 points
    await service.from('point_transactions').insert({
      user_id: user.id,
      amount: 20,
      type: 'earn',
      source_app: 'sutra',
      description: 'Check-in buddy quotidien',
    })

    const rpcRes = await service.rpc('increment_points', { uid: user.id, pts: 20 })
    if (rpcRes.error) {
      await service
        .from('profiles')
        .update({ purama_points: 20 })
        .eq('id', user.id)
    }

    return NextResponse.json({ checkin, points_awarded: 20 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
