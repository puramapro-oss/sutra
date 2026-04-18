import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

const TARGET = 21
const COMPLETION_REWARD = 21000

function parisToday(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    .toISOString()
    .slice(0, 10)
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()
    const { data: streak } = await service
      .from('karma_quete_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const current = streak?.current_streak ?? 0
    const best = streak?.best_streak ?? 0
    const completions = streak?.completions_count ?? 0
    const lastVideo = streak?.last_video_date ?? null

    // Reset automatique si dernier upload > 1 jour
    let effectiveStreak = current
    if (lastVideo && daysBetween(lastVideo, parisToday()) > 1) {
      effectiveStreak = 0
    }

    return NextResponse.json({
      target: TARGET,
      reward: COMPLETION_REWARD,
      current_streak: effectiveStreak,
      best_streak: best,
      completions_count: completions,
      last_video_date: lastVideo,
      completed_at: streak?.completed_at ?? null,
      progress_percent: Math.min(100, Math.round((effectiveStreak / TARGET) * 100)),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: enregistre une "création vidéo" manuelle (normalement appelé auto depuis /api/video/create — ici endpoint manuel pour MVP)
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const service = createServiceClient()
    const today = parisToday()

    const { data: streak } = await service
      .from('karma_quete_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const lastVideo = streak?.last_video_date ?? null

    // Déjà enregistré aujourd'hui
    if (lastVideo === today) {
      return NextResponse.json({
        current_streak: streak?.current_streak ?? 0,
        message: 'Déjà compté pour aujourd\'hui.',
      })
    }

    let newStreak = 1
    if (lastVideo) {
      const gap = daysBetween(lastVideo, today)
      if (gap === 1) newStreak = (streak?.current_streak ?? 0) + 1
      // gap > 1 => reset (newStreak reste 1)
    }

    const best = Math.max(streak?.best_streak ?? 0, newStreak)
    let completedAt = streak?.completed_at ?? null
    let completionsCount = streak?.completions_count ?? 0
    let awardedThisTime = 0

    if (newStreak === TARGET) {
      completedAt = new Date().toISOString()
      completionsCount += 1
      awardedThisTime = COMPLETION_REWARD

      // Reset pour permettre nouvelle quête (next +21)
      // On garde le streak à TARGET côté UI pour montrer le succès,
      // mais on redémarre le compteur pour la prochaine.
    }

    await service.from('karma_quete_streaks').upsert(
      {
        user_id: user.id,
        current_streak: newStreak === TARGET ? 0 : newStreak,
        best_streak: best,
        last_video_date: today,
        completed_at: completedAt,
        completions_count: completionsCount,
      },
      { onConflict: 'user_id' }
    )

    if (awardedThisTime > 0) {
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
          balance: balance + awardedThisTime,
          lifetime_earned: lifetime + awardedThisTime,
        },
        { onConflict: 'user_id' }
      )
      await service.from('karma_seed_transactions').insert({
        user_id: user.id,
        amount: awardedThisTime,
        direction: 'earn',
        source: 'quete_rare',
        reason: `Quête Rare 21 jours complétée #${completionsCount}`,
      })
    }

    return NextResponse.json({
      current_streak: newStreak,
      target: TARGET,
      completed: newStreak === TARGET,
      seeds_awarded: awardedThisTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
