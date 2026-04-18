import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// CRON hebdo dimanche 20h — clôt le défi courant + crée le suivant
const THEMES_ROTATION = [
  { theme: 'Lumière intérieure', description: 'Un instant de lumière intérieure. Ambiance, pas narration. Moins de 30s.' },
  { theme: 'Rythme urbain', description: 'Une vidéo au rythme de la ville. Cut précis sur la musique.' },
  { theme: 'Silence', description: 'Une vidéo sans mot. Seulement image et son organique.' },
  { theme: 'Contraste', description: 'Deux mondes qui se frôlent en un seul plan.' },
  { theme: 'Première seconde', description: 'La première seconde doit tout dire. Pas de titre, pas d\'intro.' },
  { theme: 'Aube', description: 'La lumière juste avant le jour. Plans larges, peu de coupes.' },
  { theme: 'Gestes minuscules', description: 'Un détail qu\'on ne voit jamais. Agrandi au maximum.' },
  { theme: 'Route ouverte', description: 'Mouvement, horizon, déplacement. Ton film de voyage en 20s.' },
]

function verifyCron(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  return auth === `Bearer ${expected}`
}

export async function POST(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  try {
    const service = createServiceClient()

    // Clôt tous les défis open dont week_end < today
    const todayISO = new Date().toISOString().slice(0, 10)
    const { data: toClose } = await service
      .from('karma_defi_weeks')
      .select('id, theme, pool_seeds, winners_count')
      .eq('status', 'open')
      .lt('week_end', todayISO)

    const closed: string[] = []

    for (const defi of toClose ?? []) {
      // Top winners_count par votes_count
      const { data: topSubs } = await service
        .from('karma_defi_submissions')
        .select('id, user_id, votes_count')
        .eq('defi_week_id', defi.id)
        .order('votes_count', { ascending: false })
        .limit(defi.winners_count ?? 10)

      const winners = topSubs ?? []
      const winnersActive = winners.filter(w => (w.votes_count ?? 0) > 0)

      if (winnersActive.length > 0) {
        const perWinner = Math.floor(defi.pool_seeds / winnersActive.length)
        for (const w of winnersActive) {
          await service
            .from('karma_defi_submissions')
            .update({ is_winner: true, seeds_awarded: perWinner })
            .eq('id', w.id)

          const { data: current } = await service
            .from('karma_seeds')
            .select('balance, lifetime_earned')
            .eq('user_id', w.user_id)
            .maybeSingle()

          const balance = current?.balance ?? 0
          const lifetime = current?.lifetime_earned ?? 0

          await service.from('karma_seeds').upsert(
            {
              user_id: w.user_id,
              balance: balance + perWinner,
              lifetime_earned: lifetime + perWinner,
            },
            { onConflict: 'user_id' }
          )

          await service.from('karma_seed_transactions').insert({
            user_id: w.user_id,
            amount: perWinner,
            direction: 'earn',
            source: 'defi_winner',
            source_ref: defi.id,
            reason: `Gagnant Défi Collectif « ${defi.theme} »`,
          })
        }
      }

      await service.from('karma_defi_weeks').update({ status: 'closed' }).eq('id', defi.id)
      closed.push(defi.id)
    }

    // Crée le prochain défi si aucun open
    const { data: openNow } = await service
      .from('karma_defi_weeks')
      .select('id')
      .eq('status', 'open')
      .lte('week_start', todayISO)
      .gte('week_end', todayISO)
      .maybeSingle()

    let created: string | null = null

    if (!openNow) {
      const rand = THEMES_ROTATION[Math.floor(Math.random() * THEMES_ROTATION.length)]
      const nextStart = new Date()
      // Lundi prochain
      const day = nextStart.getDay()
      const diff = day === 1 ? 0 : (8 - day) % 7
      nextStart.setDate(nextStart.getDate() + diff)
      const nextEnd = new Date(nextStart)
      nextEnd.setDate(nextEnd.getDate() + 6)

      const { data: newDefi } = await service
        .from('karma_defi_weeks')
        .insert({
          week_start: nextStart.toISOString().slice(0, 10),
          week_end: nextEnd.toISOString().slice(0, 10),
          theme: rand.theme,
          description: rand.description,
          pool_seeds: 5000,
          winners_count: 10,
          status: 'open',
        })
        .select('id')
        .single()

      created = newDefi?.id ?? null
    }

    return NextResponse.json({
      closed_count: closed.length,
      closed_ids: closed,
      new_defi_id: created,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
