import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendNotification } from '@/lib/logger'

// V6 Section 17 — CRON quotidien détection paliers fiscaux
// 1 notification par palier par user (UNIQUE contrainte DB).
// Paliers: 1500€ → palier 1, 2500€ → palier 2, 3000€ → palier 3.

const PALIERS = [
  { palier: 1, seuil: 1500, title: 'Tu as gagné 1 500 €', message: 'À 3 000 € tu devras déclarer tes gains. Aucune action requise pour le moment.' },
  { palier: 2, seuil: 2500, title: 'Plus que 500 € avant le seuil', message: 'À 3 000 €, déclare sur impots.gouv.fr → case 5NG → montant Purama.' },
  { palier: 3, seuil: 3000, title: 'Tu dois déclarer tes gains', message: 'Abattement 34% auto = imposé sur 66%. Récapitulatif PDF en janvier.' },
]

export async function POST(req: Request) {
  // Protection CRON : header authorization
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

  // Récupérer tous les users qui ont au moins 1500€ de gains cette année
  const { data: aggregates } = await service
    .rpc('fiscal_user_totals', { since: yearStart })
    .select()

  // Fallback si la fonction SQL n'existe pas : itérer profiles + somme wallet_transactions
  let userTotals: Array<{ user_id: string; total: number }> = []
  if (!aggregates) {
    const { data: profiles } = await service.from('profiles').select('id')
    for (const p of profiles ?? []) {
      const { data: txs } = await service
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', p.id)
        .eq('type', 'credit')
        .gte('created_at', yearStart)
      const total = (txs ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0)
      if (total >= 1500) userTotals.push({ user_id: p.id, total })
    }
  } else {
    userTotals = aggregates as Array<{ user_id: string; total: number }>
  }

  let notifiedCount = 0

  for (const u of userTotals) {
    for (const p of PALIERS) {
      if (u.total < p.seuil) continue

      // Insert avec ON CONFLICT → 1 seule notif par palier
      const { error } = await service.from('fiscal_notifications').insert({
        user_id: u.user_id,
        palier: p.palier,
        push_sent: true,
        email_sent: false,
      })

      if (!error) {
        notifiedCount++
        await sendNotification(u.user_id, {
          type: p.palier === 3 ? 'warning' : 'info',
          title: p.title,
          message: p.message,
        })
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    users_checked: userTotals.length,
    notifications_sent: notifiedCount,
  })
}
