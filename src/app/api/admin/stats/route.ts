import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/utils'
import { cached } from '@/lib/redis'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: 'Acces interdit' }, { status: 403 })
    }

    const stats = await cached(
      'admin:stats',
      async () => {
        const serviceClient = createServiceClient()

        const [
          { count: totalUsers },
          { count: payingUsers },
          { count: totalVideos },
          { count: activeUsers7d },
          { data: revenueData },
          { data: apiCosts },
          { data: planDistribution },
        ] = await Promise.all([
          serviceClient.from('profiles').select('*', { count: 'exact', head: true }),
          serviceClient.from('profiles').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
          serviceClient.from('videos').select('*', { count: 'exact', head: true }),
          serviceClient.from('profiles').select('*', { count: 'exact', head: true }).gte(
            'updated_at',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
          serviceClient.from('payments').select('amount, created_at').eq('status', 'succeeded'),
          serviceClient.from('api_logs').select('estimated_cost').gte(
            'created_at',
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ),
          serviceClient.from('profiles').select('plan'),
        ])

        const totalRevenue = (revenueData ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const mrr = (revenueData ?? [])
          .filter((p) => p.created_at >= thirtyDaysAgo)
          .reduce((sum, p) => sum + (p.amount ?? 0), 0)
        const totalApiCosts = (apiCosts ?? []).reduce((sum, l) => sum + (l.estimated_cost ?? 0), 0)

        const plans: Record<string, number> = {}
        for (const p of planDistribution ?? []) {
          const plan = p.plan ?? 'free'
          plans[plan] = (plans[plan] ?? 0) + 1
        }

        return {
          total_users: totalUsers ?? 0,
          paying_users: payingUsers ?? 0,
          total_videos: totalVideos ?? 0,
          active_users_7d: activeUsers7d ?? 0,
          total_revenue: totalRevenue,
          mrr,
          total_api_costs_30d: totalApiCosts,
          plan_distribution: plans,
        }
      },
      120
    )

    return NextResponse.json(stats)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation stats admin', details: message }, { status: 500 })
  }
}
