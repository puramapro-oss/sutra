import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getConnectAccountByUserId } from '@/lib/connect'
import { normalizeSubWallets } from '@/lib/smart-split'
import { createServiceClient } from '@/lib/supabase'
import { PaiementClient } from './PaiementClient'

export const metadata = { title: 'Paiements & Retraits — SUTRA' }
export const dynamic = 'force-dynamic'

export default async function PaiementPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/settings/paiement')

  const service = createServiceClient()

  const [connectAccount, walletRow] = await Promise.all([
    getConnectAccountByUserId(user.id),
    service
      .from('wallets')
      .select('balance, sub_wallets')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const subWallets = normalizeSubWallets(walletRow.data?.sub_wallets)

  return (
    <PaiementClient
      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
      connectAccount={
        connectAccount
          ? {
              stripeAccountId: connectAccount.stripe_account_id,
              payoutsEnabled: connectAccount.payouts_enabled,
              chargesEnabled: connectAccount.charges_enabled,
              detailsSubmitted: connectAccount.details_submitted,
              onboardingCompleted: connectAccount.onboarding_completed,
              requirementsCurrentlyDue: connectAccount.requirements_currently_due,
              requirementsPastDue: connectAccount.requirements_past_due,
            }
          : null
      }
      wallet={{
        balance: Number(walletRow.data?.balance ?? 0),
        principal: subWallets.principal,
      }}
    />
  )
}
