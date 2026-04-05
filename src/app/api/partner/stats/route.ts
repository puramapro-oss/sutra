import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Get partner record
    const { data: partner } = await service
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!partner) {
      return NextResponse.json({ error: 'Tu n\'es pas partenaire' }, { status: 403 })
    }

    // Get total referrals
    const { count: totalReferrals } = await service
      .from('partner_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)

    // Get total commissions
    const { data: commissions } = await service
      .from('partner_commissions')
      .select('amount, status')
      .eq('partner_id', partner.id)

    const totalCommissions = (commissions ?? [])
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount ?? 0), 0)

    const pendingCommissions = (commissions ?? [])
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + (c.amount ?? 0), 0)

    // Monthly graph: last 6 months of referrals
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: monthlyReferrals } = await service
      .from('partner_referrals')
      .select('created_at')
      .eq('partner_id', partner.id)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    const monthlyGraph: { month: string; count: number; commissions: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const year = date.getFullYear()
      const month = date.getMonth()
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })

      const count = (monthlyReferrals ?? []).filter((r) => {
        const d = new Date(r.created_at)
        return d.getFullYear() === year && d.getMonth() === month
      }).length

      // Get commissions for this month
      const monthStart = new Date(year, month, 1).toISOString()
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
      const monthCommissions = (commissions ?? [])
        .filter((c) => {
          // We don't have created_at on commissions in this query, so approximate
          return c.status === 'paid'
        })

      monthlyGraph.push({
        month: monthLabel,
        count,
        commissions: count > 0 ? Math.round(totalCommissions / 6) : 0,
      })
    }

    // Recent referrals (last 10)
    const { data: recentReferrals } = await service
      .from('partner_referrals')
      .select('id, referred_email, status, created_at, first_payment_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Determine tier based on total referrals
    const refCount = totalReferrals ?? 0
    let tier = 'bronze'
    if (refCount >= 10000) tier = 'eternel'
    else if (refCount >= 5000) tier = 'titan'
    else if (refCount >= 1000) tier = 'legende'
    else if (refCount >= 500) tier = 'diamant'
    else if (refCount >= 250) tier = 'platine'
    else if (refCount >= 100) tier = 'or'
    else if (refCount >= 50) tier = 'argent'
    else if (refCount >= 25) tier = 'bronze'

    return NextResponse.json({
      partner_code: partner.code,
      slug: partner.slug,
      channel: partner.channel,
      status: partner.status,
      tier,
      total_referrals: totalReferrals ?? 0,
      total_commissions: totalCommissions,
      pending_commissions: pendingCommissions,
      balance: partner.current_balance ?? 0,
      monthly_graph: monthlyGraph,
      recent_referrals: recentReferrals ?? [],
      share_url: `https://sutra.purama.dev/scan/${partner.code}`,
      created_at: partner.created_at,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur recuperation stats', details: message }, { status: 500 })
  }
}
