import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const SubmitSchema = z.object({
  title: z.string().min(3).max(120),
  prompt: z.string().min(5).max(500),
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const service = createServiceClient()

    const nowISO = new Date().toISOString()
    const { data: openSubs } = await service
      .from('karma_creatif_submissions')
      .select('id, user_id, title, prompt, video_url, thumbnail_url, votes_count, status, opens_at, closes_at, seeds_awarded')
      .eq('status', 'open')
      .gt('closes_at', nowISO)
      .order('votes_count', { ascending: false })
      .limit(30)

    const userIds = (openSubs ?? []).map(s => s.user_id)
    let profilesMap: Record<string, { full_name: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      profilesMap = Object.fromEntries(
        (profiles ?? []).map(p => [p.id, { full_name: p.full_name }])
      )
    }

    let myVotes: string[] = []
    if (user && (openSubs ?? []).length > 0) {
      const { data: votes } = await service
        .from('karma_creatif_votes')
        .select('submission_id')
        .eq('voter_id', user.id)
        .in('submission_id', (openSubs ?? []).map(s => s.id))
      myVotes = (votes ?? []).map(v => v.submission_id)
    }

    const enriched = (openSubs ?? []).map(s => ({
      ...s,
      creator: profilesMap[s.user_id] ?? { full_name: null },
      has_voted: myVotes.includes(s.id),
    }))

    return NextResponse.json({ submissions: enriched })
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
    const closesAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

    const { data: sub, error: insertErr } = await service
      .from('karma_creatif_submissions')
      .insert({
        user_id: user.id,
        title: parsed.data.title,
        prompt: parsed.data.prompt,
        video_url: parsed.data.video_url,
        thumbnail_url: parsed.data.thumbnail_url ?? null,
        closes_at: closesAt,
      })
      .select('id, closes_at')
      .single()

    if (insertErr || !sub) {
      return NextResponse.json({ error: insertErr?.message ?? 'Erreur insertion' }, { status: 500 })
    }

    return NextResponse.json({
      submission_id: sub.id,
      closes_at: sub.closes_at,
      message: 'Vidéo en vote pendant 48h.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
