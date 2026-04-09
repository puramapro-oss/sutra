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

    // Get current/upcoming draw
    const { data: currentDraw } = await service
      .from('lottery_draws')
      .select('id, draw_date, pool_amount, status')
      .eq('app_slug', 'sutra')
      .in('status', ['upcoming', 'live'])
      .order('draw_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!currentDraw) {
      return NextResponse.json({
        draw: null,
        tickets: 0,
        message: 'Aucun tirage en cours. Reviens bientot !',
      })
    }

    // Get user's ticket count for current draw
    const { count: ticketCount } = await service
      .from('lottery_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('draw_id', currentDraw.id)

    // Get total tickets for this draw
    const { count: totalTickets } = await service
      .from('lottery_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('draw_id', currentDraw.id)

    // Get last completed draw results
    const { data: lastDraw } = await service
      .from('lottery_draws')
      .select('id, draw_date, pool_amount, status')
      .eq('app_slug', 'sutra')
      .eq('status', 'completed')
      .order('draw_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let lastWinners: unknown[] = []
    if (lastDraw) {
      const { data: winners } = await service
        .from('lottery_winners')
        .select('rank, amount_won, user_id, profiles(full_name)')
        .eq('draw_id', lastDraw.id)
        .order('rank', { ascending: true })

      lastWinners = winners ?? []
    }

    return NextResponse.json({
      draw: {
        id: currentDraw.id,
        draw_date: currentDraw.draw_date,
        pool_amount: currentDraw.pool_amount,
        status: currentDraw.status,
        total_tickets: totalTickets ?? 0,
      },
      tickets: ticketCount ?? 0,
      last_draw: lastDraw
        ? {
            draw_date: lastDraw.draw_date,
            pool_amount: lastDraw.pool_amount,
            winners: lastWinners,
          }
        : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
