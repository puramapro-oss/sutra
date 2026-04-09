import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const PostSchema = z.object({
  checkAll: z.boolean().optional().default(true),
})

interface AchievementDef {
  id: string
  name: string
  description: string
  icon: string
  xp: number
  points: number
  condition: (stats: UserStats) => boolean
}

interface UserStats {
  videoCount: number
  referralCount: number
  streak: number
  walletBalance: number
  level: number
  puramaPoints: number
  lifetimeEarned: number
  dailyGiftStreak: number
  loginDays: number
  sharesCount: number
  credits: number
  plan: string
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_video',
    name: 'Premiere Scene',
    description: 'Cree ta premiere video avec SUTRA',
    icon: 'film',
    xp: 50,
    points: 100,
    condition: (s) => s.videoCount >= 1,
  },
  {
    id: 'five_videos',
    name: 'Realisateur en Herbe',
    description: 'Cree 5 videos',
    icon: 'clapperboard',
    xp: 100,
    points: 200,
    condition: (s) => s.videoCount >= 5,
  },
  {
    id: 'twenty_videos',
    name: 'Producteur Confirme',
    description: 'Cree 20 videos',
    icon: 'award',
    xp: 250,
    points: 500,
    condition: (s) => s.videoCount >= 20,
  },
  {
    id: 'fifty_videos',
    name: 'Studio Hollywoodien',
    description: 'Cree 50 videos',
    icon: 'star',
    xp: 500,
    points: 500,
    condition: (s) => s.videoCount >= 50,
  },
  {
    id: 'first_referral',
    name: 'Ambassadeur',
    description: 'Parraine ton premier ami',
    icon: 'users',
    xp: 100,
    points: 200,
    condition: (s) => s.referralCount >= 1,
  },
  {
    id: 'ten_referrals',
    name: 'Influenceur Bronze',
    description: 'Parraine 10 personnes',
    icon: 'user-plus',
    xp: 250,
    points: 300,
    condition: (s) => s.referralCount >= 10,
  },
  {
    id: 'streak_7',
    name: 'Semaine de Feu',
    description: 'Maintiens un streak de 7 jours',
    icon: 'flame',
    xp: 75,
    points: 150,
    condition: (s) => s.streak >= 7,
  },
  {
    id: 'streak_30',
    name: 'Mois Legendaire',
    description: 'Maintiens un streak de 30 jours',
    icon: 'zap',
    xp: 300,
    points: 500,
    condition: (s) => s.streak >= 30,
  },
  {
    id: 'streak_100',
    name: 'Centurion',
    description: 'Maintiens un streak de 100 jours',
    icon: 'crown',
    xp: 1000,
    points: 500,
    condition: (s) => s.streak >= 100,
  },
  {
    id: 'first_wallet',
    name: 'Premier Euro',
    description: 'Gagne ton premier euro dans le wallet',
    icon: 'wallet',
    xp: 100,
    points: 100,
    condition: (s) => s.walletBalance >= 1,
  },
  {
    id: 'level_5',
    name: 'Apprenti Cineaste',
    description: 'Atteins le niveau 5',
    icon: 'trending-up',
    xp: 150,
    points: 200,
    condition: (s) => s.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Expert du Montage',
    description: 'Atteins le niveau 10',
    icon: 'trophy',
    xp: 300,
    points: 300,
    condition: (s) => s.level >= 10,
  },
  {
    id: 'points_1000',
    name: 'Collectionneur',
    description: 'Accumule 1000 points au total',
    icon: 'coins',
    xp: 100,
    points: 50,
    condition: (s) => s.lifetimeEarned >= 1000,
  },
  {
    id: 'premium_member',
    name: 'Membre Premium',
    description: 'Passe a un abonnement payant',
    icon: 'sparkles',
    xp: 200,
    points: 300,
    condition: (s) => s.plan !== 'free' && s.plan !== '',
  },
  {
    id: 'first_share',
    name: 'Connecte',
    description: 'Partage SUTRA avec tes amis',
    icon: 'share-2',
    xp: 50,
    points: 100,
    condition: (s) => s.sharesCount >= 1,
  },
]

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [achievementsRes, userAchievementsRes] = await Promise.all([
      // Return our static definitions as-is — DB may also have rows
      Promise.resolve(ACHIEVEMENTS.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        xp: a.xp,
        points: a.points,
      }))),
      service
        .from('user_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', user.id),
    ])

    const unlockedIds = new Set(
      (userAchievementsRes.data ?? []).map((ua: { achievement_id: string }) => ua.achievement_id)
    )

    const achievements = achievementsRes.map(a => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlocked_at: (userAchievementsRes.data ?? []).find(
        (ua: { achievement_id: string; unlocked_at: string }) => ua.achievement_id === a.id
      )?.unlocked_at ?? null,
    }))

    return NextResponse.json({
      achievements,
      unlockedCount: unlockedIds.size,
      totalCount: ACHIEVEMENTS.length,
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

    const body = await req.json().catch(() => ({}))
    PostSchema.safeParse(body) // Validates but we always checkAll

    const service = createServiceClient()

    // Fetch user stats in parallel
    const [
      profileRes,
      videoCountRes,
      referralCountRes,
      pointsRes,
      dailyGiftRes,
      sharesRes,
      userAchievementsRes,
    ] = await Promise.all([
      service.from('profiles').select('streak, level, xp, wallet_balance, credits, plan').eq('id', user.id).single(),
      service.from('conversations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      service.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id),
      service.from('purama_points').select('balance, lifetime_earned').eq('user_id', user.id).single(),
      service.from('daily_gifts').select('streak_count').eq('user_id', user.id).order('opened_at', { ascending: false }).limit(1),
      service.from('social_shares').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      service.from('user_achievements').select('achievement_id').eq('user_id', user.id),
    ])

    const stats: UserStats = {
      videoCount: videoCountRes.count ?? 0,
      referralCount: referralCountRes.count ?? 0,
      streak: profileRes.data?.streak ?? 0,
      walletBalance: profileRes.data?.wallet_balance ?? 0,
      level: profileRes.data?.level ?? 1,
      puramaPoints: pointsRes.data?.balance ?? 0,
      lifetimeEarned: pointsRes.data?.lifetime_earned ?? 0,
      dailyGiftStreak: dailyGiftRes.data?.[0]?.streak_count ?? 0,
      loginDays: profileRes.data?.streak ?? 0,
      sharesCount: sharesRes.count ?? 0,
      credits: profileRes.data?.credits ?? 0,
      plan: profileRes.data?.plan ?? 'free',
    }

    const alreadyUnlocked = new Set(
      (userAchievementsRes.data ?? []).map((ua: { achievement_id: string }) => ua.achievement_id)
    )

    const newlyUnlocked: Array<{ id: string; name: string; xp: number; points: number }> = []

    for (const achievement of ACHIEVEMENTS) {
      if (alreadyUnlocked.has(achievement.id)) continue
      if (!achievement.condition(stats)) continue

      // Unlock this achievement
      await service.from('user_achievements').insert({
        user_id: user.id,
        achievement_id: achievement.id,
        unlocked_at: new Date().toISOString(),
      })

      // Award XP
      const currentXp = profileRes.data?.xp ?? 0
      const currentLevel = profileRes.data?.level ?? 1
      const newXp = currentXp + achievement.xp
      // Simple level formula: level = floor(sqrt(xp / 100)) + 1
      const newLevel = Math.max(currentLevel, Math.floor(Math.sqrt(newXp / 100)) + 1)

      await service
        .from('profiles')
        .update({ xp: newXp, level: newLevel })
        .eq('id', user.id)

      // Award points
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
          balance: points.balance + achievement.points,
          lifetime_earned: points.lifetime_earned + achievement.points,
        })
        .eq('user_id', user.id)

      await service.from('point_transactions').insert({
        user_id: user.id,
        amount: achievement.points,
        type: 'earn',
        source: 'achievement',
        description: `Achievement debloqu\u00e9 : ${achievement.name}`,
      })

      // Update profile purama_points
      await service
        .from('profiles')
        .update({ purama_points: points.balance + achievement.points })
        .eq('id', user.id)

      newlyUnlocked.push({
        id: achievement.id,
        name: achievement.name,
        xp: achievement.xp,
        points: achievement.points,
      })
    }

    return NextResponse.json({
      success: true,
      newlyUnlocked,
      totalUnlocked: alreadyUnlocked.size + newlyUnlocked.length,
      totalAchievements: ACHIEVEMENTS.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
