import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { AbonnementClient } from './AbonnementClient'

export const metadata = { title: 'Mon abonnement — SUTRA' }

export default async function AbonnementPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/settings/abonnement')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('plan, subscription_status, stripe_subscription_id, subscription_started_at')
    .eq('id', user.id)
    .single()

  const { data: subscription } = await service
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('app_id', 'sutra')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Stats pour l'UI résiliation (pertes à afficher)
  const { data: primeScheduled } = await service
    .from('prime_payouts')
    .select('amount_cents')
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  const pendingPrimeEuros = ((primeScheduled ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0)) / 100

  const { data: activeReferrals } = await service
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)
    .eq('status', 'active')

  const filleulsCount = activeReferrals?.length ?? 0

  return (
    <AbonnementClient
      profile={{
        plan: profile?.plan ?? 'free',
        status: profile?.subscription_status ?? 'inactive',
        subscription_started_at: profile?.subscription_started_at ?? null,
        stripe_subscription_id: profile?.stripe_subscription_id ?? null,
      }}
      subscription={subscription}
      pendingPrimeEuros={pendingPrimeEuros}
      filleulsCount={filleulsCount}
    />
  )
}
