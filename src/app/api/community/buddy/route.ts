import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Find active buddy pair where user is either user_a or user_b
    const { data: buddyA } = await service
      .from('buddies')
      .select('id, user_a, user_b, matched_at, streak_days, status')
      .eq('user_a', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: buddyB } = await service
      .from('buddies')
      .select('id, user_a, user_b, matched_at, streak_days, status')
      .eq('user_b', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const buddy = buddyA ?? buddyB
    if (!buddy) {
      return NextResponse.json({ buddy: null, checkins: [] })
    }

    const buddyUserId = buddy.user_a === user.id ? buddy.user_b : buddy.user_a

    // Get buddy profile
    const { data: buddyProfile } = await service
      .from('profiles')
      .select('full_name, avatar')
      .eq('id', buddyUserId)
      .single()

    // Get recent checkins
    const { data: checkins } = await service
      .from('buddy_checkins')
      .select('id, sender_id, message, mood_emoji, created_at')
      .eq('buddy_pair_id', buddy.id)
      .order('created_at', { ascending: false })
      .limit(30)

    return NextResponse.json({
      buddy: {
        pair_id: buddy.id,
        buddy_user_id: buddyUserId,
        buddy_name: buddyProfile?.full_name ?? 'Buddy',
        buddy_avatar: buddyProfile?.avatar,
        matched_at: buddy.matched_at,
        streak_days: buddy.streak_days,
      },
      checkins: checkins ?? [],
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
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Check user doesn't already have an active buddy
    const { data: existingA } = await service
      .from('buddies')
      .select('id')
      .eq('user_a', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const { data: existingB } = await service
      .from('buddies')
      .select('id')
      .eq('user_b', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingA || existingB) {
      return NextResponse.json({ error: 'Tu as deja un buddy actif' }, { status: 409 })
    }

    // Find a random active user without a buddy
    // Get all users who have active buddies
    const { data: usersWithBuddiesA } = await service
      .from('buddies')
      .select('user_a')
      .eq('status', 'active')

    const { data: usersWithBuddiesB } = await service
      .from('buddies')
      .select('user_b')
      .eq('status', 'active')

    const busyUserIds = new Set<string>()
    busyUserIds.add(user.id)
    ;(usersWithBuddiesA ?? []).forEach((r) => busyUserIds.add(r.user_a))
    ;(usersWithBuddiesB ?? []).forEach((r) => busyUserIds.add(r.user_b))

    // Get active profiles not in the busy set
    const { data: candidates } = await service
      .from('profiles')
      .select('id')
      .not('id', 'in', `(${Array.from(busyUserIds).join(',')})`)
      .limit(50)

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ error: 'Aucun buddy disponible pour le moment. Reessaie plus tard !' }, { status: 404 })
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * candidates.length)
    const matchedUserId = candidates[randomIndex].id

    const { data: buddyPair, error: insertError } = await service
      .from('buddies')
      .insert({
        user_a: user.id,
        user_b: matchedUserId,
        streak_days: 0,
        status: 'active',
      })
      .select('id, user_a, user_b, matched_at, streak_days')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const { data: buddyProfile } = await service
      .from('profiles')
      .select('full_name, avatar')
      .eq('id', matchedUserId)
      .single()

    return NextResponse.json({
      buddy: {
        pair_id: buddyPair.id,
        buddy_user_id: matchedUserId,
        buddy_name: buddyProfile?.full_name ?? 'Buddy',
        buddy_avatar: buddyProfile?.avatar,
        matched_at: buddyPair.matched_at,
        streak_days: 0,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
