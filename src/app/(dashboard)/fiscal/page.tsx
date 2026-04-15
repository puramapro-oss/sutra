import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { FiscalClient } from './FiscalClient'

export const metadata = {
  title: 'Fiscalité — SUTRA',
  description: 'Ta situation fiscale, tes seuils de déclaration et ton récapitulatif annuel.',
}

export default async function FiscalPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/fiscal')

  const service = createServiceClient()

  // Calcul total gains de l'année en cours
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const { data: txs } = await service
    .from('wallet_transactions')
    .select('amount, source, created_at')
    .eq('user_id', user.id)
    .eq('type', 'credit')
    .gte('created_at', yearStart)

  const totals = (txs ?? []).reduce(
    (acc, t) => {
      const amt = Number(t.amount) || 0
      acc.total += amt
      const src = String(t.source ?? '')
      if (src.startsWith('prime_')) acc.primes += amt
      else if (src === 'referral') acc.parrainage += amt
      else if (src.startsWith('nature')) acc.nature += amt
      else if (src === 'marketplace') acc.marketplace += amt
      else if (src === 'mission') acc.missions += amt
      return acc
    },
    { total: 0, primes: 0, parrainage: 0, nature: 0, marketplace: 0, missions: 0 }
  )

  const { data: summary } = await service
    .from('annual_summaries')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', new Date().getFullYear() - 1)
    .maybeSingle()

  return <FiscalClient totals={totals} lastYearSummary={summary ?? null} />
}
