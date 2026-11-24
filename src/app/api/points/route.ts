import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [pointsRes, txRes, profileRes] = await Promise.all([
      service
        .from('purama_points')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .single(),
      service
        .from('point_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      service
        .from('profiles')
        .select('streak, level, xp, purama_points')
        .eq('id', user.id)
        .single(),
    ])

    return NextResponse.json({
      points: {
        balance: pointsRes.data?.balance ?? 0,
        lifetime_earned: pointsRes.data?.lifetime_earned ?? 0,
      },
      transactions: txRes.data ?? [],
      streak: profileRes.data?.streak ?? 0,
      level: profileRes.data?.level ?? 1,
      xp: profileRes.data?.xp ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    // A verified session cannot authorize a client-selected reward or debit.
    // Dedicated server-verified actions own point mutations; never convert a
    // browser-supplied amount/source into service-role writes or wallet credits.
    return NextResponse.json(
      { error: 'Modification directe des points non autorisee' },
      { status: 403 }
    )
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
