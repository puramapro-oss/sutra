import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const FeedbackSchema = z.object({
  rating: z.number().int().min(1, 'Note minimum : 1').max(5, 'Note maximum : 5'),
  comment: z.string().max(2000, 'Maximum 2000 caracteres').optional(),
  category: z.string().max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { rating, comment, category } = parsed.data
    const service = createServiceClient()

    // Check max 1 feedback per 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentFeedback } = await service
      .from('user_feedback')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('app_slug', 'sutra')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1)
      .maybeSingle()

    if (recentFeedback) {
      return NextResponse.json({
        error: 'Tu as deja donne ton avis recemment. Reviens dans 30 jours !',
      }, { status: 429 })
    }

    // Insert feedback
    const { data: feedback, error: feedbackError } = await service
      .from('user_feedback')
      .insert({
        user_id: user.id,
        app_slug: 'sutra',
        rating,
        comment: comment ?? null,
        category: category ?? null,
        points_given: 200,
      })
      .select('id, rating, comment, created_at, points_given')
      .single()

    if (feedbackError) {
      return NextResponse.json({ error: feedbackError.message }, { status: 500 })
    }

    // Award 200 points
    await service.from('point_transactions').insert({
      user_id: user.id,
      amount: 200,
      type: 'earn',
      source_app: 'sutra',
      description: 'Feedback soumis — merci pour ton retour !',
    })

    const rpcRes = await service.rpc('increment_points', { uid: user.id, pts: 200 })
    if (rpcRes.error) {
      await service
        .from('profiles')
        .update({ purama_points: 200 })
        .eq('id', user.id)
    }

    return NextResponse.json({ feedback, points_awarded: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
