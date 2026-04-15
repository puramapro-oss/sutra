import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// V6 Section 10 — Flywheel public stats
// "X users actifs → Pool Y€ → Chaque user gagne +Z€"
export async function GET() {
  const service = createServiceClient()

  const { count: activeUsers } = await service
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('subscription_status', 'active')

  // Total gains distribués cette année (transparence communautaire)
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const { data: txs } = await service
    .from('wallet_transactions')
    .select('amount')
    .eq('type', 'credit')
    .gte('created_at', yearStart)

  const totalDistributed = (txs ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const users = Math.max(activeUsers ?? 1, 1)
  const avgPerUser = totalDistributed / users

  return NextResponse.json(
    {
      active_users: activeUsers ?? 0,
      total_distributed_eur: Math.round(totalDistributed * 100) / 100,
      avg_per_user_eur: Math.round(avgPerUser * 100) / 100,
      daily_bonus_per_referral: 0.02,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
