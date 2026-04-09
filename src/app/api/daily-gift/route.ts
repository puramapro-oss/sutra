import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

type GiftType =
  | 'points_small'
  | 'coupon_small'
  | 'ticket'
  | 'credits'
  | 'coupon_large'
  | 'points_large'
  | 'mega_coupon'

interface Gift {
  type: GiftType
  value: number | string
  label: string
}

function getTodayStart(): string {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rollGift(streakCount: number): Gift {
  const roll = Math.random() * 100

  // If streak >= 7, minimum is coupon_small (-10%)
  if (streakCount >= 7 && roll < 40) {
    // Override points_small with coupon_small -10%
    return { type: 'coupon_small', value: 10, label: '-10% sur ton prochain achat (7 jours)' }
  }

  if (roll < 40) {
    // 40% → points_small: 5-20
    const pts = randomInt(5, 20)
    return { type: 'points_small', value: pts, label: `+${pts} points` }
  } else if (roll < 65) {
    // 25% → coupon_small: -5% or -10%
    const pct = Math.random() < 0.5 ? 5 : 10
    return { type: 'coupon_small', value: pct, label: `-${pct}% sur ton prochain achat (7 jours)` }
  } else if (roll < 80) {
    // 15% → ticket
    return { type: 'ticket', value: 1, label: '+1 ticket pour le tirage mensuel' }
  } else if (roll < 90) {
    // 10% → credits: +3 video credits
    return { type: 'credits', value: 3, label: '+3 credits video' }
  } else if (roll < 95) {
    // 5% → coupon_large: -20% (3 days)
    return { type: 'coupon_large', value: 20, label: '-20% sur ton prochain achat (3 jours)' }
  } else if (roll < 98) {
    // 3% → points_large: 50-100
    const pts = randomInt(50, 100)
    return { type: 'points_large', value: pts, label: `+${pts} points` }
  } else {
    // 2% → mega_coupon: -50% (24h)
    return { type: 'mega_coupon', value: 50, label: '-50% sur ton prochain achat (24h)' }
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()
    const todayStart = getTodayStart()

    // Check if already opened today
    const { data: todayGift } = await service
      .from('daily_gifts')
      .select('*')
      .eq('user_id', user.id)
      .gte('opened_at', todayStart)
      .order('opened_at', { ascending: false })
      .limit(1)
      .single()

    // Get last gift for streak info
    const { data: lastGifts } = await service
      .from('daily_gifts')
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(1)

    const lastGift = lastGifts?.[0] ?? null
    const streakCount = lastGift?.streak_count ?? 0

    return NextResponse.json({
      canOpen: !todayGift,
      streakCount,
      lastGift: todayGift ?? lastGift ?? null,
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
    const todayStart = getTodayStart()

    // Check not already opened today
    const { data: todayGift } = await service
      .from('daily_gifts')
      .select('id')
      .eq('user_id', user.id)
      .gte('opened_at', todayStart)
      .limit(1)
      .single()

    if (todayGift) {
      return NextResponse.json(
        { error: 'Tu as deja ouvert ton coffre aujourd\'hui. Reviens demain !' },
        { status: 400 }
      )
    }

    // Calculate streak
    const { data: recentGifts } = await service
      .from('daily_gifts')
      .select('opened_at, streak_count')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(1)

    let streakCount = 1
    if (recentGifts && recentGifts.length > 0) {
      const lastOpened = new Date(recentGifts[0].opened_at)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)
      const lastDay = new Date(lastOpened)
      lastDay.setHours(0, 0, 0, 0)

      if (lastDay.getTime() === yesterday.getTime()) {
        // Consecutive day
        streakCount = (recentGifts[0].streak_count ?? 0) + 1
      }
      // If not yesterday, streak resets to 1
    }

    // Roll the gift
    const gift = rollGift(streakCount)

    // Insert daily_gifts record
    await service.from('daily_gifts').insert({
      user_id: user.id,
      app_slug: 'sutra',
      gift_type: gift.type,
      gift_value: String(gift.value),
      streak_count: streakCount,
      opened_at: new Date().toISOString(),
    })

    // Apply reward
    if (gift.type === 'points_small' || gift.type === 'points_large') {
      const pts = typeof gift.value === 'number' ? gift.value : parseInt(String(gift.value), 10)

      // Get or create purama_points
      let { data: points } = await service
        .from('purama_points')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .single()

      if (!points) {
        await service.from('purama_points').insert({
          user_id: user.id,
          balance: 0,
          lifetime_earned: 0,
        })
        points = { balance: 0, lifetime_earned: 0 }
      }

      await service
        .from('purama_points')
        .update({
          balance: points.balance + pts,
          lifetime_earned: points.lifetime_earned + pts,
        })
        .eq('user_id', user.id)

      await service.from('point_transactions').insert({
        user_id: user.id,
        amount: pts,
        type: 'earn',
        source: 'daily_gift',
        description: `Coffre quotidien : ${gift.label}`,
      })

      await service
        .from('profiles')
        .update({ purama_points: points.balance + pts })
        .eq('id', user.id)
    }

    if (gift.type === 'coupon_small' || gift.type === 'coupon_large' || gift.type === 'mega_coupon') {
      const pct = typeof gift.value === 'number' ? gift.value : parseInt(String(gift.value), 10)
      const daysMap: Record<string, number> = {
        coupon_small: 7,
        coupon_large: 3,
        mega_coupon: 1,
      }
      const days = daysMap[gift.type] ?? 7
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + days)

      const code = `COFFRE${pct}-${Date.now().toString(36).toUpperCase()}`

      await service.from('user_coupons').insert({
        user_id: user.id,
        code,
        discount_percent: pct,
        source: 'daily',
        expires_at: expiresAt.toISOString(),
        used: false,
      })
    }

    if (gift.type === 'ticket') {
      await service.from('lottery_tickets').insert({
        user_id: user.id,
        source: 'daily_gift',
      })
    }

    if (gift.type === 'credits') {
      const { data: profile } = await service
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      const currentCredits = profile?.credits ?? 0
      await service
        .from('profiles')
        .update({ credits: currentCredits + 3 })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      gift: {
        type: gift.type,
        value: gift.value,
        label: gift.label,
      },
      streakCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
