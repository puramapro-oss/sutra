import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { createCheckoutSession } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'creator', 'empire']),
  billingPeriod: z.enum(['monthly', 'annual']),
  priceId: z.string().min(1, 'priceId requis'),
  referralCode: z.string().optional(),
})

const KNOWN_COUPONS = new Set(['WELCOME50'])

interface PromoCookie {
  coupon?: string
  source?: string
  anon_id?: string
  set_at?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { plan, billingPeriod, priceId, referralCode } = parsed.data

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single()

    let discountCoupon: string | undefined
    let crossPromoSource: string | undefined
    try {
      const cookieStore = await cookies()
      const promoRaw = cookieStore.get('purama_promo')?.value
      if (promoRaw) {
        const promo = JSON.parse(promoRaw) as PromoCookie
        if (promo.coupon && KNOWN_COUPONS.has(promo.coupon.toUpperCase())) {
          discountCoupon = promo.coupon.toUpperCase()
          crossPromoSource = promo.source
          if (promo.anon_id) {
            await serviceClient
              .from('cross_promos')
              .update({ user_id: user.id })
              .eq('anon_id', promo.anon_id)
              .is('user_id', null)
          }
        }
      }
    } catch {
      discountCoupon = undefined
      crossPromoSource = undefined
    }

    const url = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? '',
      plan,
      billingPeriod,
      priceId,
      referralCode: referralCode ?? profile?.referral_code ?? undefined,
      discountCoupon,
      crossPromoSource,
    })

    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return NextResponse.json({ error: 'Erreur creation checkout', details: message }, { status: 500 })
  }
}
