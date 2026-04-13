import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const PostSchema = z.object({
  content: z.string().min(1, 'Le contenu est requis').max(500, 'Maximum 500 caracteres'),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()

    // Get all entries (last 50)
    const { data: entries } = await service
      .from('gratitude_entries')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    // Count today's entries
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await service
      .from('gratitude_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())

    return NextResponse.json({
      entries: entries ?? [],
      todayCount: count ?? 0,
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
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors.content?.[0] || 'Contenu invalide' },
        { status: 400 }
      )
    }

    const service = createServiceClient()

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count } = await service
      .from('gratitude_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today.toISOString())

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Tu as deja enregistre 3 gratitudes aujourd\'hui. Reviens demain !' },
        { status: 400 }
      )
    }

    // Insert entry
    const { data: entry, error: insertError } = await service
      .from('gratitude_entries')
      .insert({
        user_id: user.id,
        content: parsed.data.content,
      })
      .select('id, content, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
    }

    // Award points
    const pointsAmount = 100
    const { data: points } = await service
      .from('purama_points')
      .select('balance, lifetime_earned')
      .eq('user_id', user.id)
      .single()

    if (points) {
      await service
        .from('purama_points')
        .update({
          balance: points.balance + pointsAmount,
          lifetime_earned: points.lifetime_earned + pointsAmount,
        })
        .eq('user_id', user.id)
    } else {
      await service
        .from('purama_points')
        .insert({
          user_id: user.id,
          balance: pointsAmount,
          lifetime_earned: pointsAmount,
        })
    }

    await service.from('point_transactions').insert({
      user_id: user.id,
      amount: pointsAmount,
      type: 'earn',
      source: 'gratitude',
      description: 'Gratitude quotidienne',
    })

    return NextResponse.json({ entry, points: pointsAmount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
