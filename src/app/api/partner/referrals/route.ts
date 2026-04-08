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

    const { data: partner } = await service
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partner) {
      return NextResponse.json({ referrals: [] })
    }

    const { data, error } = await service
      .from('partner_referrals')
      .select('id, referred_email, status, plan, created_at, first_payment_at')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const referrals = (data ?? []).map((r) => ({
      id: r.id,
      email: r.referred_email ?? 'utilisateur',
      status: (r.status === 'active' || r.status === 'converted') ? 'active' : 'pending',
      plan: r.plan,
      created_at: r.created_at,
      first_payment_at: r.first_payment_at,
    }))

    return NextResponse.json({ referrals })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
