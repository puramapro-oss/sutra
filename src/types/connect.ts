export type ConnectAccountRow = {
  user_id: string
  stripe_account_id: string
  onboarding_completed: boolean
  payouts_enabled: boolean
  charges_enabled: boolean
  details_submitted: boolean
  requirements_currently_due: string[]
  requirements_past_due: string[]
  capabilities: Record<string, unknown>
  country: string
  default_currency: string
  kyc_verified_at: string | null
  last_webhook_at: string | null
  created_at: string
  updated_at: string
}

export type EnsuredAccount = {
  stripeAccountId: string
  payoutsEnabled: boolean
  onboardingCompleted: boolean
  alreadyExisted: boolean
}

export type PayoutResult = {
  transferId: string
  amountCents: number
  currency: string
  destination: string
}
