import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const ShareSchema = z.object({
  platformHint: z.string().max(50).optional(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const service = createServiceClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [sharesTodayRes, totalConversionsRes] = await Promise.all([
      service
        .from('social_shares')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('app_slug', 'sutra')
        .gte('shared_at', todayStart.toISOString()),
      service
        .from('share_conversions')
        .select('id', { count: 'exact', head: true })
        .in(
          'share_id',
          (await service
            .from('social_shares')
            .select('id')
            .eq('user_id', user.id)
            .eq('app_slug', 'sutra')
          ).data?.map((s) => s.id) ?? []
        ),
    ])

    return NextResponse.json({
      shares_today: sharesTodayRes.count ?? 0,
      max_shares_per_day: 3,
      total_conversions: totalConversionsRes.count ?? 0,
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
    const parsed = ShareSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { platformHint } = parsed.data
    const service = createServiceClient()

    // Get user's referral code as share_code
    const { data: profile } = await service
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single()

    const shareCode = profile?.referral_code ?? user.id.slice(0, 8)

    // Check daily limit
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: sharesToday } = await service
      .from('social_shares')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('app_slug', 'sutra')
      .gte('shared_at', todayStart.toISOString())

    const canEarnPoints = (sharesToday ?? 0) < 3

    // Insert share
    const { data: share, error: shareError } = await service
      .from('social_shares')
      .insert({
        user_id: user.id,
        app_slug: 'sutra',
        share_code: shareCode,
        platform_hint: platformHint ?? null,
        points_given: canEarnPoints ? 300 : 0,
      })
      .select('id, share_code, shared_at, points_given')
      .single()

    if (shareError) {
      return NextResponse.json({ error: shareError.message }, { status: 500 })
    }

    // Award points if under daily limit
    let pointsAwarded = 0
    if (canEarnPoints) {
      pointsAwarded = 300
      await service.from('point_transactions').insert({
        user_id: user.id,
        amount: 300,
        type: 'earn',
        source_app: 'sutra',
        description: 'Partage social quotidien',
      })

      const rpcRes = await service.rpc('increment_points', { uid: user.id, pts: 300 })
      if (rpcRes.error) {
        await service
          .from('profiles')
          .update({ purama_points: 300 })
          .eq('id', user.id)
      }
    }

    return NextResponse.json({
      share,
      share_url: `https://sutra.purama.dev/share/${shareCode}`,
      points_awarded: pointsAwarded,
      shares_remaining_today: Math.max(0, 3 - (sharesToday ?? 0) - 1),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
