import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const PurchaseSchema = z.object({
  itemId: z.string().uuid(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    const [itemsRes, pointsRes] = await Promise.all([
      service
        .from('point_shop_items')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      service
        .from('purama_points')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .single(),
    ])

    return NextResponse.json({
      items: itemsRes.data ?? [],
      balance: pointsRes.data?.balance ?? 0,
      lifetime_earned: pointsRes.data?.lifetime_earned ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = PurchaseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { itemId } = parsed.data
    const service = createServiceClient()

    // Get the item
    const { data: item } = await service
      .from('point_shop_items')
      .select('*')
      .eq('id', itemId)
      .eq('active', true)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Article introuvable ou indisponible.' }, { status: 404 })
    }

    // Get user points
    let { data: points } = await service
      .from('purama_points')
      .select('balance, lifetime_earned')
      .eq('user_id', user.id)
      .single()

    if (!points) {
      await service.from('purama_points').insert({
        user_id: user.id,
        balance: 0,
        lifetime_earned: 0,
      })
      points = { balance: 0, lifetime_earned: 0 }
    }

    if (points.balance < item.cost_points) {
      return NextResponse.json(
        { error: `Solde insuffisant. Tu as ${points.balance} points, il en faut ${item.cost_points}.` },
        { status: 400 }
      )
    }

    const newBalance = points.balance - item.cost_points

    // Deduct points
    await service
      .from('purama_points')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    // Insert purchase record
    await service.from('point_purchases').insert({
      user_id: user.id,
      item_id: itemId,
      points_spent: item.cost_points,
    })

    // Insert transaction
    await service.from('point_transactions').insert({
      user_id: user.id,
      amount: -item.cost_points,
      type: 'spend',
      source: 'boutique',
      description: `Achat boutique : ${item.name}`,
    })

    // Update profile purama_points
    await service
      .from('profiles')
      .update({ purama_points: newBalance })
      .eq('id', user.id)

    // Apply item effect based on type
    const itemType = item.type as string

    if (itemType === 'reduction') {
      // Create a coupon
      const discountPercent = item.metadata?.discount_percent ?? 10
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)
      const code = `SHOP${discountPercent}-${Date.now().toString(36).toUpperCase()}`

      await service.from('user_coupons').insert({
        user_id: user.id,
        code,
        discount_percent: discountPercent,
        source: 'points',
        expires_at: expiresAt.toISOString(),
        used: false,
      })
    }

    if (itemType === 'ticket') {
      const ticketCount = item.metadata?.ticket_count ?? 1
      const tickets = Array.from({ length: ticketCount }, () => ({
        user_id: user.id,
        source: 'achat_points' as const,
      }))
      await service.from('lottery_tickets').insert(tickets)
    }

    if (itemType === 'feature') {
      // Add credits to profile
      const creditAmount = item.metadata?.credits ?? 5
      const { data: profile } = await service
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      const currentCredits = profile?.credits ?? 0
      await service
        .from('profiles')
        .update({ credits: currentCredits + creditAmount })
        .eq('id', user.id)
    }

    if (itemType === 'cash') {
      // Convert points to wallet euros
      const euros = item.metadata?.euros ?? 1
      const { data: profile } = await service
        .from('profiles')
        .select('wallet_balance')
        .eq('id', user.id)
        .single()

      const currentWallet = profile?.wallet_balance ?? 0
      await service
        .from('profiles')
        .update({ wallet_balance: currentWallet + euros })
        .eq('id', user.id)

      // Also update wallets table
      const { data: wallet } = await service
        .from('wallets')
        .select('balance, total_earned')
        .eq('user_id', user.id)
        .single()

      if (wallet) {
        await service
          .from('wallets')
          .update({
            balance: wallet.balance + euros,
            total_earned: wallet.total_earned + euros,
          })
          .eq('user_id', user.id)

        await service.from('wallet_transactions').insert({
          user_id: user.id,
          type: 'credit',
          amount: euros,
          source: 'points_shop',
          description: `Conversion boutique : ${item.cost_points} points = ${euros} EUR`,
        })
      }
    }

    if (itemType === 'subscription') {
      // Mark as purchased — Stripe integration handled separately
      await service.from('point_purchases').update({
        metadata: { status: 'pending_activation', item_name: item.name },
      }).eq('user_id', user.id).eq('item_id', itemId).order('created_at', { ascending: false }).limit(1)
    }

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        name: item.name,
        type: itemType,
        cost_points: item.cost_points,
      },
      newBalance,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
