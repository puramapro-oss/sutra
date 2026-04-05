import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Verify partner
    const { data: partner } = await service
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!partner) {
      return NextResponse.json({ error: 'Tu n\'es pas partenaire' }, { status: 403 })
    }

    // Parse pagination
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)))
    const offset = (page - 1) * limit

    // Get total count
    const { count: totalCount } = await service
      .from('partner_commissions')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partner.id)

    // Get paginated commissions
    const { data: commissions, error: fetchError } = await service
      .from('partner_commissions')
      .select(`
        id,
        amount,
        currency,
        type,
        status,
        level,
        stripe_payment_id,
        description,
        created_at,
        updated_at,
        referral_id
      `)
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Erreur recuperation commissions', details: fetchError.message },
        { status: 500 }
      )
    }

    // Enrich with referral details if available
    const referralIds = (commissions ?? [])
      .map((c) => c.referral_id)
      .filter(Boolean)

    let referralDetails: Record<string, { referred_email: string; status: string }> = {}
    if (referralIds.length > 0) {
      const { data: referrals } = await service
        .from('partner_referrals')
        .select('id, referred_email, status')
        .in('id', referralIds)

      if (referrals) {
        referralDetails = Object.fromEntries(
          referrals.map((r) => [r.id, { referred_email: r.referred_email, status: r.status }])
        )
      }
    }

    const enrichedCommissions = (commissions ?? []).map((c) => ({
      ...c,
      referral: c.referral_id ? (referralDetails[c.referral_id] ?? null) : null,
    }))

    const total = totalCount ?? 0

    return NextResponse.json({
      commissions: enrichedCommissions,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur commissions', details: message }, { status: 500 })
  }
}
