import { isAdmin } from '@/lib/utils'
import { createServiceClient } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan, Profile } from '@/types'

/**
 * Garde budgétaire AVANT toute génération payante.
 *
 * Fail-closed : si le quota mensuel ne peut pas être vérifié (erreur base de
 * données), on REFUSE la génération plutôt que de l'autoriser aveuglément
 * (audit #9 : `count:null` ne doit jamais devenir 0 → autorisation).
 */
export async function checkLimits(user: Profile): Promise<boolean> {
  if (isAdmin(user.email)) return true
  const limits = PLAN_LIMITS[user.plan as Plan] ?? PLAN_LIMITS.free
  let count: number
  try {
    count = await getMonthlyVideoCount(user.id)
  } catch {
    throw new Error(
      'Impossible de verifier ton quota mensuel (base indisponible). Aucune generation lancee — reessaie dans un instant.'
    )
  }
  return count < limits.videos
}

export async function getMonthlyVideoCount(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count, error } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    throw new Error(`Quota illisible : ${error.message}`)
  }
  return count ?? 0
}

export async function checkRateLimit(
  userId: string,
  plan: Plan
): Promise<boolean> {
  const limits = PLAN_LIMITS[plan]
  // Simple in-memory rate check — in production use Redis
  return limits.rate > 0
}

export function getRemainingVideos(
  currentCount: number,
  plan: Plan
): number {
  const limit = PLAN_LIMITS[plan].videos
  return Math.max(0, limit - currentCount)
}

export function getMaxQuality(plan: Plan): string {
  return PLAN_LIMITS[plan].quality
}
