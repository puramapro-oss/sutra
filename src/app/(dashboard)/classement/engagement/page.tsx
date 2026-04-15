import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase'
import { PuramaScoreCard } from '@/components/engagement/PuramaScoreCard'
import { AmbassadorTierBadge } from '@/components/engagement/AmbassadorTierBadge'
import { SocialFeed } from '@/components/engagement/SocialFeed'
import { SeasonBanner } from '@/components/engagement/SeasonBanner'
import { ImpactDashboard } from '@/components/engagement/ImpactDashboard'

export const metadata = { title: 'Mon engagement — SUTRA' }

export default async function EngagementPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/classement/engagement')

  const service = createServiceClient()
  const { data: referrals } = await service
    .from('referrals')
    .select('id')
    .eq('referrer_id', user.id)
    .eq('status', 'active')
    .eq('level', 1)

  const filleulsCount = referrals?.length ?? 0

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Mon engagement</h1>
        <p className="text-white/60 mt-1">Score, paliers, saison et impact — tout est lié.</p>
      </header>

      <SeasonBanner />

      <div className="grid lg:grid-cols-2 gap-6">
        <PuramaScoreCard />
        <AmbassadorTierBadge filleulsCount={filleulsCount} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ImpactDashboard />
        <SocialFeed limit={10} />
      </div>
    </div>
  )
}
