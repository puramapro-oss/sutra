import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const CRON_SECRET = process.env.CRON_SECRET

// Streak multiplier: J1-6=x1, J7-13=x2, J14-29=x3, J30-59=x5, J60-99=x7, J100+=x10
function getStreakMultiplier(streak: number): number {
  if (streak >= 100) return 10
  if (streak >= 60) return 7
  if (streak >= 30) return 5
  if (streak >= 14) return 3
  if (streak >= 7) return 2
  return 1
}

export async function GET(request: Request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const yesterdayEnd = new Date(yesterdayStart.getTime() + 86400000)

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, streak, last_active_at, purama_points')

    if (!profiles) return NextResponse.json({ status: 'ok', updated: 0 })

    let updated = 0
    let pointsAwarded = 0

    for (const profile of profiles) {
      const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null

      if (lastActive && lastActive >= yesterdayStart && lastActive < yesterdayEnd) {
        // Was active yesterday — increment streak
        const newStreak = (profile.streak ?? 0) + 1
        const multiplier = getStreakMultiplier(newStreak)
        const dailyPoints = 10 * multiplier

        await supabase
          .from('profiles')
          .update({ streak: newStreak })
          .eq('id', profile.id)

        // Award daily streak points
        await supabase
          .from('purama_points')
          .update({
            balance: (profile.purama_points ?? 0) + dailyPoints,
            lifetime_earned: (profile.purama_points ?? 0) + dailyPoints,
          })
          .eq('user_id', profile.id)

        await supabase.from('point_transactions').insert({
          user_id: profile.id,
          amount: dailyPoints,
          type: 'earn',
          source: 'streak',
          description: `Streak jour ${newStreak} (x${multiplier})`,
        })

        // Check streak achievements
        if (newStreak === 7 || newStreak === 30 || newStreak === 100) {
          const achievementKeys: Record<number, string> = { 7: 'streak_7', 30: 'streak_30', 100: 'streak_100' }
          const { data: achievement } = await supabase
            .from('achievements')
            .select('id')
            .eq('key', achievementKeys[newStreak])
            .single()

          if (achievement) {
            const { error: achError } = await supabase.from('user_achievements').insert({
              user_id: profile.id,
              achievement_id: achievement.id,
            })
            // Ignore duplicate constraint errors
            if (achError && !achError.message?.includes('duplicate')) {
              console.error('Achievement error:', achError)
            }
          }

          // Award lottery tickets for streak milestones
          const ticketCount = newStreak === 7 ? 1 : newStreak === 30 ? 5 : 10
          const { data: currentDraw } = await supabase
            .from('lottery_draws')
            .select('id')
            .eq('status', 'upcoming')
            .order('draw_date', { ascending: true })
            .limit(1)
            .single()

          if (currentDraw) {
            const tickets = Array.from({ length: ticketCount }, () => ({
              user_id: profile.id,
              source: 'streak' as const,
              draw_id: currentDraw.id,
            }))
            await supabase.from('lottery_tickets').insert(tickets)
          }
        }

        updated++
        pointsAwarded += dailyPoints
      } else if (!lastActive || lastActive < yesterdayStart) {
        // Was NOT active yesterday — reset streak
        if ((profile.streak ?? 0) > 0) {
          await supabase
            .from('profiles')
            .update({ streak: 0 })
            .eq('id', profile.id)
          updated++
        }
      }
    }

    return NextResponse.json({ status: 'ok', updated, pointsAwarded })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const maxDuration = 60
