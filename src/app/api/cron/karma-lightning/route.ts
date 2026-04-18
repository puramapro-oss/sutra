import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// CRON toutes les 4h: génère 0-1 lightning deal aléatoire + clôt expirés
function verifyCron(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  return auth === `Bearer ${expected}`
}

const DEAL_TEMPLATES = [
  { title: 'Crée une vidéo en 10 min', action_label: 'Créer maintenant', action_type: 'create_video' as const, seeds: 1000 },
  { title: 'Partage une vidéo', action_label: 'Partager', action_type: 'share' as const, seeds: 500 },
  { title: 'Invite un·e créateur·rice', action_label: 'Inviter', action_type: 'invite' as const, seeds: 800 },
  { title: 'Laisse 3 feedbacks', action_label: 'Commenter', action_type: 'comment' as const, seeds: 600 },
  { title: 'Soumets au Défi Collectif', action_label: 'Soumettre', action_type: 'create_video' as const, seeds: 1200 },
]

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const service = createServiceClient()
    const nowISO = new Date().toISOString()

    // Clôt deals expirés
    await service
      .from('karma_lightning_deals')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('ends_at', nowISO)

    let createdId: string | null = null

    // 60% chance de générer un deal
    if (Math.random() < 0.6) {
      const tpl = DEAL_TEMPLATES[Math.floor(Math.random() * DEAL_TEMPLATES.length)]
      const endsAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      const { data: created } = await service
        .from('karma_lightning_deals')
        .insert({
          title: tpl.title,
          action_label: tpl.action_label,
          action_type: tpl.action_type,
          seeds_reward: tpl.seeds,
          ends_at: endsAt,
          max_claimers: 100,
          status: 'active',
        })
        .select('id')
        .single()

      createdId = created?.id ?? null
    }

    return NextResponse.json({
      new_deal_id: createdId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
