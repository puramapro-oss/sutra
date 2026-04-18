import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const SubmitSchema = z.object({
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional().nullable(),
  caption: z.string().max(280).optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    // Récupère le défi en cours (week_start <= today <= week_end, status=open)
    const todayISO = new Date().toISOString().slice(0, 10)
    const { data: currentDefi } = await service
      .from('karma_defi_weeks')
      .select('*')
      .lte('week_start', todayISO)
      .gte('week_end', todayISO)
      .eq('status', 'open')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!currentDefi) {
      return NextResponse.json({
        defi: null,
        submissions: [],
        my_submission: null,
      })
    }

    // Top 20 soumissions triées par votes
    const { data: submissions } = await service
      .from('karma_defi_submissions')
      .select(`
        id, user_id, video_url, thumbnail_url, caption, votes_count, is_winner, seeds_awarded, submitted_at
      `)
      .eq('defi_week_id', currentDefi.id)
      .order('votes_count', { ascending: false })
      .limit(20)

    // Enrichir avec le nom/full_name du user
    const userIds = (submissions ?? []).map(s => s.user_id)
    let profilesMap: Record<string, { full_name: string | null; avatar: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name, avatar')
        .in('id', userIds)
      profilesMap = Object.fromEntries(
        (profiles ?? []).map(p => [p.id, { full_name: p.full_name, avatar: p.avatar }])
      )
    }

    const enriched = (submissions ?? []).map(s => ({
      ...s,
      creator: profilesMap[s.user_id] ?? { full_name: null, avatar: null },
    }))

    let mySubmission = null
    if (user) {
      const { data } = await service
        .from('karma_defi_submissions')
        .select('id, video_url, votes_count, is_winner, seeds_awarded, submitted_at')
        .eq('defi_week_id', currentDefi.id)
        .eq('user_id', user.id)
        .maybeSingle()
      mySubmission = data
    }

    return NextResponse.json({
      defi: currentDefi,
      submissions: enriched,
      my_submission: mySubmission,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = SubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide', details: parsed.error.issues }, { status: 400 })
    }

    const service = createServiceClient()
    const todayISO = new Date().toISOString().slice(0, 10)

    const { data: currentDefi } = await service
      .from('karma_defi_weeks')
      .select('id, status')
      .lte('week_start', todayISO)
      .gte('week_end', todayISO)
      .eq('status', 'open')
      .maybeSingle()

    if (!currentDefi) {
      return NextResponse.json({ error: 'Aucun défi ouvert en ce moment.' }, { status: 400 })
    }

    // Vérifier qu'il n'a pas déjà soumis
    const { data: existing } = await service
      .from('karma_defi_submissions')
      .select('id')
      .eq('defi_week_id', currentDefi.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Tu as déjà soumis une vidéo pour ce défi.' },
        { status: 400 }
      )
    }

    const { data: sub, error: insertErr } = await service
      .from('karma_defi_submissions')
      .insert({
        defi_week_id: currentDefi.id,
        user_id: user.id,
        video_url: parsed.data.video_url,
        thumbnail_url: parsed.data.thumbnail_url ?? null,
        caption: parsed.data.caption ?? null,
      })
      .select('id')
      .single()

    if (insertErr || !sub) {
      return NextResponse.json({ error: insertErr?.message ?? 'Erreur insertion' }, { status: 500 })
    }

    // Mission "share-story" auto-créditée (+40 seeds) pour participation
    const { data: shareMission } = await service
      .from('karma_missions')
      .select('id, seeds_reward')
      .eq('slug', 'community-wall')
      .maybeSingle()

    if (shareMission) {
      const { data: current } = await service
        .from('karma_seeds')
        .select('balance, lifetime_earned')
        .eq('user_id', user.id)
        .maybeSingle()
      const balance = current?.balance ?? 0
      const lifetime = current?.lifetime_earned ?? 0
      await service.from('karma_seeds').upsert(
        { user_id: user.id, balance: balance + 25, lifetime_earned: lifetime + 25 },
        { onConflict: 'user_id' }
      )
      await service.from('karma_seed_transactions').insert({
        user_id: user.id,
        amount: 25,
        direction: 'earn',
        source: 'defi_submission',
        source_ref: sub.id,
        reason: 'Participation au Défi Collectif',
      })
    }

    return NextResponse.json({
      submission_id: sub.id,
      message: 'Vidéo soumise. La communauté peut voter. +25 🌱 pour ta participation.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
