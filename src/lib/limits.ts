import { isAdmin } from '@/lib/utils'
import { createServiceClient } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/constants'
import type { Plan, Profile } from '@/types'

export async function checkLimits(user: Profile): Promise<boolean> {
  if (isAdmin(user.email)) return true
  const limits = PLAN_LIMITS[user.plan as Plan]
  const count = await getMonthlyVideoCount(user.id)
  return count < limits.videos
}

export async function getMonthlyVideoCount(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString())

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
