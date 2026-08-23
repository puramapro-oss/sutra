export type ConnectAccount = {
  stripeAccountId: string
  payoutsEnabled: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  onboardingCompleted: boolean
  requirementsCurrentlyDue: string[]
  requirementsPastDue: string[]
}

export type WithdrawOk = {
  transferId: string
  amountEur: number
  estimatedFeesEur: number
  netEstimatedEur: number
  tipMessage: string | null
  principalAfter: number
}

export type WithdrawErr = { error: string; code?: string; [k: string]: unknown }

export const MIN_WITHDRAWAL = 20
export const RECOMMENDED_WITHDRAWAL = 50
