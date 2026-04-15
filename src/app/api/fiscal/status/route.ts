import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

  const { data: txs } = await service
    .from('wallet_transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('type', 'credit')
    .gte('created_at', yearStart)

  const total = (txs ?? []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  return NextResponse.json({ total, year: new Date().getFullYear() })
}
