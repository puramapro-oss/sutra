import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { isSuperAdmin } from '@/lib/utils'
import { cached } from '@/lib/redis'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Non autorise' }, { status: 401 }) }
  }
  if (!isSuperAdmin(user.email)) {
    return { error: NextResponse.json({ error: 'Acces interdit' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(req: Request) {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const service = createServiceClient()

    // ----------------------------------------------------------
    // type=activity — recent activity feed
    // ----------------------------------------------------------
    if (type === 'activity') {
      const { data, error } = await service
        .from('activity_logs')
        .select('id, type, description, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return NextResponse.json({ events: data ?? [] })
    }

    // ----------------------------------------------------------
    // type=config — fetch app_config rows grouped by section
    // ----------------------------------------------------------
    if (type === 'config') {
      const { data, error } = await service.from('app_config').select('key, value')
      if (error) throw error
      const config: Record<string, Record<string, unknown>> = {}
      for (const row of data ?? []) {
        // key format "section.field" e.g. "landing.hero_title"
        const [section, field] = row.key.split('.')
        if (!section || !field) continue
        if (!config[section]) config[section] = {}
        config[section][field] = row.value
      }
      return NextResponse.json({ config })
    }

    // ----------------------------------------------------------
    // type=revenue_chart — payments grouped by day for last 90 days
    // ----------------------------------------------------------
    if (type === 'revenue_chart') {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const { data, error } = await service
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'succeeded')
        .gte('created_at', ninetyDaysAgo.toISOString())
        .order('created_at', { ascending: true })
      if (error) throw error

      const buckets: Record<string, number> = {}
      for (let i = 89; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        buckets[d.toISOString().slice(0, 10)] = 0
      }
      for (const p of data ?? []) {
        const day = (p.created_at ?? '').slice(0, 10)
        if (day in buckets) buckets[day] += Number(p.amount ?? 0)
      }
      const series = Object.entries(buckets).map(([date, amount]) => ({
        date,
        amount: Number(amount.toFixed(2)),
      }))
      return NextResponse.json({ series })
    }

    // ----------------------------------------------------------
    // type=service_costs — api_logs grouped by service for 30 days
    // ----------------------------------------------------------
    if (type === 'service_costs') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const { data, error } = await service
        .from('api_logs')
        .select('service, estimated_cost')
        .gte('created_at', thirtyDaysAgo.toISOString())
      if (error) throw error
      const totals: Record<string, number> = {}
      for (const log of data ?? []) {
        const key = (log.service ?? 'other').toLowerCase()
        totals[key] = (totals[key] ?? 0) + Number(log.estimated_cost ?? 0)
      }
      return NextResponse.json({ services: totals })
    }

    // ----------------------------------------------------------
    // type=referral_stats — partner commissions and top partners
    // ----------------------------------------------------------
    if (type === 'referral_stats') {
      const [{ data: commissions }, { data: partners }] = await Promise.all([
        service
          .from('partner_commissions')
          .select('amount, status'),
        service
          .from('partners')
          .select('id, partner_code, total_referrals, total_commissions')
          .order('total_commissions', { ascending: false })
          .limit(5),
      ])

      const paid = (commissions ?? [])
        .filter((c) => c.status === 'paid')
        .reduce((sum, c) => sum + Number(c.amount ?? 0), 0)
      const pending = (commissions ?? [])
        .filter((c) => c.status === 'pending')
        .reduce((sum, c) => sum + Number(c.amount ?? 0), 0)

      return NextResponse.json({
        commissions_paid: paid,
        commissions_pending: pending,
        top_partners: (partners ?? []).map((p) => ({
          code: p.partner_code,
          referrals: p.total_referrals ?? 0,
          commissions: Number(p.total_commissions ?? 0),
        })),
      })
    }

    // ----------------------------------------------------------
    // Default: aggregated dashboard stats
    // ----------------------------------------------------------
    const stats = await cached(
      'admin:stats',
      async () => {
        const [
          { count: totalUsers },
          { count: payingUsers },
          { count: totalVideos },
          { count: activeUsers7d },
          { data: revenueData },
          { data: apiCosts },
          { data: planDistribution },
        ] = await Promise.all([
          service.from('profiles').select('*', { count: 'exact', head: true }),
          service.from('profiles').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
          service.from('videos').select('*', { count: 'exact', head: true }),
          service.from('profiles').select('*', { count: 'exact', head: true }).gte(
            'updated_at',
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          ),
          service.from('payments').select('amount, created_at').eq('status', 'succeeded'),
          service.from('api_logs').select('estimated_cost').gte(
            'created_at',
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          ),
          service.from('profiles').select('plan'),
        ])

        const totalRevenue = (revenueData ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const mrr = (revenueData ?? [])
          .filter((p) => (p.created_at ?? '') >= thirtyDaysAgo)
          .reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
        const totalApiCosts = (apiCosts ?? []).reduce((sum, l) => sum + Number(l.estimated_cost ?? 0), 0)

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

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin()
    if ('error' in guard) return guard.error

    const body = await req.json()
    if (body?.type !== 'save_config') {
      return NextResponse.json({ error: 'Type non supporte' }, { status: 400 })
    }

    const section = String(body.section ?? '').trim()
    const values = body.values && typeof body.values === 'object' ? body.values : null
    if (!section || !values) {
      return NextResponse.json({ error: 'section/values requis' }, { status: 400 })
    }

    const service = createServiceClient()
    const rows = Object.entries(values).map(([field, value]) => ({
      key: `${section}.${field}`,
      value,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await service.from('app_config').upsert(rows, { onConflict: 'key' })
    if (error) throw error

    return NextResponse.json({ success: true, saved: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur sauvegarde config', details: message }, { status: 500 })
  }
}
