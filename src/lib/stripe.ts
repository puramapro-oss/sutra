import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 900,
    annualPrice: 8600,
    features: ['10 videos/mois', '720p', '10 templates', '1 reseau'],
  },
  creator: {
    name: 'Createur',
    monthlyPrice: 2900,
    annualPrice: 27800,
    features: ['50 videos/mois', '1080p', '3 voix clonees', '1 serie Autopilot', 'Sutra Studio complet', '3 reseaux'],
    popular: true,
  },
  empire: {
    name: 'Empire',
    monthlyPrice: 9900,
    annualPrice: 95000,
    features: ['Videos illimitees', '4K', 'Voix illimitees', '5 series Autopilot', 'Studio + export', 'Reseaux illimites'],
  },
}

export async function createCheckoutSession(params: {
  userId: string
  email: string
  plan: string
  billingPeriod: 'monthly' | 'annual'
  priceId: string
  referralCode?: string
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    allow_promotion_codes: true,
    customer_email: params.email,
    line_items: [{ price: params.priceId, quantity: 1 }],
    metadata: {
      user_id: params.userId,
      app: 'sutra',
      plan: params.plan,
      referral_code: params.referralCode ?? '',
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
  })

  return session.url!
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  })
  return session.url
}
