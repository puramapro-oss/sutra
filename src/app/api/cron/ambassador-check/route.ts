import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { AMBASSADOR_TIERS } from '@/lib/ambassador'
import { sendNotification } from '@/lib/logger'

// V6 Section 10 — CRON quotidien check paliers ambassadeur
// Pour chaque user ayant filleuls_actifs >= seuil, insert dans ambassador_tiers
// (unique par level → 1 seule fois) + prime en wallet + notif + social_feed

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? 'dev'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  // Agrégat filleuls actifs N1 par parrain
  const { data: profiles } = await service.from('profiles').select('id, name')

  let primesGranted = 0

  for (const profile of profiles ?? []) {
    const { data: referrals } = await service
      .from('referrals')
      .select('id')
      .eq('referrer_id', profile.id)
      .eq('status', 'active')
      .eq('level', 1)

    const count = referrals?.length ?? 0

    for (const tier of AMBASSADOR_TIERS) {
      if (count < tier.filleuls_required) continue

      const { error } = await service.from('ambassador_tiers').insert({
        user_id: profile.id,
        tier_name: tier.name,
        tier_level: tier.level,
        prime_paid_cents: tier.prime_eur * 100,
      })

      if (!error) {
        primesGranted++

        // Crédit wallet
        const { data: w } = await service
          .from('wallets')
          .select('balance, total_earned')
          .eq('user_id', profile.id)
          .single()
        if (w) {
          await service.from('wallets').update({
            balance: (w.balance ?? 0) + tier.prime_eur,
            total_earned: (w.total_earned ?? 0) + tier.prime_eur,
          }).eq('user_id', profile.id)
        }

        await service.from('wallet_transactions').insert({
          user_id: profile.id,
          type: 'credit',
          amount: tier.prime_eur,
          source: 'ambassador_tier',
          description: `Palier ambassadeur ${tier.display} atteint — ${tier.prime_eur}€`,
        })

        await sendNotification(profile.id, {
          type: 'achievement',
          title: `Palier ${tier.display} débloqué !`,
          message: `Prime de ${tier.prime_eur}€ créditée. Tu es maintenant ambassadeur ${tier.display}.`,
        })

        // Social feed — événement sans montant
        const displayName = (profile.name ?? 'Un membre').split(' ')[0]
        await service.from('social_feed').insert({
          user_id: profile.id,
          event_type: tier.name,
          display_name: displayName,
          metadata: { tier: tier.display },
        })
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    primes_granted: primesGranted,
    users_checked: profiles?.length ?? 0,
  })
}
