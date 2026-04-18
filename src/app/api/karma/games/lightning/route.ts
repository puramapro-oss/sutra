import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    const nowISO = new Date().toISOString()
    const { data: activeDeals } = await service
      .from('karma_lightning_deals')
      .select('*')
      .eq('status', 'active')
      .lte('starts_at', nowISO)
      .gt('ends_at', nowISO)
      .order('ends_at', { ascending: true })

    let myClaims: string[] = []
    if (user && (activeDeals ?? []).length > 0) {
      const { data: claims } = await service
        .from('karma_lightning_claims')
        .select('deal_id')
        .eq('user_id', user.id)
        .in('deal_id', (activeDeals ?? []).map(d => d.id))
      myClaims = (claims ?? []).map(c => c.deal_id)
    }

    const enriched = (activeDeals ?? []).map(d => ({
      ...d,
      already_claimed: myClaims.includes(d.id),
    }))

    return NextResponse.json({ deals: enriched })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
