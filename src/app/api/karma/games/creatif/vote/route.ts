import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { z } from 'zod'

const VoteSchema = z.object({
  submission_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = VoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: sub } = await service
      .from('karma_creatif_submissions')
      .select('user_id, status, closes_at')
      .eq('id', parsed.data.submission_id)
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
    }
    if (sub.status !== 'open' || new Date(sub.closes_at) < new Date()) {
      return NextResponse.json({ error: 'Vote fermé.' }, { status: 400 })
    }
    if (sub.user_id === user.id) {
      return NextResponse.json({ error: 'Impossible de voter pour soi-même.' }, { status: 400 })
    }

    const { error: voteErr } = await service
      .from('karma_creatif_votes')
      .insert({ submission_id: parsed.data.submission_id, voter_id: user.id })

    if (voteErr) {
      // UNIQUE violation → déjà voté
      return NextResponse.json({ error: 'Tu as déjà voté pour cette vidéo.' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Vote enregistré.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
