import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const service = createServiceClient()
  const { data } = await service
    .from('magic_moments')
    .select('first_withdrawal_at, first_withdrawal_amount, animation_shown')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    should_show: !!(data?.first_withdrawal_at && !data.animation_shown),
    amount: data?.first_withdrawal_amount ?? null,
  })
}
