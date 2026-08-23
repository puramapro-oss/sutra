export interface MonthlyPoint {
  month: string
  count: number
  commissions: number
}

export interface RecentReferral {
  id: string
  referred_email: string | null
  status: string
  created_at: string
  first_payment_at: string | null
}

export interface PartnerStats {
  partner_code: string
  total_referrals: number
  total_commissions: number
  balance: number
  tier: string
  pending_commissions: number
  share_url: string
  monthly_graph?: MonthlyPoint[]
  recent_referrals?: RecentReferral[]
}

export interface Referral {
  id: string
  email: string
  created_at: string
  status: 'active' | 'pending'
}
